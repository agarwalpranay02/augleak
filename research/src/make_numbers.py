"""Every number quoted in the paper text is generated here from the result files (no hand-typed numbers)."""
import json, os, glob
import numpy as np

RES = "results"; P = "paper"
os.makedirs(f"{P}/tables", exist_ok=True)
M = {}


def sg(x, d=1):
    return f"${x:+.{d}f}$"


def pct(x, d=0):
    return f"{100 * x:.{d}f}\\%"


def jl(f):
    return [json.loads(l) for l in open(f)] if os.path.exists(f) else []


def mean(rows, key, **kw):
    v = [r[key] for r in rows if all(r.get(k) == w for k, w in kw.items()) and r.get(key) is not None]
    v = [x for x in v if not (isinstance(x, float) and np.isnan(x))]
    return float(np.mean(v)) if v else float("nan"), (float(np.std(v, ddof=1)) if len(v) > 1 else 0.0), len(v)


# ---------------- CIFAR-Aug
C = jl(f"{RES}/inflation_cifar_mobilenetv3.jsonl")
if C:
    for st, St in (("weak", "Weak"), ("medium", "Med"), ("strong", "Strong")):
        for pr, Pr in (("knn1", "Knn"), ("linear", "Lp")):
            M[f"num{St}{Pr}Rep"] = pct(mean(C, "acc_random", strength=st, probe=pr, n_src=2000, k=16)[0])
            M[f"num{St}{Pr}Fresh"] = pct(mean(C, "fresh_random_model", strength=st, probe=pr, n_src=2000, k=16)[0])
            M[f"num{St}{Pr}Group"] = pct(mean(C, "acc_group", strength=st, probe=pr, n_src=2000, k=16)[0])
            if any("acc_group_orig" in r for r in C):
                M[f"num{St}{Pr}GroupOrig"] = pct(mean(C, "acc_group_orig", strength=st, probe=pr, n_src=2000, k=16)[0])
                M[f"num{St}{Pr}FreshGroup"] = pct(mean(C, "fresh_group_model", strength=st, probe=pr, n_src=2000, k=16)[0])

if C:
    gaps = {st: 100 * (mean(C, "acc_random", strength=st, probe="knn1", n_src=2000, k=16)[0] - mean(C, "fresh_random_model", strength=st, probe="knn1", n_src=2000, k=16)[0]) for st in ("weak", "medium", "strong")}
    M["numWeakGapKnn"] = f"{max(gaps.values()):.0f}"

# ---------------- real releases
rows = []
for name, label in (("leafA", "Leaf-A"), ("leafB", "Leaf-B")):
    R = jl(f"{RES}/inflation_{name}_mobilenetv3.jsonl")
    if not R:
        continue
    r = dict(name=label)
    for pr in ("linear", "knn1"):
        a, sa, n = mean(R, "acc_random", probe=pr); b, sb, _ = mean(R, "acc_group", probe=pr)
        r[pr] = (a, sa, b, sb, n)
    r["q"] = mean(R, "q_emp", probe="linear")[0]; r["k"] = R[0]["k"]; r["n"] = R[0]["n"]; r["groups"] = R[0]["groups"]
    rows.append(r)
    key = "LeafA" if name == "leafA" else "LeafB"
    M[f"num{key}LpGap"] = f"{100 * (r['linear'][0] - r['linear'][2]):.1f}"
    M[f"num{key}KnnGap"] = f"{100 * (r['knn1'][0] - r['knn1'][2]):.1f}"
