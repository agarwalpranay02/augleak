"""Core utilities: splits, probes, the leakage identity, and the blind group detector."""
import math
import numpy as np
import torch
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components

torch.set_num_threads(2)


# ---------------------------------------------------------------- splits
def random_split(n, test_frac, rng):
    idx = rng.permutation(n)
    k = int(round(n * test_frac))
    return np.sort(idx[k:]), np.sort(idx[:k])


def group_split(groups, test_frac, rng):
    """Whole groups go to one side; stratification is unnecessary at our group counts."""
    ug = np.unique(groups)
    perm = rng.permutation(len(ug))
    te_g = set(ug[perm[:int(round(len(ug) * test_frac))]])
    te = np.array([g in te_g for g in groups])
    return np.where(~te)[0], np.where(te)[0]


# ---------------------------------------------------------------- the leakage identity
def p_sibling_in_train(N, n_train, k):
    """Exact probability that a test item of a size-k group has >=1 sibling in a uniformly random
    train set of n_train items drawn from the other N-1 items (hypergeometric)."""
    if k <= 1:
        return 0.0
    # P(no sibling) = C(N-k, n_train) / C(N-1, n_train)
    lg = lambda a, b: math.lgamma(a + 1) - math.lgamma(b + 1) - math.lgamma(a - b + 1)
    if n_train > N - k:
        return 1.0
    return 1.0 - math.exp(lg(N - k, n_train) - lg(N - 1, n_train))


def leaked_mask(groups, tr, te):
    trg = set(groups[tr])
    return np.array([groups[i] in trg for i in te])


# ---------------------------------------------------------------- classifiers on frozen features
def _std(Ftr, Fte):
    mu, sd = Ftr.mean(0), Ftr.std(0) + 1e-6
    return (Ftr - mu) / sd, (Fte - mu) / sd


def linear_probe(Ftr, ytr, Fte, wd=1e-3, iters=50, seed=0):
    """Multinomial logistic regression, full-batch L-BFGS, L2 penalty wd."""
    torch.manual_seed(seed)
    Ftr, Fte = _std(np.asarray(Ftr, np.float32), np.asarray(Fte, np.float32))
    X = torch.from_numpy(Ftr); y = torch.from_numpy(np.asarray(ytr)).long()
    C = int(y.max()) + 1
    W = torch.zeros(X.shape[1], C, requires_grad=True); b = torch.zeros(C, requires_grad=True)
    opt = torch.optim.LBFGS([W, b], lr=1, max_iter=iters, history_size=20, line_search_fn="strong_wolfe")

    def closure():
        opt.zero_grad()
        loss = torch.nn.functional.cross_entropy(X @ W + b, y) + wd * (W * W).sum()
        loss.backward()
        return loss
    opt.step(closure)
    with torch.no_grad():
        return (torch.from_numpy(Fte) @ W + b).argmax(1).numpy()


def l2n(F):
    F = np.asarray(F, np.float32)
    return F / (np.linalg.norm(F, axis=1, keepdims=True) + 1e-8)


def knn_predict(Ftr, ytr, Fte, k=1, bs=2048):
    A, B = torch.from_numpy(l2n(Ftr)), torch.from_numpy(l2n(Fte))
    ytr = torch.from_numpy(np.asarray(ytr)).long(); C = int(ytr.max()) + 1
    out = []
    for i in range(0, len(B), bs):
        s, j = (B[i:i + bs] @ A.T).topk(k, dim=1)
        votes = torch.zeros(len(s), C).scatter_add_(1, ytr[j], torch.ones_like(s))
        out.append(votes.argmax(1))
    return torch.cat(out).numpy()


def nn_sim(Fq, Fdb, exclude_self=False, bs=2048, mask_fn=None):
    """Max cosine similarity of each query to the database (optionally excluding identical index)."""
    A, B = torch.from_numpy(l2n(Fdb)), torch.from_numpy(l2n(Fq))
    best, arg = [], []
    for i in range(0, len(B), bs):
        S = B[i:i + bs] @ A.T
        if exclude_self:
            r = torch.arange(i, min(i + bs, len(B)))
            S[torch.arange(len(r)), r] = -2
        if mask_fn is not None:
            S = mask_fn(S, i)
        v, j = S.max(1)
        best.append(v); arg.append(j)
    return torch.cat(best).numpy(), torch.cat(arg).numpy()


# ---------------------------------------------------------------- blind group detector
def edges_above(F, tau, bs=1024, labels=None):
    """All pairs (i<j) with cosine >= tau; if labels given, only same-label pairs
    (label-preserving augmentation can never cross classes)."""
    A = torch.from_numpy(l2n(F))
    rows, cols, vals = [], [], []
    lab = None if labels is None else torch.from_numpy(np.asarray(labels))
    for i in range(0, len(A), bs):
        S = A[i:i + bs] @ A.T
        r = torch.arange(i, min(i + bs, len(A)))
        S[torch.arange(len(A))[None, :] <= r[:, None]] = -2  # keep j > i only
        if lab is not None:
            S[lab[r][:, None] != lab[None, :]] = -2
        ii, jj = torch.nonzero(S >= tau, as_tuple=True)
        rows.append(ii + i); cols.append(jj); vals.append(S[ii, jj])
    return torch.cat(rows).numpy(), torch.cat(cols).numpy(), torch.cat(vals).numpy()


def components(n, rows, cols):
    M = coo_matrix((np.ones(len(rows)), (rows, cols)), shape=(n, n))
    return connected_components(M, directed=False)[1]


def calibrate_tau(F, labels, alpha=0.001, bs=1024, sample=None, rng=None):
    """Label-only calibration: siblings share a label, so the most-similar *other-class* image of
    each item is an unrelated image. tau = (1-alpha) quantile of those cross-class maxima."""
    F = l2n(F); labels = np.asarray(labels)
    idx = np.arange(len(F)) if sample is None else rng.choice(len(F), min(sample, len(F)), replace=False)
    lab = torch.from_numpy(labels)

    def mask(S, i):
        q = torch.from_numpy(labels[idx[i:i + S.shape[0]]])
        S[q[:, None] == lab[None, :]] = -2
        return S
    s, _ = nn_sim(F[idx], F, mask_fn=mask, bs=bs)
    return float(np.quantile(s, 1 - alpha)), s


def pairwise_scores(pred, true):
    """Pairwise precision / recall / F1 of a predicted partition against the true one."""
    from collections import Counter
    def pairs(c): return sum(v * (v - 1) // 2 for v in c.values())
    tp = pairs(Counter(zip(pred, true)))
    pp, tt = pairs(Counter(pred)), pairs(Counter(true))
    P = tp / pp if pp else 1.0; R = tp / tt if tt else 1.0
    return P, R, (2 * P * R / (P + R) if P + R else 0.0)


# ---------------------------------------------------------------- perceptual hash
def phash_bits(img_u8_gray32):
    """DCT pHash: 32x32 grayscale -> 64-bit (8x8 low frequencies vs median)."""
    from scipy.fft import dctn
    D = dctn(img_u8_gray32.astype(np.float32), norm="ortho")[:8, :8].ravel()
    return (D > np.median(D[1:])).astype(np.uint8)


def mean_ci(x, z=1.96):
    x = np.asarray(x, float)
    return x.mean(), (z * x.std(ddof=1) / math.sqrt(len(x)) if len(x) > 1 else 0.0)
