#!/usr/bin/env python
"""augleak: find hidden augmented copies in an image dataset and evaluate without leakage.

Layout expected: one sub-folder per class (ImageFolder style), e.g. data/healthy/*.jpg, data/rust/*.jpg.

  augleak scan  DATA            [--alpha 1e-3] [--out report/]
      Links copies of one photograph inside a release (no metadata needed) and writes
      links.csv, groups.csv (detected groups), duplicates.csv (byte-identical files, incl. across classes)
      and report.md.

  augleak test  TRAIN TEST      [--alpha 1e-3] [--out report/]
      Audits an existing split: flags test images that have a copy in TRAIN, writes flagged.csv,
      clean_test.txt (the filtered test set) and report.md with the predicted exposure.

  augleak split DATA            [--test-frac 0.2] [--alpha 1e-2] [--seed 0] [--out split/]
      Writes a group-aware split (train.txt / test.txt) from the detected groups.

Views: structure (blurred grey, transform search) and perceptual hash, each hubness-corrected and
calibrated against a label-derived null (a copy never changes class). Memory grows as N^2; up to
~6k images per call on an 8 GB machine.
"""
import argparse, csv, hashlib, os, sys, time
import numpy as np, torch
from PIL import Image
from scipy.stats import gumbel_r

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "src"))
import detector as D

