"""Figure: examples found by the audit (all pairs verified by inspection)."""
import json, os, sys, csv, hashlib
import numpy as np, matplotlib.pyplot as plt
from PIL import Image, ImageOps
sys.path.insert(0, os.path.dirname(__file__))
import figstyle as S

S.use()
RES = "results"


def sq(p, n=220):
    im = Image.open(p).convert("RGB")
    return np.asarray(ImageOps.fit(im, (n, n), Image.LANCZOS))


def short(lbl):
    return lbl.lower().replace("potato leaf ", "").replace("potato ", "").replace("corn leaf ", "").replace("corn ", "").replace("leaf ", "")


def main():
    blocks = []
    rA = [q for q in json.load(open(f"{RES}/repeats_leafA_manual.json"))["pairs"] if q["same_leaf"]]
    blocks.append(("a   Leaf-A: repeat shots", [(rA[0]["a"], rA[0]["b"], f"source {os.path.basename(rA[0]['a']).split('_')[1]}", f"source {os.path.basename(rA[0]['b']).split('_')[1]}"), (rA[6]["a"], rA[6]["b"], f"source {os.path.basename(rA[6]['a']).split('_')[1]}", f"source {os.path.basename(rA[6]['b']).split('_')[1]}")]))
    pd = [q for q in json.load(open(f"{RES}/plantdoc_manual.json"))["pairs"] if q["same_photo"]]
    rows = list(csv.DictReader(open("data/manifests/plantdoc.csv")))
    h = {}
    for r in rows:
        h.setdefault(hashlib.md5(open(r["path"], "rb").read()).hexdigest(), []).append(r)
    conf = [v for v in h.values() if len({x["label"] for x in v}) > 1 and len({x["split"] for x in v}) > 1]
    c0 = sorted(conf[3], key=lambda x: x["split"] != "test")
    blocks.append(("b   PlantDoc", [(pd[4]["test"], pd[4]["train"], "test", "train"),
                   (c0[0]["path"], c0[1]["path"], "test", "train")]))
    cv = [q for q in json.load(open(f"{RES}/covid_manual.json"))["pairs"] if q["same_radiograph"]]
    blocks.append(("c   COVID-CXR", [(cv[0]["a"], cv[0]["b"], f"patient {cv[0]['pa'][1:]}", f"patient {cv[0]['pb'][1:]}"),
                                                                    (cv[2]["a"], cv[2]["b"], f"patient {cv[2]['pa'][1:]}", f"patient {cv[2]['pb'][1:]}")]))
    if os.path.exists(f"{RES}/cifar10_manual.json"):
        c10 = [q for q in json.load(open(f"{RES}/cifar10_manual.json"))["pairs"] if q["near_duplicate"]]
        blocks.append(("d   CIFAR-10", [(c10[10]["test"], c10[10]["train"], "test", "train (recoloured)"), (c10[13]["test"], c10[13]["train"], "test", "train (grayscale)")]))
    nb = len(blocks)
    fig = plt.figure(figsize=(S.COL2, 1.8 * S.SCALE))
    outer = fig.add_gridspec(1, nb, wspace=0.10)
    for b, (title, pairs) in enumerate(blocks):
        inner = outer[b].subgridspec(4, 2, height_ratios=[1, 0.13, 1, 0.13], wspace=0.04, hspace=0.04)
        for j, (pa, pb, la, lb) in enumerate(pairs):
            for t, p in enumerate((pa, pb)):
                ax = fig.add_subplot(inner[2 * j, t])
                ax.imshow(sq(p)); ax.axis("off")
                if j == 0 and t == 0:
                    ax.set_title(title, fontsize=6.5, loc="left", pad=3)
            cap = fig.add_subplot(inner[2 * j + 1, :]); cap.axis("off")
            cap.text(0.25, 0.55, la, ha="center", va="center", fontsize=5.6, color=S.INK2, transform=cap.transAxes)
            cap.text(0.75, 0.55, lb, ha="center", va="center", fontsize=5.6, color=S.INK2, transform=cap.transAxes)
    S.save(fig, "fig_audit")


if __name__ == "__main__":
    main()