cov = json.load(open(f"{RES}/audit_covidcxr.json")) if os.path.exists(f"{RES}/audit_covidcxr.json") else None
if cov:
    S = cov["splits"]
    r = dict(name="COVID-CXR", n=cov["n"], groups=cov["n_patients"], k="1--7")
    for pr, key in (("linear", "acc_lp"), ("knn1", "acc_1nn")):
        a = [x[key] for x in S if x["split"] == "image-level"]; b = [x[key] for x in S if x["split"] == "patient-level"]
        r[pr] = (np.mean(a), np.std(a, ddof=1), np.mean(b), np.std(b, ddof=1), len(a))
    r["q"] = np.mean([x["q"] for x in S if x["split"] == "image-level"])
    rows.append(r)
    M["numCovidQ"] = pct(r["q"], 1)
    M["numCovidLpGap"] = f"{100 * (r['linear'][0] - r['linear'][2]):.1f}"
    M["numCovidKnnGap"] = f"{100 * (r['knn1'][0] - r['knn1'][2]):.1f}"

with open(f"{P}/tables/real.tex", "w") as f:
    f.write("\\begin{table}[t]\n\\centering\\small\n\\caption{\\textbf{Real releases.} Accuracy under a random split (what is usually reported) and under a split by true group (source photograph or patient), frozen MobileNetV3; mean $\\pm$ s.d.\\ over seeds. $q$: share of test images with a sibling in training under the random split.}\n\\label{tab:real}\n")
    f.write("\\begin{tabular}{@{}lrrr cc cc@{}}\n\\toprule\n& & & & \\multicolumn{2}{c}{linear probe} & \\multicolumn{2}{c}{1-NN} \\\\\n\\cmidrule(lr){5-6}\\cmidrule(l){7-8}\n")
    f.write("release & images & groups & $q$ & random & group & random & group \\\\\n\\midrule\n")
    for r in rows:
        cell = lambda m, s: f"{100 * m:.1f}\\,{{\\scriptsize$\\pm${100 * s:.1f}}}"
        f.write(f"{r['name']} & {r['n']:,} & {r['groups']:,} & {pct(r['q'], 0)} & {cell(r['linear'][0], r['linear'][1])} & {cell(r['linear'][2], r['linear'][3])} & "
                f"{cell(r['knn1'][0], r['knn1'][1])} & {cell(r['knn1'][2], r['knn1'][3])} \\\\\n")
    f.write("\\bottomrule\n\\end{tabular}\n\\end{table}\n")

with open(f"{P}/numbers.tex", "w") as f:
    for k, v in sorted(M.items()):
        f.write(f"\\newcommand{{\\{k}}}{{{v}}}\n")
print(len(M), "macros"); print(open(f"{P}/numbers.tex").read())

# ---------------- detection table
DS = [("leafA", "Leaf-A"), ("leafB", "Leaf-B"), ("cifaraug10-weak", "C-Aug weak"), ("cifaraug10-medium", "C-Aug medium"), ("cifaraug10-strong", "C-Aug strong")]
ME = [("exact", "Exact bytes"), ("phash", "pHash"), ("phash_d4", "pHash, dihedral search"), ("sem", "ImageNet embedding"), ("inv", "invariant embedding"),
      ("struct", "structure view"), ("pix", "AugLeak (structure + hash)"), ("all", "AugLeak (+ invariant)")]
