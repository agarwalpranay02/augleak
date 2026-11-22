"""Build CSV manifests (path, label, group, extra) for every dataset used in the paper.

Ground-truth augmentation groups come from file names where the release encodes them
(the two leaf datasets), from patient ids (COVID-CXR) and are unknown for PlantDoc.
"""
import csv, glob, os, re, sys
from collections import Counter

# Raw datasets live under AUGLEAK_RAW (default ./raw), one folder per dataset as named below.
ROOT = os.environ.get("AUGLEAK_RAW", "raw")
OUT = "data/manifests"
os.makedirs(OUT, exist_ok=True)


def write(name, rows, fields):
    with open(f"{OUT}/{name}.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    print(name, len(rows), "rows,", len({r['group'] for r in rows}) if 'group' in fields else '', "groups,",
          Counter(r['label'] for r in rows))


# Leaf-A: 15 variants per source photo, names <cls>_<id>_v<k>.jpg
rows = []
for p in sorted(glob.glob(f"{ROOT}/leafA/**/*.jpg", recursive=True)):
    m = re.match(r"(.+)_(\d+)_v(\d+)\.jpg$", os.path.basename(p))
    lab = os.path.basename(os.path.dirname(p))
    rows.append(dict(path=p, label=lab, group=f"{lab}/{m.group(2)}", variant=f"v{m.group(3)}"))
write("leafA", rows, ["path", "label", "group", "variant"])

# Leaf-B: 16 named transforms per source photo, names <cls>_<id>_<Transform>.jpg
rows = []
for p in sorted(glob.glob(f"{ROOT}/leafB/**/*.jpg", recursive=True)):
    lab = os.path.basename(os.path.dirname(p))
    m = re.match(rf"{re.escape(lab)}_(\d+)_(.+)\.jpg$", os.path.basename(p))
    rows.append(dict(path=p, label=lab, group=f"{lab}/{m.group(1)}", variant=m.group(2)))
write("leafB", rows, ["path", "label", "group", "variant"])

# PlantDoc: official train/test folders, no group information
rows = []
for split in ("train", "test"):
    for p in sorted(glob.glob(f"{ROOT}/pratikkayal/plantdoc-dataset/{split}/*/*")):
        if p.lower().endswith((".jpg", ".jpeg", ".png")):
            rows.append(dict(path=p, label=os.path.basename(os.path.dirname(p)), split=split))
write("plantdoc", rows, ["path", "label", "split"])

# COVID-CXR: frontal X-rays only; binary COVID-19 vs other finding; group = patient id
rows = []
for r in csv.DictReader(open(f"{ROOT}/ieee8023/covid-chestxray-dataset/metadata.csv")):
    if r["modality"] != "X-ray" or r["view"] not in ("PA", "AP", "AP Supine", "AP Erect") or r["folder"] != "images":
        continue
    if r["finding"] in ("todo", ""):
        continue
    p = f"{ROOT}/ieee8023/covid-chestxray-dataset/images/{r['filename']}"
    if not os.path.exists(p):
        continue
    lab = "covid" if "COVID-19" in r["finding"] else "other"
    rows.append(dict(path=p, label=lab, group=f"p{r['patientid']}", variant=r["offset"], finding=r["finding"]))
write("covidcxr", rows, ["path", "label", "group", "variant", "finding"])

# CIFAR-10 official train/test (image folders)
rows = []
for split in ("train", "test"):
    for p in sorted(glob.glob(f"{ROOT}/yoongikim/cifar-10-images/{split}/*/*.jpg")):
        rows.append(dict(path=p, label=os.path.basename(os.path.dirname(p)), split=split))
write("cifar10", rows, ["path", "label", "split"])

# Brain tumour MRI (Training / Testing folders), and a 15-class subset of Fruits-360 (Training / Test)
for name, root, splits in (("braintumor", f"{ROOT}/sartajbhuvaji/brain-tumor-classification-dataset", (("Training", "train"), ("Testing", "test"))),
                           ("fruits360", f"{ROOT}/horea94/fruit-images-dataset", (("Training", "train"), ("Test", "test")))):
    rows = []
    for folder, split in splits:
        for p in sorted(glob.glob(f"{root}/{folder}/*/*")):
            if p.lower().endswith((".jpg", ".jpeg", ".png")):
                rows.append(dict(path=p, label=os.path.basename(os.path.dirname(p)), split=split))
    write(name, rows, ["path", "label", "split"])
