"""Extract frozen-backbone embeddings.

Sources: a manifest CSV (column `path`) or arrays inside cifar_aug.npz.
--d4 additionally stores the orbit-averaged embedding over the 8 dihedral transforms
(identity, 3 rotations, 4 reflections). That embedding is exactly invariant to flips and
90-degree rotations, which are the most common geometric variants in pre-augmented releases.
"""
import argparse, csv, os, sys, time
import numpy as np, torch, timm
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
import backbones

torch.set_num_threads(2)


def d4(x):  # x: B,C,H,W -> list of 8 tensors
    out = []
    for k in range(4):
        r = torch.rot90(x, k, (2, 3))
        out += [r, torch.flip(r, (3,))]
    return out


class Src(torch.utils.data.Dataset):
    def __init__(self, items, size, mean, std, from_array):
        self.items, self.size, self.from_array = items, size, from_array
        self.mean = torch.tensor(mean).view(3, 1, 1); self.std = torch.tensor(std).view(3, 1, 1)

    def __len__(self):
        return len(self.items)

    def __getitem__(self, i):
        it = self.items[i]
        if self.from_array:
            im = Image.fromarray(it)
        else:
            im = Image.open(it); im.draft("RGB", (self.size * 2, self.size * 2))
        im = im.convert("RGB").resize((self.size, self.size), Image.BILINEAR)
        x = torch.from_numpy(np.asarray(im).copy()).permute(2, 0, 1).float() / 255.
        return (x - self.mean) / self.std


def run(model, items, size, from_array, use_d4, bs=64):
    cfg = timm.data.resolve_data_config({}, model=model)
    dl = torch.utils.data.DataLoader(Src(items, size, cfg["mean"], cfg["std"], from_array),
                                     batch_size=bs, num_workers=1)
    base, orb = [], []
    t = time.time()
    with torch.inference_mode():
        for j, x in enumerate(dl):
            if use_d4:
                fs = [model(v) for v in d4(x)]
                base.append(fs[0].half().numpy()); orb.append(torch.stack(fs).mean(0).half().numpy())
            else:
                base.append(model(x).half().numpy())
            if j % 50 == 0:
                print(f"  {j * bs}/{len(items)} {time.time() - t:.0f}s", flush=True)
    return np.concatenate(base), (np.concatenate(orb) if use_d4 else None)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest"); ap.add_argument("--npz"); ap.add_argument("--keys", default="weak,medium,strong,fresh")
    ap.add_argument("--backbone", default="effnet_b0"); ap.add_argument("--size", type=int, default=128)
    ap.add_argument("--d4", action="store_true"); ap.add_argument("--subset", type=int, default=0)
    ap.add_argument("--name", required=True)
    a = ap.parse_args()
    out = f"features/{a.name}_{a.backbone}_{a.size}{'_d4' if a.d4 else ''}.npz"
    if os.path.exists("SKIP_" + a.backbone):
        print("skipped by marker", a.backbone); return
    if os.path.exists(out):
        print("exists, skipping", out); return
    model = backbones.load(a.backbone)
    res = {}
    if a.manifest:
        paths = [r["path"] for r in csv.DictReader(open(a.manifest))]
        b, o = run(model, paths, a.size, False, a.d4)
        res["feat"] = b
        if o is not None: res["feat_d4"] = o
    else:
        d = np.load(a.npz)
        for k in a.keys.split(","):
            X = d[k]
            if a.subset and X.ndim == 5: X = X[:a.subset]
            shp = X.shape[:-3]
            b, o = run(model, list(X.reshape(-1, 32, 32, 3)), a.size, True, a.d4)
            res[k] = b.reshape(*shp, -1)
            if o is not None: res[k + "_d4"] = o.reshape(*shp, -1)
    np.savez(out, **res)
    print("saved", out, {k: v.shape for k, v in res.items()})


if __name__ == "__main__":
    main()
