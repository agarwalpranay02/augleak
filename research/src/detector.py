"""AugLeak detector: blind recovery of augmentation siblings.

Two complementary views of every image:
  * structure view  - blurred grayscale at 32x32 inside a centred disc, mean-centred and normalised.
                      Photometric filters (CLAHE, threshold, top/black-hat, gamma, HSV, blur, sharpen)
                      keep *where* the structure is, so the correlation survives them. Queries are
                      also matched under the 8 dihedral transforms and +-15/30/45 degree rotations.
  * semantic view   - a frozen ImageNet embedding (identity and D4 orbit-averaged); survives
                      crops, rescaling and mild colour change but collapses under heavy filters.
Each view's pair score is converted to a p-value against a *label-calibrated null*: augmentation
preserves the label, so an image's best match in another class is, by construction, not its sibling.
Pairs are linked when the Bonferroni-combined p-value is below alpha; groups are connected components.
"""
import numpy as np, torch
from PIL import Image
from scipy import ndimage

torch.set_num_threads(2)
RES = 32
ANGLES = (15, -15, 30, -30, 45, -45)
CROPS = True   # also match re-crops: centre crops (0.8, 0.65) of image and mirror, corner crops (0.75)


def _crop(a, s, cx=0.5, cy=0.5):
    n = a.shape[0]; w = int(round(n * s))
    x0 = int(round((n - w) * cx)); y0 = int(round((n - w) * cy))
    return np.asarray(Image.fromarray(a[y0:y0 + w, x0:x0 + w]).resize((n, n), Image.BILINEAR), np.float32)


def _disc(res=RES, r=0.48):
    yy, xx = np.mgrid[:res, :res]
    c = (res - 1) / 2
    return ((yy - c) ** 2 + (xx - c) ** 2) <= (r * res) ** 2


DISC = _disc()


def _canon(a):
    """64x64 float gray -> normalised disc vector."""
    v = np.asarray(Image.fromarray(a).resize((RES, RES), Image.BILINEAR), np.float32)[DISC]
    v = v - v.mean()
    return v / (np.linalg.norm(v) + 1e-6)


def hash_views(gray64s):
    """+-1 DCT-pHash bit vectors (scaled so the inner product is in [-1, 1]) for the 8 dihedral transforms."""
    from scipy.fft import dctn
    def bits(a):
        D_ = dctn(np.asarray(Image.fromarray(a).resize((32, 32), Image.BILINEAR), np.float32), norm="ortho")[:8, :8].ravel()
        return (D_ > np.median(D_[1:])).astype(np.float32) * 2 - 1
    H = []
    for k in range(4):
        H.append(np.stack([bits(np.rot90(a, k).copy()) for a in gray64s]))
        H.append(np.stack([bits(np.fliplr(np.rot90(a, k)).copy()) for a in gray64s]))
    return torch.from_numpy(np.stack(H)) / 8.0


def gray64(img):
    if not isinstance(img, Image.Image):
        img = Image.fromarray(img)
    a = np.asarray(img.convert("L").resize((64, 64), Image.BILINEAR), np.float32)
    return ndimage.gaussian_filter(a, 1.0)


class LazyViews:
    """Query views generated block by block, so memory stays O(n) instead of O(20 n)."""

    def __init__(self, gray64s, extra_angles=True):
        self.g, self.extra = gray64s, extra_angles
        self.shape = (8 + ((2 * len(ANGLES) + (8 if CROPS else 0)) if extra_angles else 0), len(gray64s), int(DISC.sum()))

    def rows(self, i, j):
        return structure_views(self.g[i:j], self.extra)[1]


def lazy_structure_views(gray64s, extra_angles=True):
    base = torch.from_numpy(np.stack([_canon(a) for a in gray64s]).astype(np.float32))
    return base, LazyViews(gray64s, extra_angles)


def structure_views(gray64s, extra_angles=True):
    """Returns base (n,d) and views (V,n,d): D4 then small rotations of identity and mirror."""
    views = []
    for k in range(4):
        views.append([_canon(np.rot90(a, k).copy()) for a in gray64s])
        views.append([_canon(np.fliplr(np.rot90(a, k)).copy()) for a in gray64s])
    if extra_angles:
        for ang in ANGLES:
            views.append([_canon(ndimage.rotate(a, ang, reshape=False, order=1, mode="nearest")) for a in gray64s])
            views.append([_canon(ndimage.rotate(np.fliplr(a), ang, reshape=False, order=1, mode="nearest")) for a in gray64s])
    if extra_angles and CROPS:
        for sc in (0.8, 0.65):
            views.append([_canon(_crop(a, sc)) for a in gray64s])
            views.append([_canon(_crop(np.fliplr(a).copy(), sc)) for a in gray64s])
        for cx, cy in ((0, 0), (1, 0), (0, 1), (1, 1)):
            views.append([_canon(_crop(a, 0.75, cx, cy)) for a in gray64s])
    V = torch.from_numpy(np.stack([np.stack(v) for v in views]).astype(np.float32))
    return V[0], V


def l2n(F):
    F = torch.as_tensor(np.asarray(F, np.float32))
    return F / (F.norm(dim=1, keepdim=True) + 1e-8)


