"""E3: blind recovery of augmentation groups (no file names, no metadata).

Every method is calibrated the same way (Gumbel fit to the cross-class best-match null) and linked at
the same alpha, so the comparison is about the representation, not threshold tuning.
Methods: exact bytes | pHash | pHash-D4 | embedding (semantic view) | structure view | AugLeak (fused).
"""
import argparse, csv, hashlib, json, os, sys, time
import numpy as np, torch
from PIL import Image
from sklearn.metrics import adjusted_rand_score
sys.path.insert(0, os.path.dirname(__file__))
from leaklib import pairwise_scores, phash_bits, group_split, leaked_mask
import detector as D

FE = "features"; RES = "results"


def load(name):
    if name.startswith("cifaraug"):
        strength = name.split("-")[1]
        meta = np.load("data/cifar_aug.npz")
        if name.startswith("cifaraug10"):   # 50 sources from each of the 10 classes
            src = np.concatenate([np.where(meta["y"] == c)[0][:50] for c in range(10)])
        else:                                # legacy subset: first 500 sources (3 classes)
            src = np.arange(500)
        X = meta[strength][src]; V = X.shape[1]
        imgs = list(X.reshape(-1, 32, 32, 3))
        y = np.repeat(meta["y"][src], V); g = np.repeat(src, V).astype(str)
        variant = np.tile(np.arange(V), 500).astype(str)
        d = np.load(f"{FE}/cifaraug_mobilenetv3_112.npz")   # base embeddings (no dihedral average for CIFAR)
        emb, emb4 = d[strength][src].reshape(len(y), -1), None
        md5 = [hashlib.md5(a.tobytes()).hexdigest() for a in imgs]
        return y, g, variant, emb, emb4, imgs, md5
    rows = list(csv.DictReader(open(f"data/manifests/{name}.csv")))
    labs = sorted({r["label"] for r in rows})
    y = np.array([labs.index(r["label"]) for r in rows]); g = np.array([r["group"] for r in rows])
    variant = np.array([r.get("variant", "") for r in rows])
    d = np.load(f"{FE}/{name}_mobilenetv3_{128 if name.startswith('leaf') else 160}_d4.npz")
    imgs = [Image.open(r["path"]) for r in rows]
    md5 = [hashlib.md5(open(r["path"], "rb").read()).hexdigest() for r in rows]
    return y, g, variant, d["feat"], d["feat_d4"], imgs, md5


class HashScorer:
    def __init__(self, H8, d4):
        self.H8, self.d4, self.n = H8, d4, H8.shape[1]

    def block(self, i, j):
        if not self.d4:
            return {"phash": self.H8[0, i:j] @ self.H8[0].T}
        S = None
        for t in range(8):
            s = self.H8[t, i:j] @ self.H8[0].T
            S = s if S is None else torch.maximum(S, s)
        return {"phash": S}


class ViewScorer:
    def __init__(self, base, keep):
        self.base, self.keep, self.n = base, keep, base.n

    def block(self, i, j):
        b = self.base.block(i, j)
        return {k: b[k] for k in self.keep}


