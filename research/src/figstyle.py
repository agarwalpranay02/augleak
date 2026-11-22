import os
"""One visual system for every figure in the paper.

Colours follow a validated categorical order (fixed, never cycled) and are tied to *meaning*, so the
same protocol has the same colour in every figure. Text is always ink, never series colour.
"""
import matplotlib as mpl
import matplotlib.pyplot as plt
from matplotlib import font_manager

INK, INK2, MUTED, GRID = "#0b0b0b", "#52514e", "#8a8984", "#e6e5e0"
BLUE, ORANGE, AQUA, YELLOW, MAGENTA, GREEN, VIOLET, RED = (
    "#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948")

# meaning -> colour (identical across figures)
C = dict(random=ORANGE, group=BLUE, fresh=AQUA, augleak=BLUE, struct=BLUE, sem=MAGENTA,
         phash=YELLOW, phash_d4=VIOLET, exact=MUTED, filter=AQUA, dgroup=VIOLET, naive=ORANGE, oracle=INK2)

COL1, COL2 = 2.7, float(os.environ.get("AUGLEAK_COL2", 5.5))  # \textwidth: 5.5 in (ICLR, NeurIPS), 6.5 in (TMLR)
SCALE = COL2 / 5.5  # figure heights scale with the width
FIGDIR = os.environ.get("AUGLEAK_FIGDIR", os.path.join(os.environ.get("AUGLEAK_OUT", "output"), "figs"))
os.makedirs(FIGDIR, exist_ok=True)


def use():
    # TrueType conversions of Inter (fonts_ttf/), so PDFs embed clean TrueType fonts
    import glob, os
    for f in glob.glob(os.path.join(os.path.dirname(__file__), "..", "fonts_ttf", "*.ttf")):
        font_manager.fontManager.addfont(f)
    mpl.rcParams.update({
        "font.family": "InterTT", "mathtext.fontset": "custom", "mathtext.rm": "InterTT",
        "mathtext.it": "InterTT:italic", "mathtext.bf": "InterTT:bold", "font.size": 7.5, "axes.titlesize": 8, "axes.labelsize": 7.5,
        "xtick.labelsize": 6.8, "ytick.labelsize": 6.8, "legend.fontsize": 6.8,
        "axes.edgecolor": INK2, "axes.labelcolor": INK, "xtick.color": INK2, "ytick.color": INK2,
        "text.color": INK, "axes.linewidth": 0.6, "xtick.major.width": 0.6, "ytick.major.width": 0.6,
        "xtick.major.size": 2.5, "ytick.major.size": 2.5, "axes.spines.top": False, "axes.spines.right": False,
        "axes.grid": True, "grid.color": GRID, "grid.linewidth": 0.5, "axes.axisbelow": True,
        "legend.frameon": False, "lines.linewidth": 1.6, "lines.markersize": 4,
        "pdf.fonttype": 42, "ps.fonttype": 42, "savefig.bbox": "tight", "savefig.pad_inches": 0.02,
        "figure.dpi": 200, "axes.titleweight": "semibold", "axes.titlelocation": "left",
    })


def panel(ax, letter):
    ax.text(-0.02, 1.04, letter, transform=ax.transAxes, fontsize=8.5, fontweight="bold", va="bottom", ha="right")


def save(fig, name):
    fig.savefig(f"{FIGDIR}/{name}.pdf")
    fig.savefig(f"{FIGDIR}/{name}.png", dpi=220)
    plt.close(fig)
