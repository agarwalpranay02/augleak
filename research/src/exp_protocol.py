"""E4: leak-free evaluation without metadata.

Protocols compared against the oracle group split (true groups known):
  naive      random image-level split (what most papers do with a pre-augmented release)
  dgroup     split by detected groups (connected components of detector links)
  filter     random split, then drop every test image that the detector links to any train image
  dgroup+f   detected-group split, then the same filter
Reported: true residual leakage (share of evaluated test images with a true sibling in train),
share of the test set retained, and linear-probe / 1-NN accuracy versus the oracle.
"""
import argparse, json, os, sys, time
import numpy as np, torch
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from leaklib import random_split, group_split, leaked_mask, linear_probe, knn_predict
import detector as D
from exp_detect import load

RES = "results"


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--name", required=True)
    ap.add_argument("--alphas", default="0.01,0.001"); ap.add_argument("--seeds", type=int, default=5)
    ap.add_argument("--views", default="struct;struct,sem")
    a = ap.parse_args()
    y, g, variant, emb, emb4, imgs, md5 = load(a.name)
    n = len(y); t = time.time()
    g64 = [D.gray64(im) for im in imgs]
    import backbones, invariant
    size = 112 if a.name.startswith("cifar") else (128 if a.name.startswith("leaf") else 160)
    pil = [im if isinstance(im, Image.Image) else Image.fromarray(im) for im in imgs]
    need_sem = any("sem" in v.split(",") for v in a.views.split(";"))
    need_hash = any("hash" in v.split(",") for v in a.views.split(";"))
    inv = inv4 = None
    if need_sem:
        mu, W = invariant.fit(backbones.load("mobilenetv3"), pil, size)
        inv = invariant.project(emb, mu, W); inv4 = None if emb4 is None else invariant.project(emb4, mu, W)
    svb, svv = D.lazy_structure_views(g64)
    base = D.Scorer(svb, svv, inv, inv4, H8=D.hash_views(g64) if need_hash else None).precompute().local_scale(y)
    print("scores ready", f"{time.time() - t:.0f}s", flush=True)
    F = emb.astype(np.float32)   # the evaluated model: linear probe / 1-NN on frozen MobileNetV3
    lab = torch.as_tensor(y)
    rows = []
    for views in a.views.split(";"):
        keep = views.split(",")

        class VS:
            n = base.n
            def block(self, i, j):
                b = base.block(i, j); return {k: b[k] for k in keep}
        sc = VS()
        null = D.cross_class_null(sc, y)
        # full fused matrix (-log10 p), same-label pairs only
        Fz = torch.empty(n, n, dtype=torch.float16)
        for i in range(0, n, 512):
            r = torch.arange(i, min(i + 512, n))
            f, _ = D.fused_block(sc, null, i, min(i + 512, n))
            f[lab[r][:, None] != lab[None, :]] = 0
            Fz[i:i + 512] = f.clamp(max=60000).half()
        Fz.fill_diagonal_(0)
        for al in map(float, a.alphas.split(",")):
            thr = -np.log10(al)
            A = (Fz > thr)
            A |= A.T.clone()
            ii, jj = torch.nonzero(torch.triu(A, 1), as_tuple=True)
            part = D.groups_from_edges(n, ii.numpy(), jj.numpy())
            for seed in range(a.seeds):
                rng = np.random.default_rng(seed)
                splits = {"naive": random_split(n, 0.2, rng), "oracle": group_split(g, 0.2, rng),
                          "dgroup": group_split(part, 0.2, rng)}
                for name, (tr, te) in list(splits.items()):
                    variants = [(name, te)]
                    if name == "naive":
                        flagged = A[torch.from_numpy(te)][:, torch.from_numpy(tr)].any(1).numpy()
                        variants.append((("filter" if name == "naive" else "dgroup+f"), te[~flagged]))
                    pred_lp = linear_probe(F[tr], y[tr], F[te], seed=seed)
                    pred_nn = knn_predict(F[tr], y[tr], F[te], k=1)
                    pos = {v: k for k, v in enumerate(te)}
                    for vname, tev in variants:
                        sel = np.array([pos[v] for v in tev], dtype=int)
                        L = leaked_mask(g, tr, tev) if len(tev) else np.array([])
                        rows.append(dict(dataset=a.name, views=views, alpha=al, seed=seed, protocol=vname,
                                         n_test=int(len(te)), retained=float(len(tev) / len(te)),
                                         residual_leak=float(L.mean()) if len(tev) else float("nan"),
                                         acc_lp=float((pred_lp[sel] == y[tev]).mean()) if len(tev) else float("nan"),
                                         acc_1nn=float((pred_nn[sel] == y[tev]).mean()) if len(tev) else float("nan"),
                                         largest_frac=float(np.bincount(part).max() / n), n_groups_detected=int(part.max() + 1)))
            sub = [r for r in rows if r["views"] == views and r["alpha"] == al]
            for p in ("naive", "oracle", "dgroup", "filter"):
                s = [r for r in sub if r["protocol"] == p]
                print(a.name, views, al, p, "leak=%.3f kept=%.3f lp=%.3f nn=%.3f" % tuple(
                    np.nanmean([r[k] for r in s]) for k in ("residual_leak", "retained", "acc_lp", "acc_1nn")), flush=True)
    with open(f"{RES}/protocol_{a.name}.jsonl", "w") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")


if __name__ == "__main__":
    main()
