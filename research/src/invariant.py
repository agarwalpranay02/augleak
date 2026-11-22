"""Self-supervised augmentation-invariant metric on top of a frozen embedding.

From the release itself (no labels, no groups) we draw M images, make two edited copies of each with a
*generic* augmentation family that is fixed once for all datasets, and embed them. Copies of one image
estimate the nuisance covariance Sigma_w (directions an edit moves an embedding), different images the
signal covariance Sigma_b. The projection solving  Sigma_b v = lambda (Sigma_w + eps I) v  keeps the
directions that separate photographs and discards the ones augmentation moves (a Fisher/LDA criterion
with copies as classes). Cost: 3M forward passes and one d x d eigenproblem.
"""
import numpy as np, torch, random, timm
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from scipy.linalg import eigh

torch.set_num_threads(2)


def generic_edit(im, r):
    """Generic edit family used for *every* dataset (not tuned to any release)."""
    w, h = im.size
    if r.random() < 0.5: im = ImageOps.mirror(im)
    if r.random() < 0.3: im = ImageOps.flip(im)
    if r.random() < 0.3: im = im.rotate(90 * r.randint(1, 3), expand=True)
    if r.random() < 0.6: im = im.rotate(r.uniform(-30, 30), resample=Image.BILINEAR)
    if r.random() < 0.6:
        s = r.uniform(0.55, 1.0); cw, ch = int(im.size[0] * s), int(im.size[1] * s)
        x, y = r.randint(0, im.size[0] - cw), r.randint(0, im.size[1] - ch)
        im = im.crop((x, y, x + cw, y + ch))
    im = im.resize((w, h), Image.BILINEAR)
    for enh in (ImageEnhance.Brightness, ImageEnhance.Contrast, ImageEnhance.Color):
        if r.random() < 0.7: im = enh(im).enhance(r.uniform(0.6, 1.4))
    ops = [lambda x: ImageOps.grayscale(x).convert("RGB"), lambda x: x.filter(ImageFilter.GaussianBlur(r.uniform(0.5, 2))),
           lambda x: x.filter(ImageFilter.SHARPEN), lambda x: ImageOps.equalize(x), lambda x: ImageOps.autocontrast(x),
           lambda x: ImageOps.posterize(x, r.randint(3, 5)), lambda x: x.filter(ImageFilter.FIND_EDGES),
           lambda x: ImageOps.invert(x)]
    for op in r.sample(ops, r.choice([0, 1, 1, 2])):
        im = op(im)
    return im


def embed(model, ims, size, bs=64):
    cfg = timm.data.resolve_data_config({}, model=model)
    mean = torch.tensor(cfg["mean"]).view(1, 3, 1, 1); std = torch.tensor(cfg["std"]).view(1, 3, 1, 1)
    out = []
    with torch.inference_mode():
        for i in range(0, len(ims), bs):
            x = torch.from_numpy(np.stack([np.asarray(im.convert("RGB").resize((size, size), Image.BILINEAR)) for im in ims[i:i + bs]]))
            x = (x.permute(0, 3, 1, 2).float() / 255 - mean) / std
            out.append(model(x).numpy())
    return np.concatenate(out)


def fit(model, images, size, M=1500, dim=128, eps=1e-3, seed=0):
    """images: list of PIL images from the release. Returns (mu, W) so that z = (e - mu) @ W."""
    r = random.Random(seed)
    idx = r.sample(range(len(images)), min(M, len(images)))
    a = [generic_edit(images[i].convert("RGB"), r) for i in idx]
    b = [generic_edit(images[i].convert("RGB"), r) for i in idx]
    E0 = embed(model, [images[i] for i in idx], size); Ea = embed(model, a, size); Eb = embed(model, b, size)
    mu = E0.mean(0)
    D = np.concatenate([Ea - E0, Eb - E0, Ea - Eb])
    Sw = D.T @ D / len(D) / 2
    X = E0 - mu
    Sb = X.T @ X / len(X)
    Sw += eps * np.trace(Sw) / len(Sw) * np.eye(len(Sw))
    w, V = eigh(Sb, Sw)
    W = V[:, ::-1][:, :dim]
    return mu.astype(np.float32), W.astype(np.float32)


def project(E, mu, W):
    Z = (np.asarray(E, np.float32) - mu) @ W
    return Z / (np.linalg.norm(Z, axis=1, keepdims=True) + 1e-8)