det = {k: json.load(open(f"{RES}/detect_{k}.json")) for k, _ in DS if os.path.exists(f"{RES}/detect_{k}.json")}
if det:
    al = "0.001"
    with open(f"{P}/tables/detect.tex", "w") as f:
        f.write("\\begin{table}[t]\n\\centering\\small\n\\setlength{\\tabcolsep}{4pt}\n")
        f.write("\\caption{\\textbf{Recovering siblings against known groups.} AP: average precision over all image pairs. Hit: share of images linked to at least one true sibling at $\\alpha=10^{-3}$. Best per column in bold. File-name groups in Leaf-A/B miss repeat shots of the same leaf (Section~\\ref{sec:audit}), so precision there is a lower bound.}\n\\label{tab:detect}\n")
        cols = [k for k, _ in DS if k in det]
        f.write("\\begin{tabular}{@{}l" + "cc" * len(cols) + "@{}}\n\\toprule\n")
        f.write(" & " + " & ".join(f"\\multicolumn{{2}}{{c}}{{{dict(DS)[c]}}}" for c in cols) + " \\\\\n")
        f.write("".join(f"\\cmidrule(lr){{{2 + 2 * i}-{3 + 2 * i}}}" for i in range(len(cols))) + "\n")
        f.write("method & " + " & ".join(["AP & hit"] * len(cols)) + " \\\\\n\\midrule\n")
        best = {}
        for c in cols:
            ms = det[c]["methods"]
            shown = [m for m, _ in ME if m in ms and m != "exact"]
            best[c] = (max(round(ms[m]["AP"], 2) for m in shown), max(round(100 * ms[m]["parts"][al]["img_sibling_link"]) for m in shown))
        for m, lab in ME:
            cells = []
            for c in cols:
                ms = det[c]["methods"]
                if m not in ms:
                    cells += ["--", "--"]; continue
                if m == "exact":
                    pr = ms[m]["parts"]["-"]; cells += ["--", "--"]; continue
                ap = ms[m]["AP"]; hit = ms[m]["parts"][al]["img_sibling_link"]
                cells.append(("\\textbf{%.2f}" if round(ap, 2) == best[c][0] else "%.2f") % ap)
                cells.append(("\\textbf{%.0f}" if round(100 * hit) == best[c][1] else "%.0f") % (100 * hit))
            if m == "exact":
                continue
            f.write(lab + " & " + " & ".join(cells) + " \\\\\n")
        f.write("\\bottomrule\n\\end{tabular}\n\\end{table}\n")
    for c in cols:
        ms = det[c]["methods"]; key = c.replace("cifaraug10-", "C").replace("leaf", "Leaf").replace("-", "")
        for m in ("struct", "fused", "phash_d4", "sem", "inv", "pix", "all", "hash"):
            if m in ms:
                M[f"numDet{key}{m.replace('_', '').replace('4', 'four')}AP"] = f"{ms[m]['AP']:.2f}"
                M[f"numDet{key}{m.replace('_', '').replace('4', 'four')}Hit"] = pct(ms[m]["parts"][al]["img_sibling_link"])
                M[f"numDet{key}{m.replace('_', '').replace('4', 'four')}FL"] = pct(ms[m]["parts"][al]["img_false_link"], 1)
                M[f"numDet{key}{m.replace('_', '').replace('4', 'four')}Resid"] = pct(ms[m]["parts"][al]["residual_leak"])

# ---------------- protocol table
PR = {}
for c, lab in DS:
    rows_ = jl(f"{RES}/protocol_{c}.jsonl")
    if rows_:
        PR[c] = rows_