class Scorer:
    """score(i, j) -> dict of (rows x n) similarity blocks for each view."""

    def __init__(self, svb, svv, emb=None, emb_d4=None, H8=None):
        self.svb, self.svv, self.H8 = svb, svv, H8
        self.emb = None if emb is None else l2n(emb)
        self.emb_d4 = None if emb_d4 is None else l2n(emb_d4)
        self.n = svb.shape[0]
        self.M = None

    def precompute(self, bs=512):
        """Materialise full score matrices once (fp16) so repeated passes are cheap."""
        M = {}
        for i in range(0, self.n, bs):
            for k, S in self._block(i, min(i + bs, self.n)).items():
                if k not in M:
                    M[k] = torch.empty(self.n, self.n, dtype=torch.float16)
                M[k][i:i + S.shape[0]] = S.half()
        self.M = M
        return self

    def local_scale(self, labels, bs=512):
        """Hubness correction: z_ij = (s_ij - mu_i) / sd_i with mu_i, sd_i taken over image i's
        other-class scores; the pair score is min(z_ij, z_ji), so both images must single the
        other out. Bland images that match everything stop producing false links."""
        lab = torch.as_tensor(np.asarray(labels))
        Z = {}
        for k, M in self.M.items():
            mu = torch.empty(self.n); sd = torch.empty(self.n)
            for i in range(0, self.n, bs):
                S = M[i:i + bs].float(); r = torch.arange(i, min(i + bs, self.n))
                other = lab[r][:, None] != lab[None, :]
                cnt = other.sum(1).clamp_min(1)
                m = (S * other).sum(1) / cnt
                v = (((S - m[:, None]) ** 2) * other).sum(1) / cnt
                mu[r] = m; sd[r] = v.sqrt().clamp_min(1e-4)
            Zk = torch.empty(self.n, self.n, dtype=torch.float16)
            for i in range(0, self.n, bs):
                r = torch.arange(i, min(i + bs, self.n))
                a = (M[i:i + bs].float() - mu[r][:, None]) / sd[r][:, None]
                b = (M[:, i:i + bs].float().T - mu[None, :]) / sd[None, :]
                Zk[i:i + bs] = torch.minimum(a, b).half()
            Z[k] = Zk
        self.M = Z
        return self

    def block(self, i, j):
        if self.M is not None:
            return {k: v[i:j].float() for k, v in self.M.items()}
        return self._block(i, j)

    def _block(self, i, j):
        out = {}
        S = None
        Q = self.svv.rows(i, j) if isinstance(self.svv, LazyViews) else self.svv[:, i:j]
        for v in range(Q.shape[0]):
            s = Q[v] @ self.svb.T
            S = s if S is None else torch.maximum(S, s)
        out["struct"] = S
        if self.H8 is not None:      # perceptual-hash view, searched over the 8 dihedral transforms
            h = None
            for t in range(self.H8.shape[0]):
                x = self.H8[t, i:j] @ self.H8[0].T
                h = x if h is None else torch.maximum(h, x)
            out["hash"] = h
        if self.emb is not None:
            e = self.emb[i:j] @ self.emb.T
            if self.emb_d4 is not None:
                e = torch.maximum(e, self.emb_d4[i:j] @ self.emb_d4.T)
            out["sem"] = e
        return out


def cross_class_null(scorer, labels, bs=512):
    """Best other-class score of every image, per view: the label-calibrated null sample.
    Each null is summarised by a Gumbel fit (the null scores are maxima, so extreme-value theory
    gives their law and lets p-values extrapolate beyond the largest observed null score)."""
    lab = torch.as_tensor(np.asarray(labels))
    null = {}
    for i in range(0, scorer.n, bs):
        r = torch.arange(i, min(i + bs, scorer.n))
        for k, S in scorer.block(i, min(i + bs, scorer.n)).items():
            S = S.masked_fill(lab[r][:, None] == lab[None, :], -2)
            null.setdefault(k, []).append(S.max(1).values)
    from scipy.stats import gumbel_r
    out = {}
    for k, v in null.items():
        x = torch.cat(v).sort().values
        loc, scale = gumbel_r.fit(x.numpy().astype(np.float64))
        out[k] = dict(sample=x, loc=float(loc), scale=float(scale))
    return out


def pvalue(S, nl, empirical=False):
    """Upper-tail p-value of each score under the null (Gumbel by default, empirical optional)."""
    if empirical:
        x = nl["sample"]; m = len(x)
        ge = m - torch.searchsorted(x, S.contiguous(), right=False)
        return (1 + ge).float() / (1 + m)
    z = (S.double() - nl["loc"]) / nl["scale"]
    return (-torch.expm1(-torch.exp(-z))).clamp_min(1e-300)


def fused_block(scorer, null, i, j):
    """-log10 of the Bonferroni-combined min p-value across views (higher = more likely siblings)."""
    blocks = scorer.block(i, j)
    p = None
    for k, S in blocks.items():
        pk = pvalue(S, null[k])
        p = pk if p is None else torch.minimum(p, pk)
    p = torch.clamp(p * len(blocks), max=1.0)
    return (-torch.log10(p)).float(), blocks


def link(scorer, null, labels, alpha, bs=512, same_label=True):
    """Edges (i<j) whose combined p-value < alpha; returns rows, cols."""
    from scipy.sparse import coo_matrix
    lab = torch.as_tensor(np.asarray(labels))
    thr = -np.log10(alpha)
    rows, cols = [], []
    for i in range(0, scorer.n, bs):
        r = torch.arange(i, min(i + bs, scorer.n))
        F, _ = fused_block(scorer, null, i, min(i + bs, scorer.n))
        F[torch.arange(scorer.n)[None, :] <= r[:, None]] = 0
        if same_label:
            F[lab[r][:, None] != lab[None, :]] = 0
        a, b = torch.nonzero(F > thr, as_tuple=True)
        rows.append(a + i); cols.append(b)
    return torch.cat(rows).numpy(), torch.cat(cols).numpy()


def groups_from_edges(n, rows, cols):
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components
    M = coo_matrix((np.ones(len(rows)), (rows, cols)), shape=(n, n))
    return connected_components(M, directed=False)[1]
