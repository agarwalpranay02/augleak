"""E6: audit of public releases with their *official* or customary splits.

Queries (test) are scored against the database (train) in the AugLeak structure view; hubness
correction uses each image's other-class scores along both axes of the test x train matrix; the null is
every test image's best other-class match (Gumbel fit). A test image is flagged when it has a same-class
train match with p < alpha. Exact byte duplicates are reported separately, including across classes.
"""
import argparse, csv, hashlib, json, os, sys, time
import numpy as np, torch
from PIL import Image
from scipy.stats import gumbel_r
sys.path.insert(0, os.path.dirname(__file__))
import detector as D
from leaklib import linear_probe, knn_predict, random_split, group_split, leaked_mask

torch.set_num_threads(2)
FE = "features"; RES = "results"


def struct_matrix(gq, gb, bs=256):
    base = torch.from_numpy(np.stack([D._canon(a) for a in gb]).astype(np.float32))
    S = torch.empty(len(gq), len(gb), dtype=torch.float16)
    t = time.time()
    for i in range(0, len(gq), bs):
        V = D.structure_views(gq[i:i + bs])[1]
        best = None
        for v in range(V.shape[0]):
            s = V[v] @ base.T
            best = s if best is None else torch.maximum(best, s)
        S[i:i + bs] = best.half()
        if i % (bs * 8) == 0:
            print(f"  struct {i}/{len(gq)} {time.time() - t:.0f}s", flush=True)
    return S


def zscores(S, yq, yb, bs=512):
    yq, yb = torch.as_tensor(yq), torch.as_tensor(yb)
    Sf = lambda i: S[i:i + bs].float()
    # row statistics (query side) and column statistics (database side), other-class entries only
    mu_r = torch.empty(S.shape[0]); sd_r = torch.empty(S.shape[0])
    col_sum = torch.zeros(S.shape[1]); col_sq = torch.zeros(S.shape[1]); col_n = torch.zeros(S.shape[1])
    for i in range(0, S.shape[0], bs):
        X = Sf(i); o = (yq[i:i + bs][:, None] != yb[None, :]).float()
        c = o.sum(1).clamp_min(1); m = (X * o).sum(1) / c
        mu_r[i:i + bs] = m; sd_r[i:i + bs] = ((((X - m[:, None]) ** 2) * o).sum(1) / c).sqrt().clamp_min(1e-4)
        col_sum += (X * o).sum(0); col_sq += (X * X * o).sum(0); col_n += o.sum(0)
    mu_c = col_sum / col_n.clamp_min(1); sd_c = (col_sq / col_n.clamp_min(1) - mu_c ** 2).clamp_min(1e-8).sqrt()
    Z = torch.empty_like(S)
    for i in range(0, S.shape[0], bs):
        X = Sf(i)
        Z[i:i + bs] = torch.minimum((X - mu_r[i:i + bs, None]) / sd_r[i:i + bs, None], (X - mu_c[None]) / sd_c[None]).half()
    return Z


def audit(gq, gb, yq, yb, alphas):
    S = struct_matrix(gq, gb)
    Z = zscores(S, yq, yb)
    yq_t, yb_t = torch.as_tensor(yq), torch.as_tensor(yb)
    same_best = torch.empty(len(yq)); same_arg = torch.empty(len(yq), dtype=torch.long); other_best = torch.empty(len(yq))
    other_arg = torch.empty(len(yq), dtype=torch.long)
    for i in range(0, len(yq), 512):
        X = Z[i:i + 512].float(); same = yq_t[i:i + 512][:, None] == yb_t[None, :]
        v, j = X.masked_fill(~same, -1e9).max(1); same_best[i:i + 512] = v; same_arg[i:i + 512] = j
        v, j = X.masked_fill(same, -1e9).max(1); other_best[i:i + 512] = v; other_arg[i:i + 512] = j
    loc, scale = gumbel_r.fit(other_best.numpy().astype(np.float64))
    p = lambda z: -np.expm1(-np.exp(-(np.asarray(z, np.float64) - loc) / scale))
    out = dict(gumbel=dict(loc=loc, scale=scale), flags={})
    p_same = p(same_best.numpy()); p_other = p(other_best.numpy())
    for al in alphas:
        out["flags"][str(al)] = dict(frac_test_flagged=float((p_same < al).mean()), n_flagged=int((p_same < al).sum()),
                                     frac_crossclass_flagged=float((p_other < al).mean()))
    raw_same = torch.gather(S.float(), 1, same_arg[:, None])[:, 0].numpy()
    return out, p_same, same_arg.numpy(), raw_same, p_other, other_arg.numpy()