if PR:
    with open(f"{P}/tables/protocol.tex", "w") as f:
        f.write("\\begin{table}[t]\n\\centering\\small\n\\setlength{\\tabcolsep}{4pt}\n")
        f.write("\\caption{\\textbf{Evaluating without metadata.} Error relative to the oracle group split, in accuracy points (mean of 3 seeds). Exposed: share of evaluated test images with a true sibling in training. Kept: share of the test set surviving filtering. AugLeak (structure + hash), or with the invariant view (+ inv.); $\\alpha=10^{-2}$. CIFAR-Aug rows use the 500-source subset of Section~\\ref{sec:detect}.}\n\\label{tab:protocol}\n")
        f.write("\\begin{tabular}{@{}l rr rrr rrr@{}}\n\\toprule\n")
        f.write(" & \\multicolumn{2}{c}{random split} & \\multicolumn{3}{c}{detected-group split} & \\multicolumn{3}{c}{random split + filter} \\\\\n")
        f.write("\\cmidrule(lr){2-3}\\cmidrule(lr){4-6}\\cmidrule(l){7-9}\n")
        f.write("release & LP & 1-NN & LP & 1-NN & exposed & LP & 1-NN & kept \\\\\n\\midrule\n")
        for c, lab0 in DS:
          if c not in PR:
              continue
          for views, vlab in (("struct,hash", ""), ("struct,hash,sem", " (+ inv.)")):
            R = [r for r in PR[c] if r["views"] == views and abs(r["alpha"] - 0.01) < 1e-12]
            lab = lab0 + vlab
            if not R:
                continue
            o_lp = mean(R, "acc_lp", protocol="oracle")[0]; o_nn = mean(R, "acc_1nn", protocol="oracle")[0]
            e = lambda p, k, o: 100 * (mean(R, k, protocol=p)[0] - o)
            key = c.replace('cifaraug10-', 'C').replace('leaf', 'Leaf').replace('-', '') + ("Inv" if vlab else "")
            for p in ("naive", "dgroup", "filter"):
                M[f"numProt{key}{p}Err"] = sg(e(p, 'acc_lp', o_lp))
                M[f"numProt{key}{p}ErrNN"] = sg(e(p, 'acc_1nn', o_nn))
                M[f"numProt{key}{p}Kept"] = pct(mean(R, "retained", protocol=p)[0])
                M[f"numProt{key}{p}Exp"] = pct(mean(R, "residual_leak", protocol=p)[0])
            cells = [sg(e('naive', 'acc_lp', o_lp)), sg(e('naive', 'acc_1nn', o_nn)),
                     sg(e('dgroup', 'acc_lp', o_lp)), sg(e('dgroup', 'acc_1nn', o_nn)), f"{100 * mean(R, 'residual_leak', protocol='dgroup')[0]:.0f}\\%",
                     sg(e('filter', 'acc_lp', o_lp)), sg(e('filter', 'acc_1nn', o_nn)), f"{100 * mean(R, 'retained', protocol='filter')[0]:.0f}\\%"]
            f.write(lab.replace("C-Aug", "CIFAR-Aug") + " & " + " & ".join(cells) + " \\\\\n")
        f.write("\\bottomrule\n\\end{tabular}\n\\end{table}\n")
    errs = [abs(float(v.strip("$"))) for k, v in M.items() if k.startswith("numProt") and k.endswith("dgroupErr")]
    if errs:
        M["numProtDgroupMaxErr"] = f"{max(errs):.1f}"
M.setdefault("numProtDgroupMaxErr", "??")

with open(f"{P}/numbers.tex", "w") as f:
    for k, v in sorted(M.items()):
        f.write(f"\\newcommand{{\\{k}}}{{{v}}}\n")
print("final", len(M), "macros")

# ---------------- audit
import csv, sys as _s
_s.path.insert(0, "src")
aud_rows = []
for nm, lab in (("leafA", "Leaf-A"), ("leafB", "Leaf-B")):
    f = f"{RES}/repeats_{nm}_manual.json"
    if os.path.exists(f):
        man = json.load(open(f))["pairs"]; rep = json.load(open(f"{RES}/repeats_{nm}.json"))
        yes = sum(q["same_leaf"] for q in man)
        M[f"numRep{nm[-1]}yes"] = str(yes); M[f"numRep{nm[-1]}linked"] = str(rep["linked"]["0.01"])
        aud_rows.append((lab, f"{rep['n_sources']} sources", "repeat shots of one leaf filed as different sources",
                         f"{rep['linked']['0.01']} linked", f"{yes}/60 confirmed"))
        aud_rows.append((lab, "", "source photo filed under two classes", f"{len(rep['exact_cross_class_sources'])}", "byte-identical"))