def evaluate(scorer, name, y, g, variant, alphas, bs=512):
    t = time.time()
    null = D.cross_class_null(scorer, y, bs)
    G = torch.from_numpy(np.unique(g, return_inverse=True)[1]); n = scorer.n
    bins = np.linspace(0, 300, 3001)
    pos = np.zeros(len(bins) - 1); neg = np.zeros(len(bins) - 1)
    for i in range(0, n, bs):
        r = torch.arange(i, min(i + bs, n))
        Fz, _ = D.fused_block(scorer, null, i, min(i + bs, n))
        keep = torch.arange(n)[None, :] > r[:, None]
        same = G[r][:, None] == G[None, :]
        Fz = Fz.clamp(max=299.99)
        pos += np.histogram(Fz[keep & same].numpy(), bins)[0]
        neg += np.histogram(Fz[keep & ~same].numpy(), bins)[0]
    tp = np.cumsum(pos[::-1])[::-1]; fp = np.cumsum(neg[::-1])[::-1]
    P = tp / np.maximum(tp + fp, 1); R = tp / max(pos.sum(), 1)
    AP = float(np.sum(-np.diff(np.concatenate([R, [0]])) * P))
    m = dict(AP=AP, curve=dict(P=P[::5].tolist(), R=R[::5].tolist(), t=bins[:-1][::5].tolist()),
             null={k: dict(loc=v["loc"], scale=v["scale"], sample=v["sample"].numpy()[::max(1, n // 2000)].tolist()) for k, v in null.items()},
             parts={})
    for al in alphas:
        rows, cols = D.link(scorer, null, y, al, bs)
        part = D.groups_from_edges(n, rows, cols)
        Pp, Rp, Fp = pairwise_scores(part, g)
        # calibration: share of images directly linked to >=1 same-class NON-sibling (nominal: alpha)
        bad = np.zeros(n, bool); gi_ = G.numpy()
        bad[rows[gi_[rows] != gi_[cols]]] = True; bad[cols[gi_[rows] != gi_[cols]]] = True
        # and per-image recall: share of images directly linked to >=1 true sibling
        good = np.zeros(n, bool)
        good[rows[gi_[rows] == gi_[cols]]] = True; good[cols[gi_[rows] == gi_[cols]]] = True
        gi = G.numpy(); rec = {}
        for v in np.unique(variant):
            idx = np.where(variant == v)[0]
            hit = sum(np.any(part[(gi == gi[i]) & (np.arange(n) != i)] == part[i]) for i in idx)
            rec[str(v)] = hit / len(idx)
        # leakage-oriented metric: split by the detected groups, measure true residual leakage
        resid = []
        for seed in range(5):
            tr, te = group_split(part, 0.2, np.random.default_rng(seed))
            resid.append(leaked_mask(g, tr, te).mean())
        m["parts"][str(al)] = dict(P=Pp, R=Rp, F1=Fp, ARI=adjusted_rand_score(g, part),
                                   n_components=int(len(np.unique(part))), variant_recall=rec,
                                   largest_frac=float(np.bincount(part).max() / n),
                                   img_false_link=float(bad.mean()), img_sibling_link=float(good.mean()),
                                   residual_leak=float(np.mean(resid)))
        np.save(f"{RES}/partition_{name}_{al}.npy", part)
    print(name, f"AP={AP:.3f}", {k: {kk: round(vv, 3) for kk, vv in v.items() if kk in ("P", "R", "F1", "img_false_link", "img_sibling_link", "residual_leak")} for k, v in m["parts"].items()},
          f"{time.time() - t:.0f}s", flush=True)
    return m


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--name", required=True)
    ap.add_argument("--alphas", default="0.01,0.001,0.0001")
    ap.add_argument("--methods", default="exact,phash,phash_d4,sem,struct,augleak")
    a = ap.parse_args(); alphas = [float(x) for x in a.alphas.split(",")]
    y, g, variant, emb, emb4, imgs, md5 = load(a.name)
    n = len(y); t = time.time()
    g64 = [D.gray64(im) for im in imgs]
    out = {"name": a.name, "n": n, "groups": int(len(np.unique(g))), "methods": {}}
    meths = a.methods.split(",")
    if "exact" in meths:
        ex = np.unique(md5, return_inverse=True)[1]
        P, R, F = pairwise_scores(ex, g)
        out["methods"]["exact"] = dict(parts={"-": dict(P=P, R=R, F1=F, ARI=adjusted_rand_score(g, ex))})
    if "phash" in meths or "phash_d4" in meths:
        G32 = [np.asarray(Image.fromarray(a_).resize((32, 32), Image.BILINEAR), np.float32) for a_ in g64]
        H8 = []
        for k in range(4):
            R_ = [np.rot90(x, k) for x in G32]
            H8 += [np.stack([phash_bits(x) for x in R_]), np.stack([phash_bits(np.fliplr(x)) for x in R_])]
        H8 = torch.from_numpy(np.stack(H8).astype(np.float32) * 2 - 1) / 8.0
        for d4 in (False, True):
            key = "phash_d4" if d4 else "phash"
            if key in meths:
                out["methods"][key] = evaluate(HashScorer(H8, d4), f"{a.name}_{key}", y, g, variant, alphas)
    if any(m in meths for m in ("inv", "fused", "hash", "pix", "all")):
        import backbones, invariant
        size = 112 if a.name.startswith("cifar") else (128 if a.name.startswith("leaf") else 160)
        pil = [im if isinstance(im, Image.Image) else Image.fromarray(im) for im in imgs]
        inv = inv4 = None
        if any(m in meths for m in ("inv", "fused", "all")):
            mu, W = invariant.fit(backbones.load("mobilenetv3"), pil, size)
            inv = invariant.project(emb, mu, W); inv4 = None if emb4 is None else invariant.project(emb4, mu, W)
        print("invariant metric fitted", f"{time.time() - t:.0f}s", flush=True)
        svb, svv = D.lazy_structure_views(g64)
        base2 = D.Scorer(svb, svv, inv, inv4, H8=D.hash_views(g64) if "all" in meths or "pix" in meths else None).precompute().local_scale(y)
        for key, keep in (("inv", ["sem"]), ("fused", ["struct", "sem"]), ("hash", ["hash"]), ("pix", ["struct", "hash"]), ("all", ["struct", "hash", "sem"])):
            if key in meths and (inv is not None or "sem" not in keep):
                out["methods"][key] = evaluate(ViewScorer(base2, keep), f"{a.name}_{key}", y, g, variant, alphas)
        del base2
    if any(m in meths for m in ("sem", "struct", "augleak")):
        svb, svv = D.lazy_structure_views(g64)
        print("views built", tuple(svv.shape), f"{time.time() - t:.0f}s", flush=True)
        base = D.Scorer(svb, svv, emb if "sem" in meths or "augleak" in meths else None,
                        emb4 if "sem" in meths or "augleak" in meths else None).precompute().local_scale(y)
        print('scores cached', f'{time.time() - t:.0f}s', flush=True)
        for key, keep in (("sem", ["sem"]), ("struct", ["struct"]), ("augleak", ["struct", "sem"])):
            if key in meths:
                out["methods"][key] = evaluate(ViewScorer(base, keep), f"{a.name}_{key}", y, g, variant, alphas)
    fn = f"{RES}/detect_{a.name}.json"
    if os.path.exists(fn):                      # merge with methods from earlier runs
        old = json.load(open(fn)); old["methods"].update(out["methods"]); out = old
    json.dump(out, open(fn, "w"))


if __name__ == "__main__":
    main()