EXT = (".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".webp")


def list_images(root):
    items = []
    for cls in sorted(os.listdir(root)):
        d = os.path.join(root, cls)
        if os.path.isdir(d):
            for dp, _, fs in os.walk(d):
                items += [(os.path.join(dp, f), cls) for f in sorted(fs) if f.lower().endswith(EXT)]
    if not items:
        sys.exit(f"no images found under {root} (expected one sub-folder per class)")
    return items


def md5(p):
    return hashlib.md5(open(p, "rb").read()).hexdigest()


def views(paths):
    g = []
    for i, p in enumerate(paths):
        g.append(D.gray64(Image.open(p)))
        if i % 2000 == 0:
            print(f"  read {i}/{len(paths)}", flush=True)
    return g


def scores(gq, gb):
    """Per-view score matrices (query x database): structure (max over transforms) and hash."""
    base = torch.from_numpy(np.stack([D._canon(a) for a in gb]).astype(np.float32))
    Hb = D.hash_views(gb)[0]
    S = torch.empty(len(gq), len(gb), dtype=torch.float16); H = torch.empty_like(S)
    for i in range(0, len(gq), 256):
        V = D.structure_views(gq[i:i + 256])[1]
        s = None
        for v in range(V.shape[0]):
            x = V[v] @ base.T; s = x if s is None else torch.maximum(s, x)
        S[i:i + 256] = s.half()
        Hq = D.hash_views(gq[i:i + 256])
        h = None
        for t in range(8):
            x = Hq[t] @ Hb.T; h = x if h is None else torch.maximum(h, x)
        H[i:i + 256] = h.half()
    return {"structure": S, "hash": H}


def zscore(M, yq, yb, same_set):
    yq, yb = torch.as_tensor(yq), torch.as_tensor(yb)
    other = (yq[:, None] != yb[None, :]).float()
    X = M.float()
    if same_set:
        X.fill_diagonal_(float("nan"))
    Xo = torch.nan_to_num(X, nan=0.0) * other
    cr = other.sum(1).clamp_min(1); cc = other.sum(0).clamp_min(1)
    mr = Xo.sum(1) / cr; mc = Xo.sum(0) / cc
    sr = (((torch.nan_to_num(X, nan=0.0) - mr[:, None]) ** 2 * other).sum(1) / cr).sqrt().clamp_min(1e-4)
    sc = (((torch.nan_to_num(X, nan=0.0) - mc[None]) ** 2 * other).sum(0) / cc).sqrt().clamp_min(1e-4)
    Z = torch.minimum((X - mr[:, None]) / sr[:, None], (X - mc[None]) / sc[None])
    return Z, other.bool()


def pvalues(views_, yq, yb, same_set):
    """Bonferroni-combined p-value matrix over views, each calibrated on other-class best matches."""
    P = None
    for name, M in views_.items():
        Z, other = zscore(M, yq, yb, same_set)
        null = torch.nan_to_num(Z, nan=-1e9).masked_fill(~other, -1e9).max(1).values.numpy().astype(np.float64)
        loc, scale = gumbel_r.fit(null[null > -1e8])
        p = -torch.expm1(-torch.exp(-(Z.double() - loc) / scale))
        p = torch.nan_to_num(p, nan=1.0)
        P = p if P is None else torch.minimum(P, p)
    return (P * len(views_)).clamp(max=1.0)


def exposure(N, n_train, k):
    from math import lgamma, exp
    if k <= 1:
        return 0.0
    lg = lambda a, b: lgamma(a + 1) - lgamma(b + 1) - lgamma(a - b + 1)
    return 1.0 - exp(lg(N - k, n_train) - lg(N - 1, n_train)) if n_train <= N - k else 1.0


def components(n, ii, jj):
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components
    return connected_components(coo_matrix((np.ones(len(ii)), (ii, jj)), shape=(n, n)), directed=False)[1]


def cmd_scan(a):
    items = list_images(a.data); paths = [p for p, _ in items]
    classes = sorted({c for _, c in items}); y = np.array([classes.index(c) for _, c in items])
    t = time.time(); g = views(paths)
    P = pvalues(scores(g, g), y, y, True)
    same = torch.as_tensor(y[:, None] == y[None, :])
    L = (P < a.alpha) & same
    hs_ = {}
    for i, p in enumerate(paths):
        hs_.setdefault(md5(p), []).append(i)
    for v in hs_.values():          # byte-identical files are linked unconditionally
        for i in v:
            for j in v:
                if i != j and y[i] == y[j]:
                    L[i, j] = True
    L = torch.triu(L | L.T, 1)
    ii, jj = [x.numpy() for x in torch.nonzero(L, as_tuple=True)]
    part = components(len(paths), ii, jj)
    os.makedirs(a.out, exist_ok=True)
    with open(f"{a.out}/links.csv", "w", newline="") as f:
        w = csv.writer(f); w.writerow(["image_a", "image_b", "p_value"])
        for i, j in zip(ii, jj):
            w.writerow([paths[i], paths[j], f"{float(P[i, j]):.3g}"])
    with open(f"{a.out}/groups.csv", "w", newline="") as f:
        w = csv.writer(f); w.writerow(["image", "class", "group"])
        for (p, c), gid in zip(items, part):
            w.writerow([p, c, int(gid)])
    hs = {}
    for p, c in items:
        hs.setdefault(md5(p), []).append((p, c))
    dups = [v for v in hs.values() if len(v) > 1]
    with open(f"{a.out}/duplicates.csv", "w", newline="") as f:
        w = csv.writer(f); w.writerow(["set", "image", "class", "conflicting_labels"])
        for s, v in enumerate(dups):
            conflict = len({c for _, c in v}) > 1
            for p, c in v:
                w.writerow([s, p, c, conflict])
    sizes = np.bincount(part); k_med = int(np.median(sizes[sizes > 1])) if (sizes > 1).any() else 1
    n_tr = int(round(0.8 * len(paths)))
    rep = [f"# augleak scan: {a.data}", "", f"- images: {len(paths)} in {len(classes)} classes",
           f"- links at alpha={a.alpha}: {len(ii)}; images with at least one link: {np.mean(np.bincount(np.concatenate([ii, jj]), minlength=len(paths)) > 0):.1%}",
           f"- detected groups: {len(sizes)} (largest {sizes.max()}, median size of linked groups {k_med})",
           f"- byte-identical sets: {len(dups)} ({sum(len({c for _, c in v}) > 1 for v in dups)} with conflicting labels)",
           f"- predicted share of test images with a detected copy in train under a random 80/20 split: "
           f"{np.mean([exposure(len(paths), n_tr, int(sizes[gid])) for gid in part]):.1%} (a lower bound)",
           "", "Detected groups are a lower bound on the true grouping (copies that the detector cannot match stay separate).",
           f"Elapsed: {time.time() - t:.0f}s"]
    open(f"{a.out}/report.md", "w").write("\n".join(rep) + "\n"); print("\n".join(rep))


def cmd_test(a):
    tr, te = list_images(a.train), list_images(a.test)
    classes = sorted({c for _, c in tr + te})
    ytr = np.array([classes.index(c) for _, c in tr]); yte = np.array([classes.index(c) for _, c in te])
    gtr, gte = views([p for p, _ in tr]), views([p for p, _ in te])
    P = pvalues(scores(gte, gtr), yte, ytr, False)
    same = torch.as_tensor(yte[:, None] == ytr[None, :])
    best, arg = P.masked_fill(~same, 1.0).min(1)
    flag = (best < a.alpha).numpy()
    htr = {}
    for p, c in tr:
        htr.setdefault(md5(p), []).append(c)
    # byte-identical copies are certain: flag them even when hubness correction hides them
    for k, (p, c) in enumerate(te):
        if c in htr.get(md5(p), []):
            flag[k] = True
    cross = [(p, c, htr[md5(p)]) for p, c in te if md5(p) in htr and any(x != c for x in htr[md5(p)])]
    os.makedirs(a.out, exist_ok=True)
    with open(f"{a.out}/flagged.csv", "w", newline="") as f:
        w = csv.writer(f); w.writerow(["test_image", "class", "closest_train_image", "p_value"])
        for k in np.where(flag)[0]:
            w.writerow([te[k][0], te[k][1], tr[int(arg[k])][0], f"{float(best[k]):.3g}"])
    open(f"{a.out}/clean_test.txt", "w").write("\n".join(te[k][0] for k in np.where(~flag)[0]) + "\n")
    rep = [f"# augleak test", "", f"- train {len(tr)}, test {len(te)}",
           f"- test images with a copy in train (alpha={a.alpha}): {flag.sum()} ({flag.mean():.1%})",
           f"- test images byte-identical to a train image with a different label: {len(cross)}",
           f"- clean test set: {(~flag).sum()} images (clean_test.txt). Report accuracy on it, and its size."]
    open(f"{a.out}/report.md", "w").write("\n".join(rep) + "\n"); print("\n".join(rep))


def cmd_split(a):
    tmp = argparse.Namespace(data=a.data, alpha=a.alpha, out=a.out)
    cmd_scan(tmp)
    rows = list(csv.DictReader(open(f"{a.out}/groups.csv")))
    gids = np.array([int(r["group"]) for r in rows]); ug = np.unique(gids)
    rng = np.random.default_rng(a.seed); te_g = set(rng.permutation(ug)[:int(round(len(ug) * a.test_frac))])
    te = [r["image"] for r, g in zip(rows, gids) if g in te_g]; tr = [r["image"] for r, g in zip(rows, gids) if g not in te_g]
    open(f"{a.out}/train.txt", "w").write("\n".join(tr) + "\n"); open(f"{a.out}/test.txt", "w").write("\n".join(te) + "\n")
    print(f"group-aware split: {len(tr)} train / {len(te)} test images -> {a.out}/train.txt, test.txt")
    print("Detected groups can fragment; also run `augleak test` on the result and report the filtered accuracy.")


def main():
    ap = argparse.ArgumentParser(prog="augleak", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("scan"); s.add_argument("data"); s.add_argument("--alpha", type=float, default=1e-3); s.add_argument("--out", default="augleak_report")
    t = sub.add_parser("test"); t.add_argument("train"); t.add_argument("test"); t.add_argument("--alpha", type=float, default=1e-3); t.add_argument("--out", default="augleak_report")
    p = sub.add_parser("split"); p.add_argument("data"); p.add_argument("--test-frac", type=float, default=0.2); p.add_argument("--alpha", type=float, default=1e-2)
    p.add_argument("--seed", type=int, default=0); p.add_argument("--out", default="augleak_split")
    a = ap.parse_args()
    {"scan": cmd_scan, "test": cmd_test, "split": cmd_split}[a.cmd](a)


if __name__ == "__main__":
    main()