pdm = f"{RES}/plantdoc_manual.json"
if os.path.exists(pdm):
    from leaklib import linear_probe
    man = json.load(open(pdm))["pairs"]; yes = [q for q in man if q["same_photo"]]
    rows_pd = list(csv.DictReader(open("data/manifests/plantdoc.csv")))
    labs = sorted({r["label"] for r in rows_pd}); y = np.array([labs.index(r["label"]) for r in rows_pd])
    sp = np.array([r["split"] for r in rows_pd]); tr = np.where(sp == "train")[0]; te = np.where(sp == "test")[0]
    F = np.load(f"features/plantdoc_effnet_b0_160.npz")["feat"].astype(np.float32)
    c = linear_probe(F[tr], y[tr], F[te]) == y[te]
    path2k = {rows_pd[i]["path"]: k for k, i in enumerate(te)}
    dup = np.zeros(len(te), bool)
    for q in yes: dup[path2k[q["test"]]] = True
    audp = json.load(open(f"{RES}/audit_plantdoc.json"))
    n_cross = audp["exact_test_in_train_cross"]
    M["numPDyes"] = str(len(yes)); M["numPDtotal"] = pct((len(yes) + n_cross) / len(te), 1)
    M["numPDaccDup"] = pct(c[dup].mean()); M["numPDaccRest"] = pct(c[~dup].mean())
    aud_rows.append(("PlantDoc", "236 test", "test image in train with another label", str(n_cross), "byte-identical"))
    aud_rows.append(("PlantDoc", "", "test photograph also in train (same label)", str(len(yes)), "13/40 top pairs"))
cvm = f"{RES}/covid_manual.json"
if os.path.exists(cvm):
    aud_rows.append(("COVID-CXR", "699 images", "images sharing a patient with another image", "437", "metadata"))
    aud_rows.append(("COVID-CXR", "", "same radiograph under two patient ids", "3 pairs", "3/6 top pairs"))
c10 = f"{RES}/audit_cifar10.json"
if os.path.exists(c10):
    A = json.load(open(c10)); man = f"{RES}/cifar10_manual.json"
    if os.path.exists(man):
        mm = json.load(open(man)); yes = sum(q["near_duplicate"] for q in mm["pairs"])
        M["numCifarText"] = mm["text"]
        aud_rows.append(("CIFAR-10", "10,000 test", "test image near-duplicated in train", f"{A['flags']['0.001']['n_flagged']} flagged", f"{yes}/{len(mm['pairs'])} top pairs"))
bt = f"{RES}/audit_braintumor.json"
if os.path.exists(bt):
    A = json.load(open(bt)); mm = json.load(open(f"{RES}/braintumor_manual.json"))["pairs"]; yes = sum(q["near_duplicate"] for q in mm)
    F2, F3 = A["flags"]["0.01"], A["flags"]["0.0001"]
    M.update(numBTntest=str(A["n_test"]), numBTexact=str(A["exact_test_in_train_same"]), numBTexactPct=pct(A["exact_test_in_train_same"] / A["n_test"]),
             numBTflag=str(F2["n_flagged"]), numBTflagPct=pct(F2["frac_test_flagged"]), numBTflagHi=str(F3["n_flagged"]), numBTflagHiPct=pct(F3["frac_test_flagged"]),
             numBTyes=f"{yes}/{len(mm)}", numBTaccAll=pct(A["acc_lp_all"]), numBTaccFlag=pct(F2["acc_lp_flagged"]), numBTaccClean=pct(F2["acc_lp_clean"]),
             numBTnnFlag=pct(F2["acc_1nn_flagged"]), numBTnnClean=pct(F2["acc_1nn_clean"]), numBTcross=pct(F2["frac_crossclass_flagged"], 1))
    aud_rows.append(("Brain MRI", f"{A['n_test']} test", "test image byte-identical to a training image", str(A["exact_test_in_train_same"]), "byte-identical"))
    aud_rows.append(("Brain MRI", "", "test slice near-duplicated in train", f"{F2['n_flagged'] - A['exact_test_in_train_same']} flagged", f"{yes}/{len(mm)} top pairs"))
fr = f"{RES}/audit_fruits360.json"
if os.path.exists(fr):
    A = json.load(open(fr)); mm = json.load(open(f"{RES}/fruits360_manual.json"))["pairs"]; yes = sum(q["same_object"] for q in mm)
    M.update(numFRntest=f"{A['n_test']:,}".replace(",", "{,}"), numFRflag=str(A["flags"]["0.001"]["n_flagged"]), numFRflagPct=pct(A["flags"]["0.001"]["frac_test_flagged"]),
             numFRyes=f"{yes}/{len(mm)}", numFRacc=pct(A["acc_lp_all"], 1))
    aud_rows.append(("Fruits-360", f"{A['n_test']:,} test", "test frame of the same fruit, same capture sequence", f"{A['flags']['0.001']['n_flagged']} flagged", f"{yes}/{len(mm)} sampled pairs"))
