"""E5: end-to-end fine-tuning (the setting most papers report), random vs group split.

Fine-tunes an ImageNet MobileNetV3-Large on a pre-augmented release. For CIFAR-Aug the same model is
also scored on fresh CIFAR-10 test images, so the reported (random-split) accuracy can be compared
with true generalisation. Images are preloaded once at the training resolution.
"""
import argparse, csv, json, os, sys, time
import numpy as np, torch, torch.nn as nn
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
import backbones
from leaklib import random_split, group_split, leaked_mask

torch.set_num_threads(2)
RES = "results"
MEAN = torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1); STD = torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1)


def preload(name, size, k=None, strength=None):
    if name == "cifar-aug":
        meta = np.load("data/cifar_aug.npz")
        X = meta[strength][:, :k]; S = X.shape[0]
        imgs = X.reshape(-1, 32, 32, 3); y = np.repeat(meta["y"], k); g = np.repeat(np.arange(S), k).astype(str)
        rs = lambda a: np.asarray(Image.fromarray(a).resize((size, size), Image.BILINEAR))
        T = torch.from_numpy(np.stack([rs(a) for a in imgs])).permute(0, 3, 1, 2).contiguous()
        Tf = torch.from_numpy(np.stack([rs(a) for a in meta["fresh"]])).permute(0, 3, 1, 2).contiguous()
        return T, y, g, (Tf, meta["fresh_y"]), 10
    rows = list(csv.DictReader(open(f"data/manifests/{name}.csv")))
    labs = sorted({r["label"] for r in rows})
    def ld(p):
        im = Image.open(p); im.draft("RGB", (size * 2, size * 2))
        return np.asarray(im.convert("RGB").resize((size, size), Image.BILINEAR))
    T = torch.from_numpy(np.stack([ld(r["path"]) for r in rows])).permute(0, 3, 1, 2).contiguous()
    return T, np.array([labs.index(r["label"]) for r in rows]), np.array([r["group"] for r in rows]), None, len(labs)


def norm(xb):
    return (xb.float() / 255. - MEAN) / STD


def evaluate(model, T, y, bs=128):
    model.eval(); out = []
    with torch.inference_mode():
        for i in range(0, len(T), bs):
            out.append(model(norm(T[i:i + bs])).argmax(1))
    return (torch.cat(out).numpy() == y)


def train(T, y, tr, C, epochs, seed, lr=1e-3, bs=64, arch="mobilenetv3"):
    torch.manual_seed(seed)
    m = backbones.load(arch)
    m.reset_classifier(C)
    opt = torch.optim.AdamW(m.parameters(), lr=lr, weight_decay=1e-4)
    steps = epochs * ((len(tr) + bs - 1) // bs)
    sch = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=lr, total_steps=steps, pct_start=0.15)
    yt = torch.from_numpy(y).long(); rng = np.random.default_rng(seed)
    for ep in range(epochs):
        m.train(); perm = rng.permutation(tr); t = time.time(); tot = 0
        for i in range(0, len(perm), bs):
            b = torch.from_numpy(perm[i:i + bs])
            xb = T[b]
            flip = torch.rand(len(b)) < 0.5
            xb[flip] = xb[flip].flip(3)           # the usual train-time flip
            loss = nn.functional.cross_entropy(m(norm(xb)), yt[b], label_smoothing=0.1)
            opt.zero_grad(); loss.backward(); opt.step(); sch.step(); tot += loss.item() * len(b)
        print(f"   ep{ep} loss={tot / len(perm):.3f} {time.time() - t:.0f}s", flush=True)
    return m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True); ap.add_argument("--size", type=int, default=128)
    ap.add_argument("--k", type=int, default=8); ap.add_argument("--strength", default="medium")
    ap.add_argument("--epochs", type=int, default=6); ap.add_argument("--seeds", default="0")
    ap.add_argument("--splits", default="random,group"); ap.add_argument("--arch", default="mobilenetv3")
    a = ap.parse_args()
    T, y, g, fresh, C = preload(a.name, a.size, a.k, a.strength)
    print("loaded", tuple(T.shape), flush=True)
    tag = a.name if a.name != "cifar-aug" else f"cifar-aug-{a.strength}-k{a.k}"
    for seed in map(int, a.seeds.split(",")):
        rng = np.random.default_rng(seed)
        sp = {"random": random_split(len(y), 0.2, rng), "group": group_split(g, 0.2, rng)}
        for s in a.splits.split(","):
            tr, te = sp[s]; t = time.time()
            m = train(T, y, tr, C, a.epochs, seed, arch=a.arch)
            c = evaluate(m, T[te], y[te]); L = leaked_mask(g, tr, te)
            row = dict(dataset=tag, arch=a.arch, split=s, seed=seed, epochs=a.epochs, size=a.size, acc=float(c.mean()),
                       q=float(L.mean()), a_L=float(c[L].mean()) if L.any() else None,
                       a_U=float(c[~L].mean()) if (~L).any() else None, train_minutes=(time.time() - t) / 60)
            if fresh is not None:
                row["fresh_acc"] = float(evaluate(m, fresh[0], fresh[1]).mean())
            print(row, flush=True)
            with open(f"{RES}/finetune.jsonl", "a") as f:
                f.write(json.dumps(row) + "\n")


if __name__ == "__main__":
    main()