def load_rows(name):
    return list(csv.DictReader(open(f"data/manifests/{name}.csv")))


def md5(p):
    return hashlib.md5(open(p, "rb").read()).hexdigest()


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--name", required=True)
    ap.add_argument("--alphas", default="0.01,0.001,0.0001")
    a = ap.parse_args(); alphas = [float(x) for x in a.alphas.split(",")]
    rows = load_rows(a.name); labs = sorted({r["label"] for r in rows})
    y = np.array([labs.index(r["label"]) for r in rows])
    res = dict(name=a.name, n=len(rows))
    hashes = [md5(r["path"]) for r in rows]
    if a.name in ("plantdoc", "cifar10", "braintumor", "fruits360"):
        split = np.array([r["split"] for r in rows]); tr = np.where(split == "train")[0]; te = np.where(split == "test")[0]
        hb = {}
        for i in tr: hb.setdefault(hashes[i], []).append(i)
        ex_same = [i for i in te if any(y[j] == y[i] for j in hb.get(hashes[i], []))]
        ex_cross = [i for i in te if any(y[j] != y[i] for j in hb.get(hashes[i], []))]
        res.update(n_train=len(tr), n_test=len(te), exact_test_in_train_same=len(ex_same), exact_test_in_train_cross=len(ex_cross))
        g = [D.gray64(Image.open(rows[i]["path"])) for i in range(len(rows))]
        out, p_same, arg, raw, p_other, oarg = audit([g[i] for i in te], [g[i] for i in tr], y[te], y[tr], alphas)
        # exact-copy rule: byte-identical same-class files are linked with certainty. Hubness
        # correction is built for crowded neighbourhoods and can bury verbatim copies inside a
        # class whose images all look alike (e.g. blank MRI slices), so certain links bypass it.
        pos = {int(i): k for k, i in enumerate(te)}
        for i in ex_same:
            k = pos[int(i)]; p_same[k] = 0.0
            arg[k] = int(np.where(tr == next(j for j in hb[hashes[i]] if y[j] == y[i]))[0][0]); raw[k] = 1.0
        out["exact_rule"] = dict(n_forced=int(sum(1 for i in ex_same)))
        for al in alphas:
            out["flags"][str(al)].update(frac_test_flagged=float((p_same < al).mean()), n_flagged=int((p_same < al).sum()))
        res.update(out)
        pairs = sorted([(float(p_same[k]), int(te[k]), int(tr[arg[k]]), float(raw[k])) for k in range(len(te))])[:400]
        res["top_pairs"] = [dict(p=p_, test=rows[i]["path"], train=rows[j]["path"], label=rows[i]["label"], s=s_) for p_, i, j, s_ in pairs]
        cross = sorted([(float(p_other[k]), int(te[k]), int(tr[oarg[k]])) for k in range(len(te))])[:60]
        res["top_cross"] = [dict(p=p_, test=rows[i]["path"], train=rows[j]["path"], test_label=rows[i]["label"], train_label=rows[j]["label"]) for p_, i, j in cross]
        # does the official split's score depend on flagged images? (frozen EfficientNet-B0, linear probe)
        f = sorted([x for x in os.listdir(FE) if x.startswith(f"{a.name}_effnet_b0")]) or sorted([x for x in os.listdir(FE) if x.startswith(f"{a.name}_mobilenetv3")])
        if f:
            F = np.load(f"{FE}/{f[0]}")["feat"].astype(np.float32)
            pred = linear_probe(F[tr], y[tr], F[te]); c = pred == y[te]
            pn = knn_predict(F[tr], y[tr], F[te], 1); cn = pn == y[te]
            for al in alphas:
                m = p_same < al
                res["flags"][str(al)].update(acc_lp_flagged=float(c[m].mean()) if m.any() else None, acc_lp_clean=float(c[~m].mean()),
                                             acc_1nn_flagged=float(cn[m].mean()) if m.any() else None, acc_1nn_clean=float(cn[~m].mean()))
            res.update(acc_lp_all=float(c.mean()), acc_1nn_all=float(cn.mean()))
    if a.name == "covidcxr":
        grp = np.array([r["group"] for r in rows])
        res.update(n_patients=int(len(set(grp))), imgs_per_patient_max=int(max(np.unique(grp, return_counts=True)[1])),
                   frac_imgs_with_same_patient_sibling=float(np.mean([np.sum(grp == x) > 1 for x in grp])))
        # exact and near duplicates across *different* patients (same picture filed under two ids)
        hb = {}
        for i, h in enumerate(hashes): hb.setdefault(h, []).append(i)
        res["exact_dup_sets_cross_patient"] = int(sum(1 for v in hb.values() if len({grp[i] for i in v}) > 1))
        F = np.load([f"{FE}/{x}" for x in os.listdir(FE) if x.startswith("covidcxr_effnet_b0")][0])["feat"].astype(np.float32)
        rec = []
        for seed in range(10):
            rng = np.random.default_rng(seed)
            for sname, (tr, te) in (("image-level", random_split(len(y), 0.2, rng)), ("patient-level", group_split(grp, 0.2, rng))):
                c = linear_probe(F[tr], y[tr], F[te], seed=seed) == y[te]; cn = knn_predict(F[tr], y[tr], F[te], 1) == y[te]
                rec.append(dict(seed=seed, split=sname, acc_lp=float(c.mean()), acc_1nn=float(cn.mean()), q=float(leaked_mask(grp, tr, te).mean())))
        res["splits"] = rec
        # near-duplicates across patients with AugLeak (all images vs all, same label)
        g = [D.gray64(Image.open(r["path"])) for r in rows]
        S = struct_matrix(g, g); Z = zscores(S, y, y).float()
        Z.fill_diagonal_(-1e9)
        other = torch.from_numpy(y[:, None] != y[None, :])
        loc, scale = gumbel_r.fit(Z.masked_fill(~other, -1e9).max(1).values.numpy().astype(np.float64))
        Z[torch.from_numpy(grp[:, None] == grp[None, :])] = -1e9
        best, bj = Z.masked_fill(other, -1e9).max(1)
        pp = -np.expm1(-np.exp(-(best.numpy().astype(np.float64) - loc) / scale))
        res["gumbel"] = dict(loc=loc, scale=scale)
        res["cross_patient"] = {str(al): dict(frac_images=float((pp < al).mean()), n=int((pp < al).sum())) for al in alphas}
        order = np.argsort(pp)[:200]
        res["top_cross_patient"] = [dict(p=float(pp[i]), a=rows[i]["path"], b=rows[int(bj[i])]["path"], pa=grp[i], pb=grp[int(bj[i])],
                                         s=float(S[i, int(bj[i])])) for i in order]
    json.dump(res, open(f"{RES}/audit_{a.name}.json", "w"), indent=1)
    print(json.dumps({k: v for k, v in res.items() if k not in ("top_pairs", "top_cross", "top_cross_patient", "splits")}, indent=1))


if __name__ == "__main__":
    main()