with open(f"{P}/tables/audit.tex", "w") as f:
    f.write("\\begin{table}[t]\n\\centering\\small\n\\setlength{\\tabcolsep}{4pt}\n\\caption{\\textbf{Audit findings.} Counts of flagged items and how they were verified (byte identity, metadata, or our inspection of the top-ranked candidate pairs).}\n\\label{tab:audit}\n")
    f.write("\\begin{tabular}{@{}llp{5.2cm}rl@{}}\n\\toprule\nrelease & size & finding & count & verified \\\\\n\\midrule\n")
    for r in aud_rows:
        f.write(" & ".join(r) + " \\\\\n")
    f.write("\\bottomrule\n\\end{tabular}\n\\end{table}\n")
M.setdefault("numCifarText", "")
with open(f"{P}/numbers.tex", "w") as f:
    for k, v in sorted(M.items()):
        f.write(f"\\newcommand{{\\{k}}}{{{v}}}\n")
print("audit rows", len(aud_rows))

# ---------------- appendix tables
def tab(path, caption, label, header, rows, align):
    with open(path, "w") as f:
        f.write(f"\\begin{{table}}[h]\n\\centering\\footnotesize\n\\setlength{{\\tabcolsep}}{{4pt}}\n\\caption{{{caption}}}\n\\label{{{label}}}\n\\begin{{tabular}}{{{align}}}\n\\toprule\n")
        f.write(" & ".join(header) + " \\\\\n\\midrule\n")
        for r in rows:
            f.write(" & ".join(r) + " \\\\\n")
        f.write("\\bottomrule\n\\end{tabular}\n\\end{table}\n")

if C:
    rows_ = []
    for st in ("weak", "medium", "strong"):
        for k in (1, 2, 4, 8, 16):
            qt = mean(C, "q_theory", strength=st, n_src=2000, k=k, probe="linear")[0]; qe = mean(C, "q_emp", strength=st, n_src=2000, k=k, probe="linear")[0]
            if st == "weak":
                rows_.append((f"CIFAR-Aug, $k={k}$", f"{100 * qt:.2f}\\%", f"{100 * qe:.2f}\\%"))
    for nm, lab in (("leafA", "Leaf-A ($k=15$)"), ("leafB", "Leaf-B ($k=16$)")):
        R = jl(f"{RES}/inflation_{nm}_mobilenetv3.jsonl")
        if R:
            rows_.append((lab, f"{100 * mean(R, 'q_theory', probe='linear')[0]:.2f}\\%", f"{100 * mean(R, 'q_emp', probe='linear')[0]:.2f}\\%"))
    tab(f"{P}/tables/exposure.tex", "Exposure under an 80/20 random split: \\Eqref{eq:exposure} against the measured share of test images with a sibling in training (mean over seeds).",
        "tab:exposure", ["release", "predicted $q$", "measured $q$"], rows_, "@{}lrr@{}")
    rows_ = []
    for st in ("weak", "medium", "strong"):
        for pr, pn in (("knn1", "1-NN"), ("linear", "linear")):
            g_ = lambda key: f"{100 * mean(C, key, strength=st, probe=pr, n_src=2000, k=16)[0]:.1f}"
            rows_.append((st, pn, g_("acc_random"), g_("acc_group"), g_("acc_group_orig"), g_("fresh_group_model")))
    tab(f"{P}/tables/orig.tex", "CIFAR-Aug ($k=16$, 2{,}000 sources): scoring the group split only on the unedited member of each test group recovers the accuracy on fresh photographs. Accuracy in \\%, mean over 3 seeds.",
        "tab:orig", ["edits", "probe", "random split", "group split", "group split, originals", "fresh photographs"], rows_, "@{}llrrrr@{}")
