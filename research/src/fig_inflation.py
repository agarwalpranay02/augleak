"""Figure: reported vs true accuracy on CIFAR-Aug as the number of copies grows."""
import json, os, sys
import numpy as np, matplotlib.pyplot as plt
sys.path.insert(0, os.path.dirname(__file__))
import figstyle as S

S.use()
RES = "results"


def agg(R, **kw):
    s = [r for r in R if all(r[k] == v for k, v in kw.items())]
    return s


def main(backbone="mobilenetv3"):
    R = [json.loads(l) for l in open(f"{RES}/inflation_cifar_{backbone}.jsonl")]
    ks = [1, 2, 4, 8, 16]
    fig, axes = plt.subplots(2, 3, figsize=(S.COL2, 2.85 * S.SCALE), sharex=True, sharey="row")
    lines = [("acc_random", S.ORANGE, "o", "reported: random split"),
             ("fresh_random_model", S.AQUA, "D", "same model on fresh test images"),
             ("acc_group", S.BLUE, "s", "group split")]
    for r_, (probe, pname) in enumerate((("knn1", "1-NN"), ("linear", "linear probe"))):
        for c_, st in enumerate(("weak", "medium", "strong")):
            ax = axes[r_, c_]
            for key, col, mk, lab in lines:
                m, e = [], []
                for k in ks:
                    v = [x[key] for x in agg(R, probe=probe, strength=st, n_src=2000, k=k)]
                    m.append(np.mean(v)); e.append(1.96 * np.std(v, ddof=1) / np.sqrt(len(v)) if len(v) > 1 else 0)
                m, e = np.array(m), np.array(e)
                ax.fill_between(ks, m - e, m + e, color=col, alpha=0.15, lw=0)
                ax.plot(ks, m, color=col, marker=mk, ms=3, mec="white", mew=0.5, label=lab)
            # gap annotation at k=16
            top = np.mean([x["acc_random"] for x in agg(R, probe=probe, strength=st, n_src=2000, k=16)])
            low = np.mean([x["fresh_random_model"] for x in agg(R, probe=probe, strength=st, n_src=2000, k=16)])
            ax.annotate("", xy=(17.5, low), xytext=(17.5, top), arrowprops=dict(arrowstyle="<->", color=S.INK2, lw=0.7, shrinkA=0, shrinkB=0))
            d_ = (top - low) * 100
            ax.text(19, (top + low) / 2, f"{'+' if d_ >= 0 else '\u2212'}{abs(d_):.0f} pts", color=S.INK, fontsize=6.5, va="center", ha="left")
            ax.set_xscale("log", base=2); ax.set_xticks(ks); ax.set_xticklabels([str(k) for k in ks]); ax.set_xlim(0.85, 30)
            ax.spines["bottom"].set_bounds(1, 16)
            ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda v, _: f"{v:.0%}"))
            if r_ == 0:
                ax.set_title(f"{st} augmentation")
            if c_ == 0:
                ax.set_ylabel(pname)
            if r_ == 1:
                ax.set_xlabel("copies per source image, $k$")
    h, l = axes[0, 0].get_legend_handles_labels()
    fig.legend(h, l, loc="lower center", ncol=3, bbox_to_anchor=(0.5, -0.01), columnspacing=2)
    fig.tight_layout(h_pad=0.6, w_pad=0.8, rect=(0, 0.06, 1, 1))
    S.save(fig, f"fig_inflation_{backbone}" if backbone != "mobilenetv3" else "fig_inflation")


if __name__ == "__main__":
    main(*sys.argv[1:])
