"""CIFAR-Aug: a controlled pre-augmented release built from CIFAR-10.

For each of N source images we write V variants (variant 0 is the untouched original,
as in real pre-augmented releases) at three augmentation strengths. A disjoint pool of
fresh CIFAR-10 *test* images gives the true generalisation accuracy, so every leaked
estimate can be compared with ground truth.
"""
import argparse, csv, random
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps


def photometric(im, r, amt):
    im = ImageEnhance.Brightness(im).enhance(1 + r.uniform(-amt, amt))
    im = ImageEnhance.Contrast(im).enhance(1 + r.uniform(-amt, amt))
    im = ImageEnhance.Color(im).enhance(1 + r.uniform(-amt, amt))
    return im


def geometric(im, r, rot, scale):
    if r.random() < 0.5:
        im = ImageOps.mirror(im)
    if rot:
        im = im.rotate(r.uniform(-rot, rot), resample=Image.BILINEAR, fillcolor=(0, 0, 0))
    if scale < 1:
        s = r.uniform(scale, 1.0)
        w = int(round(32 * s)); x = r.randint(0, 32 - w); y = r.randint(0, 32 - w)
        im = im.crop((x, y, x + w, y + w)).resize((32, 32), Image.BILINEAR)
    return im


FILTERS = [
    lambda im, r: ImageOps.grayscale(im).convert("RGB"),
    lambda im, r: im.filter(ImageFilter.GaussianBlur(r.uniform(0.6, 1.2))),
    lambda im, r: im.filter(ImageFilter.SHARPEN),
    lambda im, r: ImageOps.equalize(im),
    lambda im, r: ImageOps.solarize(im, r.randint(96, 192)),
    lambda im, r: ImageOps.posterize(im, r.randint(2, 4)),
    lambda im, r: im.filter(ImageFilter.EDGE_ENHANCE_MORE),
    lambda im, r: im.rotate(90 * r.randint(1, 3)),
    lambda im, r: ImageOps.flip(im),
    lambda im, r: Image.fromarray(np.clip(np.asarray(im, np.int16) + np.array([r.randint(-40, 40) for _ in range(3)]),
                                          0, 255).astype(np.uint8)),
]


def augment(im, r, strength):
    if strength == "weak":        # small photometric change + flip: what most releases call augmentation
        im = photometric(im, r, 0.15)
        return ImageOps.mirror(im) if r.random() < 0.5 else im
    if strength == "medium":      # standard train-time recipe: flip, rotate, crop, colour jitter
        return photometric(geometric(im, r, 20, 0.75), r, 0.3)
    # strong: medium plus one or two hand-crafted filters, as in releases with CLAHE/blur/grayscale variants
    im = photometric(geometric(im, r, 30, 0.6), r, 0.4)
    for f in r.sample(FILTERS, r.randint(1, 2)):
        im = f(im, r)
    return im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n_per_class", type=int, default=200)
    ap.add_argument("--variants", type=int, default=16)
    ap.add_argument("--fresh_per_class", type=int, default=300)
    ap.add_argument("--out", default="data/cifar_aug.npz")
    a = ap.parse_args()
    rows = list(csv.DictReader(open("data/manifests/cifar10.csv")))
    classes = sorted({x["label"] for x in rows})
    rng = random.Random(0)
    src, fresh = [], []
    for c in classes:
        tr = [x for x in rows if x["label"] == c and x["split"] == "train"]
        te = [x for x in rows if x["label"] == c and x["split"] == "test"]
        src += rng.sample(tr, a.n_per_class)
        fresh += rng.sample(te, a.fresh_per_class)
    load = lambda p: Image.open(p).convert("RGB")
    out = {}
    for s in ("weak", "medium", "strong"):
        X = np.zeros((len(src), a.variants, 32, 32, 3), np.uint8)
        for i, x in enumerate(src):
            im = load(x["path"]); r = random.Random(1000003 * ("weak", "medium", "strong").index(s) + i)
            X[i, 0] = np.asarray(im)
            for v in range(1, a.variants):
                X[i, v] = np.asarray(augment(im, r, s))
        out[s] = X
    out["y"] = np.array([classes.index(x["label"]) for x in src])
    out["fresh"] = np.stack([np.asarray(load(x["path"])) for x in fresh])
    out["fresh_y"] = np.array([classes.index(x["label"]) for x in fresh])
    out["classes"] = np.array(classes)
    np.savez_compressed(a.out, **out)
    print({k: v.shape for k, v in out.items()})


if __name__ == "__main__":
    main()