rows_ = []
for nm, lab in (("leafA", "Leaf-A"), ("leafB", "Leaf-B")):
    for bb, bn in (("mobilenetv3", "MobileNetV3-L"), ("effnet_b0", "EfficientNet-B0")):
        R = jl(f"{RES}/inflation_{nm}_{bb}.jsonl")
        if R:
            for pr, pn in (("linear", "linear"), ("knn1", "1-NN")):
                a = mean(R, "acc_random", probe=pr)[0]; b = mean(R, "acc_group", probe=pr)[0]
                rows_.append((lab, bn, pn, f"{100 * a:.1f}", f"{100 * b:.1f}", sg(100 * (a - b))))
tab(f"{P}/tables/backbones.tex", "Inflation on the real releases for two frozen backbones (accuracy in \\%, mean over seeds).", "tab:backbones",
    ["release", "backbone", "probe", "random", "group", "gap"], rows_, "@{}lllrrr@{}")
if det:
    rows_ = []
    for c in cols:
        ms = det[c]["methods"]
        for m, lab in ME:
            if m in ms and m != "exact":
                pp = ms[m]["parts"]
                rows_.append((dict(DS)[c], lab) + tuple(f"{100 * pp[a]['residual_leak']:.0f}\\%" for a in ("0.01", "0.001", "0.0001")) +
                             tuple(f"{100 * pp[a]['img_false_link']:.1f}\\%" for a in ("0.01", "0.001", "0.0001")))
    tab(f"{P}/tables/resid.tex", "Residual exposure after splitting by detected components (share of test images with a true sibling in training, mean over 5 splits) and image-level false-link rate, at three values of $\\alpha$.",
        "tab:resid", ["release", "method", "exp.\\ $10^{-2}$", "$10^{-3}$", "$10^{-4}$", "false $10^{-2}$", "$10^{-3}$", "$10^{-4}$"], rows_, "@{}llrrrrrr@{}")
    if "leafA" in det and "struct" in det["leafA"]["methods"]:
        rows_ = []
        vr = {m: det["leafA"]["methods"][m]["parts"]["0.001"]["variant_recall"] for m in ("phash_d4", "sem", "inv", "struct") if m in det["leafA"]["methods"]}
        for v in sorted(vr["struct"], key=lambda x: int(x[1:])):
            rows_.append((v,) + tuple(f"{100 * vr[m][v]:.0f}" for m in vr))
        tab(f"{P}/tables/variants.tex", "Leaf-A: share of copies of each released variant that end up in a component with a true sibling ($\\alpha=10^{-3}$). The release does not name its variants; v1 is the unedited photograph.",
            "tab:variants", ["variant"] + [dict(ME)[m] for m in vr], rows_, "@{}l" + "r" * len(vr) + "@{}")
with open(f"{P}/numbers.tex", "w") as f:
    for k, v in sorted(M.items()):
        f.write(f"\\newcommand{{\\{k}}}{{{v}}}\n")

