"""Repeat shots: are distinct source photographs in a release actually the same physical object?
Runs the structure view on one canonical copy per source (Leaf-A: v1, Leaf-B: Original) and lists
cross-source links; candidate pairs are rendered for manual inspection."""
import csv, json, sys, os
import numpy as np, torch
from PIL import Image, ImageDraw
from scipy.stats import gumbel_r
sys.path.insert(0, os.path.dirname(__file__))
import detector as D
from exp_audit import struct_matrix, zscores

name, canon = sys.argv[1], sys.argv[2]
rows = [r for r in csv.DictReader(open(f"data/manifests/{name}.csv")) if r["variant"] == canon]
labs = sorted({r["label"] for r in rows}); y = np.array([labs.index(r["label"]) for r in rows])
g = [D.gray64(Image.open(r["path"])) for r in rows]
S = struct_matrix(g, g); Z = zscores(S, y, y).float(); Z.fill_diagonal_(-1e9)
other = torch.from_numpy(y[:, None] != y[None, :])
loc, scale = gumbel_r.fit(Z.masked_fill(~other, -1e9).max(1).values.numpy().astype(np.float64))
best, bj = Z.masked_fill(other, -1e9).max(1)
p = -np.expm1(-np.exp(-(best.numpy().astype(np.float64) - loc) / scale))
res = dict(name=name, n_sources=len(rows), gumbel=[loc, scale],
           linked={a: int((p < a).sum()) for a in (1e-2, 1e-3, 1e-4)},
           pairs=[dict(p=float(p[i]), a=rows[i]["path"], b=rows[int(bj[i])]["path"], s=float(S[i, int(bj[i])])) for i in np.argsort(p)[:120]])
# exact duplicates across classes among the canonical copies
import hashlib
h = {}
for r in rows: h.setdefault(hashlib.md5(open(r["path"], "rb").read()).hexdigest(), []).append(r)
res["exact_cross_class_sources"] = [[x["path"] for x in v] for v in h.values() if len({x["label"] for x in v}) > 1]
res["exact_same_class_sources"] = [[x["path"] for x in v] for v in h.values() if len(v) > 1 and len({x["label"] for x in v}) == 1]
json.dump(res, open(f"results/repeats_{name}.json", "w"), indent=1)
print(name, res["linked"], "exact cross", len(res["exact_cross_class_sources"]), "exact same", len(res["exact_same_class_sources"]))
# render the top 60 pairs (unique, i<j)
seen, show = set(), []
for q in res["pairs"]:
    key = tuple(sorted((q["a"], q["b"])))
    if key not in seen:
        seen.add(key); show.append(q)
W = Image.new("RGB", (10 * 130, 6 * 275), "white"); Dr = ImageDraw.Draw(W)
for i, q in enumerate(show[:60]):
    r_, c = divmod(i, 10)
    for j, k in enumerate("ab"):
        W.paste(Image.open(q[k]).convert("RGB").resize((125, 125)), (c * 130, r_ * 275 + j * 127))
    Dr.text((c * 130 + 2, r_ * 275 + 256), f"#{i} {q['p']:.0e}", fill="black")
W.save(f"/tmp/repeats_{name}.png")
json.dump(show[:60], open(f"results/repeats_{name}_shown.json", "w"), indent=1)
