"""Reference outputs of the Python tool (cli/) on the bundled demo data, for src/core/parity.test.ts.

    pip install -r cli/requirements.txt
    python scripts/make_fixtures.py && npx vitest run
"""
import csv, json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); APP = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(APP, "cli")); sys.path.insert(0, os.path.join(APP, "cli", "src"))
import augleak_cli as C, detector as D

root = os.path.join(APP, "public", "demo", "fruits360"); out = os.path.join(APP, "fixtures")
os.makedirs(out, exist_ok=True)
tr, te = C.list_images(f"{root}/train"), C.list_images(f"{root}/test")
meta, buf = [], bytearray()
for p, c in tr + te:
    im = Image.open(p).convert("RGBA")
    meta.append(dict(path=os.path.relpath(p, root), label=c, w=im.width, h=im.height, off=len(buf)))
    buf += np.asarray(im, np.uint8).tobytes()
open(f"{out}/pixels.bin", "wb").write(bytes(buf))
gtr, gte = C.views([p for p, _ in tr]), C.views([p for p, _ in te])
V = C.scores(gte, gtr)
classes = sorted({c for _, c in tr + te})
ytr = np.array([classes.index(c) for _, c in tr]); yte = np.array([classes.index(c) for _, c in te])
V["structure"].float().numpy().tofile(f"{out}/S.f32"); V["hash"].float().numpy().tofile(f"{out}/H.f32")
C.pvalues(V, yte, ytr, False).numpy().astype(np.float64).tofile(f"{out}/P.f64")
g0 = gtr[0]
np.asarray(g0, np.float32).tofile(f"{out}/g0.f32")
D.structure_views([g0])[1][:, 0].numpy().astype(np.float32).tofile(f"{out}/V0.f32")
D.hash_views([g0])[:, 0].numpy().astype(np.float32).tofile(f"{out}/h0.f32")
json.dump(dict(items=meta, ntrain=len(tr), ntest=len(te), classes=classes), open(f"{out}/meta.json", "w"))

class A: pass
a = A(); a.train, a.test, a.alpha, a.out = f"{root}/train", f"{root}/test", 1e-3, "/tmp/augleak_ref_test"; C.cmd_test(a)
json.dump([os.path.relpath(r["test_image"], root) for r in csv.DictReader(open(f"{a.out}/flagged.csv"))], open(f"{out}/flagged_ref.json", "w"))
s = A(); s.data, s.alpha, s.out = f"{root}/train", 1e-3, "/tmp/augleak_ref_scan"; C.cmd_scan(s)
rt = f"{root}/train"
json.dump(sorted("|".join(sorted([os.path.relpath(r["image_a"], rt), os.path.relpath(r["image_b"], rt)])) for r in csv.DictReader(open(f"{s.out}/links.csv"))), open(f"{out}/scan_links_ref.json", "w"))
print("fixtures written to", out)