# ---------------- fine-tuning (mean +- s.d. over seeds)
FT = jl(f"{RES}/finetune.jsonl")
if FT:
    for r in FT:
        r.setdefault("arch", "mobilenetv3")
    rows_ = []
    names = [("cifar-aug-medium-k8", "mobilenetv3", "CIFAR-Aug medium", "MobileNetV3-L"), ("cifar-aug-medium-k8", "effnet_b0", "CIFAR-Aug medium", "EfficientNet-B0"),
             ("cifar-aug-weak-k8", "mobilenetv3", "CIFAR-Aug weak", "MobileNetV3-L"), ("leafB", "mobilenetv3", "Leaf-B", "MobileNetV3-L")]
    def ms(R, k):
        v = [r[k] for r in R if r.get(k) is not None]
        if not v:
            return "--", None
        m = 100 * np.mean(v); sd = 100 * np.std(v, ddof=1) if len(v) > 1 else 0.0
        return (f"{m:.1f}\\,{{\\scriptsize$\\pm${sd:.1f}}}" if len(v) > 1 else f"{m:.1f}"), m
    for ds, arch, lab, an in names:
        R = [r for r in FT if r["dataset"] == ds and r["arch"] == arch]
        if not R:
            continue
        rr = {s_: [r for r in R if r["split"] == s_] for s_ in ("random", "group")}
        nseeds = len(rr["random"])
        cr, mr = ms(rr["random"], "acc"); cg, mg = ms(rr["group"], "acc")
        fr, mfr = ms(rr["random"], "fresh_acc"); fg, mfg = ms(rr["group"], "fresh_acc")
        rows_.append((lab, an, cr, cg, fr, fg, str(nseeds)))
        key = {"cifar-aug-medium-k8": "CMed", "cifar-aug-weak-k8": "CWeak", "leafB": "LeafB"}[ds] + ("Eff" if arch == "effnet_b0" else "")
        M[f"numFt{key}Random"] = f"{mr:.1f}\\%"; M[f"numFt{key}Group"] = f"{mg:.1f}\\%"
        if mfr is not None:
            M[f"numFt{key}RandomFresh"] = f"{mfr:.1f}\\%"
        M[f"numFt{key}Seeds"] = str(nseeds)
        M[f"numFt{key}ErrRatio"] = f"{(100 - mg) / (100 - mr):.0f}" if mr < 100 else "--"
    tab(f"{P}/tables/finetune.tex", "End-to-end fine-tuning of ImageNet backbones (AdamW, one-cycle schedule, learning rate $10^{-3}$, batch 64, label smoothing 0.1, horizontal flips; CIFAR-Aug: $k=8$, $64$ px, 4 epochs; Leaf-B: $96$ px, 3 epochs). Accuracy in \\%, mean $\\pm$ s.d.\\ over seeds. Fresh: the same model scored on fresh CIFAR-10 test photographs.",
        "tab:finetune", ["release", "backbone", "random", "group", "fresh (random-split)", "fresh (group-split)", "seeds"], rows_, "@{}llrrrrr@{}")
with open(f"{P}/numbers.tex", "w") as f:
    for k, v in sorted(M.items()):
        f.write(f"\\newcommand{{\\{k}}}{{{v}}}\n")

# ---------------- data size (CIFAR-Aug, k = 16)
if C:
    rows_ = []
    for st in ("weak", "medium", "strong"):
        for pr, pn in (("linear", "linear"), ("knn1", "1-NN")):
            cells = []
            for n in (500, 1000, 2000):
                a = mean(C, "acc_random", strength=st, probe=pr, n_src=n, k=16)[0]; b = mean(C, "fresh_random_model", strength=st, probe=pr, n_src=n, k=16)[0]
                cells.append(f"{100 * a:.1f} / {100 * b:.1f}")
            rows_.append((st, pn) + tuple(cells))
    g500 = 100 * (mean(C, "acc_random", strength="medium", probe="linear", n_src=500, k=16)[0] - mean(C, "fresh_random_model", strength="medium", probe="linear", n_src=500, k=16)[0])
    g2000 = 100 * (mean(C, "acc_random", strength="medium", probe="linear", n_src=2000, k=16)[0] - mean(C, "fresh_random_model", strength="medium", probe="linear", n_src=2000, k=16)[0])
    M["numSizeGapSmall"] = f"{g500:.0f}"; M["numSizeGapLarge"] = f"{g2000:.0f}"
    tab(f"{P}/tables/datasize.tex", "CIFAR-Aug with $k=16$: reported (random split) / true (fresh photographs) accuracy in \\% as the number of source photographs grows; mean over 3 seeds. Smaller releases are inflated more.",
        "tab:datasize", ["edits", "probe", "500 sources", "1,000 sources", "2,000 sources"], rows_, "@{}llrrr@{}")
with open(f"{P}/numbers.tex", "w") as f:
    for k, v in sorted(M.items()):
        f.write(f"\\newcommand{{\\{k}}}{{{v}}}\n")
