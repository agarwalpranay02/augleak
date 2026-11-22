"""Figure: sibling recovery with ground-truth groups (PR curves, calibration, recall per edit)."""
import json, os, sys
import numpy as np, matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
sys.path.insert(0, os.path.dirname(__file__))
import figstyle as S

S.use()
RES = "results"
# key, legend label, colour, line style, width
METH = [("phash_d4", "perceptual hash", S.VIOLET, "-", 1.0),
        ("sem", "ImageNet embedding", S.MAGENTA, "-", 1.0),
        ("inv", "invariant embedding", S.YELLOW, "-", 1.0),
        ("struct", "structure view", S.BLUE, (0, (2.5, 1.5)), 1.1),
        ("pix", "AugLeak (structure + hash)", S.BLUE, "-", 1.8),
        ("all", "AugLeak (+ invariant)", S.AQUA, "-", 1.5)]
SETS = [("leafA", "Leaf-A"), ("leafB", "Leaf-B"), ("cifaraug10-medium", "C-Aug medium")]
PRETTY = {"Gaussian_Blur": "Gauss. blur", "Median_Blur": "median blur", "Unsharp_Mask": "unsharp", "BlackHat": "black-hat",
          "TopHat": "top-hat", "HSV": "HSV", "CLAHE": "CLAHE", "Bilateral": "bilateral", "Grayscale": "gray"}


def main():
    sets = [(k, t) for k, t in SETS if os.path.exists(f"{RES}/detect_{k}.json")]
    fig = plt.figure(figsize=(S.COL2, 3.7 * S.SCALE))
    gs = fig.add_gridspec(2, 4, height_ratios=[1.0, 0.66], hspace=0.78, wspace=0.55)
    for i, (key, title) in enumerate(sets):
        d = json.load(open(f"{RES}/detect_{key}.json"))["methods"]
        ax = fig.add_subplot(gs[0, i])
        rows = []
        for m, lab, col, ls, lw in METH:
            if m not in d:
                continue
            c = d[m]["curve"]; R, P = np.array(c["R"]), np.array(c["P"]); ok = R > 0
            ax.plot(R[ok], P[ok], color=col, ls=ls, lw=lw, label=lab, solid_capstyle="round")
            rows.append((d[m]["AP"], col, m))
        pass
        ax.set_xlim(0, 1); ax.set_ylim(0, 1.02)
        ax.set_xticks([0, .5, 1]); ax.set_yticks([0, .5, 1])
        ax.set_title(f"{'abc'[i]}   {title}", fontsize=7.4)
        ax.set_xlabel("pair recall")
        if i == 0:
            ax.set_ylabel("pair precision")
    # calibration of the pixel views
    axc = fig.add_subplot(gs[0, 3])
    for j, (key, title) in enumerate([("leafA", "Leaf-A"), ("leafB", "Leaf-B"), ("cifaraug10-medium", "C-Aug medium"), ("cifaraug10-strong", "C-Aug strong")]):
        if not os.path.exists(f"{RES}/detect_{key}.json"):
            continue
        d = json.load(open(f"{RES}/detect_{key}.json"))["methods"]
        m = "pix" if "pix" in d else "struct"
        a = [0.0001, 0.001, 0.01]
        fl = [d[m]["parts"][str(x) if str(x) in d[m]["parts"] else f"{x:g}"]["img_false_link"] for x in a]
        axc.plot(a, np.maximum(fl, 2e-5), marker="os^D"[j], ms=3, color=[S.ORANGE, S.AQUA, S.VIOLET, S.MAGENTA][j], mec="white", mew=0.5, lw=1.1, label=title)
    lim = [1e-4, 1e-2]
    axc.plot(lim, lim, color=S.INK2, lw=0.8, ls=(0, (3, 2)))
    axc.text(9e-4, 2.6e-3, "nominal", color=S.INK2, fontsize=5.8, rotation=27, ha="center", va="center")
    axc.set_xscale("log"); axc.set_yscale("log"); axc.set_xlim(7e-5, 1.4e-2); axc.set_ylim(1.2e-5, 3)
    axc.set_yticks([2e-5, 1e-4, 1e-3, 1e-2, 1e-1, 1]); axc.set_yticklabels(["0", r"$10^{-4}$", r"$10^{-3}$", r"$10^{-2}$", r"$10^{-1}$", r"$10^{0}$"])
    axc.yaxis.set_minor_locator(plt.NullLocator())
    axc.set_xlabel(r"$\alpha$"); axc.set_ylabel("false-link rate", labelpad=1)
    axc.set_title("d   calibration", fontsize=7.4)
    axc.legend(fontsize=5.4, loc="upper left", handlelength=1.1, borderaxespad=0.1, ncol=2, columnspacing=0.6)
    # recall per edit, Leaf-B
    axh = fig.add_subplot(gs[1, :])
    d = json.load(open(f"{RES}/detect_leafB.json"))["methods"]; al = "0.001"
    mm = [m for m in METH if m[0] in d]
    ref = "pix" if "pix" in d else "struct"
    vars_ = sorted(d[ref]["parts"][al]["variant_recall"], key=lambda v: -np.mean([d[m[0]]["parts"][al]["variant_recall"][v] for m in mm]))
    Mx = np.array([[d[m[0]]["parts"][al]["variant_recall"][v] for v in vars_] for m in mm])
    cmap = LinearSegmentedColormap.from_list("b", ["#f6f5f1", "#cde2fb", "#6da7ec", "#256abf", "#104281"])
    axh.imshow(Mx, cmap=cmap, vmin=0, vmax=1, aspect="auto")
    axh.set_xticks(range(len(vars_))); axh.set_xticklabels([PRETTY.get(v, v.lower()) for v in vars_], fontsize=6, rotation=30, ha="right", rotation_mode="anchor")
    short_y = {"phash_d4": "pHash", "sem": "ImageNet emb.", "inv": "invariant emb.", "struct": "structure view", "pix": "AugLeak", "all": "AugLeak + inv."}
    axh.set_yticks(range(len(mm))); axh.set_yticklabels([short_y[m[0]] for m in mm], fontsize=6)
    axh.grid(False); axh.tick_params(length=0)
    for s in axh.spines.values():
        s.set_visible(False)
    for (r, c), v in np.ndenumerate(Mx):
        axh.text(c, r, f"{v * 100:.0f}", ha="center", va="center", fontsize=5.4, color="white" if v > 0.55 else S.INK)
    axh.set_title(r"e   Leaf-B: share of each edit's copies grouped with a true sibling ($\alpha=10^{-3}$)", fontsize=7.4)
    h, l = fig.axes[0].get_legend_handles_labels()
    fig.legend(h, l, loc="upper center", ncol=3, bbox_to_anchor=(0.5, 1.06), columnspacing=1.6, handlelength=2.0, fontsize=6.4)
    S.save(fig, "fig_detect")


if __name__ == "__main__":
    main()
