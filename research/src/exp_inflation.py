"""E1/E2: how much does a random split of a pre-augmented release inflate accuracy, and does the
leakage identity  acc_random = q * a_L + (1 - q) * a_U  explain it?

CIFAR-Aug: vary augmentation strength, copies per source k, and number of sources; the model trained
on the random split is also scored on fresh CIFAR-10 test images (true generalisation).
Leaf-A / Leaf-B / COVID-CXR: real releases with known groups (file names / patient ids).
"""
import argparse, csv, json, os, sys, time
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from leaklib import *

FE = "features"
RES = "results"


def probe(kind, Ftr, ytr, Fte_list, seed):
    if kind == "linear":
        out = linear_probe(Ftr, ytr, np.concatenate(Fte_list), seed=seed)
    else:
        out = knn_predict(Ftr, ytr, np.concatenate(Fte_list), k=int(kind[3:]))
    res, o = [], 0
    for F in Fte_list:
        res.append(out[o:o + len(F)]); o += len(F)
    return res


def one_run(F, y, g, seed, test_frac, kinds, fresh=None, orig=None):
    rng = np.random.default_rng(seed)
    rows = []
    tr_r, te_r = random_split(len(y), test_frac, rng)
    tr_g, te_g = group_split(g, test_frac, rng)
    L = leaked_mask(g, tr_r, te_r)
    sizes = np.bincount(np.unique(g, return_inverse=True)[1])
    k = int(np.median(sizes))
    for kind in kinds:
        tests = [F[te_r]] + ([fresh[0]] if fresh is not None else [])
        pr = probe(kind, F[tr_r], y[tr_r], tests, seed)
        pg = probe(kind, F[tr_g], y[tr_g], [F[te_g]] + ([fresh[0]] if fresh is not None else []), seed)
        c = pr[0] == y[te_r]
        row = dict(seed=seed, probe=kind, n=len(y), groups=len(sizes), k=k,
                   acc_random=c.mean(), acc_group=(pg[0] == y[te_g]).mean(),
                   q_emp=L.mean(), q_theory=p_sibling_in_train(len(y), len(tr_r), k),
                   a_L=c[L].mean() if L.any() else np.nan, a_U=c[~L].mean() if (~L).any() else np.nan,
                   n_unleaked=int((~L).sum()), n_test=len(te_r))
        if orig is not None:   # accuracy on the un-augmented member of each test group only
            o_r, o_g = orig[te_r], orig[te_g]
            row["acc_random_orig"] = (pr[0][o_r] == y[te_r][o_r]).mean() if o_r.any() else np.nan
            row["acc_group_orig"] = (pg[0][o_g] == y[te_g][o_g]).mean() if o_g.any() else np.nan
        if fresh is not None:
            row["fresh_random_model"] = (pr[1] == fresh[1]).mean()
            row["fresh_group_model"] = (pg[1] == fresh[1]).mean()
        rows.append({k_: (float(v) if isinstance(v, (np.floating, float, np.bool_)) else v) for k_, v in row.items()})
    return rows


def cifar(backbone, seeds, kinds, out):
    d = np.load(f"{FE}/cifaraug_{backbone}_112.npz")
    meta = np.load("data/cifar_aug.npz")
    y0 = meta["y"]; fresh = (d["fresh"].astype(np.float32), meta["fresh_y"])
    for strength in ("weak", "medium", "strong"):
        X = d[strength].astype(np.float32)  # sources x variants x dim
        for n_src, ks in ((2000, (1, 2, 4, 8, 16)), (500, (4, 16)), (1000, (4, 16))):
            for k in ks:
                for seed in range(seeds):
                    # pick sources balanced by class via fixed permutation per seed
                    rng = np.random.default_rng(100 + seed)
                    src = np.sort(np.concatenate([rng.permutation(np.where(y0 == c)[0])[:n_src // 10] for c in range(10)]))
                    F = X[src, :k].reshape(-1, X.shape[-1]); y = np.repeat(y0[src], k); g = np.repeat(src, k)
                    orig = np.tile(np.arange(k) == 0, len(src))
                    t = time.time()
                    for r in one_run(F, y, g, seed, 0.2, kinds, fresh, orig):
                        r.update(dataset="cifar-aug", backbone=backbone, strength=strength, n_src=n_src)
                        out.write(json.dumps(r) + "\n"); out.flush()
                    print(backbone, strength, n_src, k, seed, f"{time.time() - t:.1f}s", flush=True)


def real(name, backbone, size, seeds, kinds, out):
    rows = list(csv.DictReader(open(f"data/manifests/{name}.csv")))
    labs = sorted({r["label"] for r in rows})
    y = np.array([labs.index(r["label"]) for r in rows]); g = np.array([r["group"] for r in rows])
    F = np.load(f"{FE}/{name}_{backbone}_{size}{'_d4' if os.path.exists(f'{FE}/{name}_{backbone}_{size}_d4.npz') else ''}.npz")["feat"].astype(np.float32)
    var = np.array([r.get("variant", "") for r in rows])
    orig = (var == "Original") if "Original" in set(var) else None
    for seed in range(seeds):
        for r in one_run(F, y, g, seed, 0.2, kinds, None, orig):
            r.update(dataset=name, backbone=backbone)
            out.write(json.dumps(r) + "\n"); out.flush()
        print(name, backbone, seed, flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--what", required=True); ap.add_argument("--backbone", default="effnet_b0")
    ap.add_argument("--size", type=int, default=128); ap.add_argument("--seeds", type=int, default=5)
    ap.add_argument("--probes", default="linear,knn1,knn5")
    a = ap.parse_args()
    os.makedirs(RES, exist_ok=True)
    with open(f"{RES}/inflation_{a.what}_{a.backbone}.jsonl", "w") as out:
        if a.what == "cifar":
            cifar(a.backbone, a.seeds, a.probes.split(","), out)
        else:
            real(a.what, a.backbone, a.size, a.seeds, a.probes.split(","), out)
