import { useMemo, useState } from "react";
import { groupSplit, type ScanReport } from "../core/audit";
import { MAX_IMAGES, runScan, type InputImage, type Progress } from "../engine/engine";
import { classCounts, loadDemo, urlOf } from "../engine/files";
import { FolderPicker } from "./FolderPicker";
import { ProgressBar } from "./ProgressBar";
import { ALPHAS, alphaLabel, csv, download, fmtP, pct } from "./util";

interface Result { report: ScanReport; items: InputImage[]; failed: { name: string; message: string }[] }

export function FindCopies() {
  const [items, setItems] = useState<InputImage[] | null>(null);
  const [alpha, setAlpha] = useState<number>(1e-3);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [testFrac, setTestFrac] = useState(20);
  const [shown, setShown] = useState(12);
  const busy = !!progress;

  const problem = useMemo(() => {
    if (!items) return null;
    if (items.length > MAX_IMAGES) return `That is ${items.length.toLocaleString()} images. The browser version handles up to ${MAX_IMAGES.toLocaleString()} at a time; for larger sets use the command-line tool.`;
    if (classCounts(items).length < 2) return "AugLeak needs at least two classes (one sub-folder per class), because it calibrates its error rate on matches between classes.";
    return null;
  }, [items]);

  async function run(it: InputImage[]) {
    setError(null); setResult(null); setShown(12);
    setProgress({ stage: "reading", done: 0, total: it.length });
    try { setResult(await runScan(it, alpha, setProgress)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setProgress(null); }
  }

  async function demo() {
    setError(null); setResult(null);
    setProgress({ stage: "reading", done: 0, total: 1 });
    try {
      const d = await loadDemo((done, total) => setProgress({ stage: "reading", done, total }));
      setItems(d.train); await run(d.train);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setProgress(null); }
  }

  const groups = useMemo(() => {
    if (!result) return [];
    const m = new Map<number, number[]>();
    result.report.group.forEach((g, i) => { const v = m.get(g) ?? []; v.push(i); m.set(g, v); });
    return Array.from(m.values()).filter((v) => v.length > 1).sort((a, b) => b.length - a.length);
  }, [result]);

  function exportGroups() {
    if (!result) return;
    const { report, items: it } = result;
    download("groups.csv", csv([["image", "class", "group", "group_size"], ...it.map((x, i) => [x.name, x.label, report.group[i], report.groupSizes[report.group[i]]])]), "text/csv");
  }
  function exportLinks() {
    if (!result) return;
    const { report, items: it } = result;
    download("links.csv", csv([["image_a", "image_b", "p_value", "byte_identical"], ...report.links.map((l) => [it[l.a].name, it[l.b].name, l.p.toExponential(3), l.exact])]), "text/csv");
  }
  function exportSplit() {
    if (!result) return;
    const { train, test } = groupSplit(result.report.group, testFrac / 100, 0);
    download("train.txt", train.map((i) => result.items[i].name).join("\n") + "\n");
    setTimeout(() => download("test.txt", test.map((i) => result.items[i].name).join("\n") + "\n"), 400);
  }

  const r = result?.report;
  const sizes = r ? r.groupSizes.filter((s) => s > 1).sort((a, b) => a - b) : [];
  return (
    <div className="panel">
      <p className="panel-intro">
        Give AugLeak one dataset folder with one sub-folder per class. It groups images that are copies of the same photograph,
        so you can split by group instead of by image.
      </p>
      <FolderPicker side="all" title="Dataset folder" hint="Drop a folder here, or choose one. Example: data/healthy/*.jpg, data/rust/*.jpg"
        images={items} onChange={(x) => { setItems(x.length ? x : null); setResult(null); }} disabled={busy} />
      <div className="run-row">
        <label className="alpha">
          False-link rate
          <select value={alpha} onChange={(e) => setAlpha(Number(e.target.value))} disabled={busy}>
            {ALPHAS.map((a) => <option key={a} value={a}>α = {alphaLabel(a)}</option>)}
          </select>
        </label>
        <button className="btn primary" disabled={busy || !items || !!problem} onClick={() => items && run(items)}>Find copies</button>
        <button className="btn ghost" disabled={busy} onClick={demo}>Try it on Fruits-360</button>
      </div>
      {problem && <p className="note warn">{problem}</p>}
      {progress && <ProgressBar p={progress} />}
      {error && <p className="note warn">Something went wrong: {error}</p>}

      {r && result && (
        <section className="results" aria-live="polite">
          <div className="verdict">
            <p className="verdict-num">{pct(r.predictedExposure)}</p>
            <p className="verdict-text">
              of test images would have a detected copy in training under a random 80/20 split of these {r.n.toLocaleString()} images.
              This is a lower bound: copies the detector cannot match stay in separate groups.
            </p>
          </div>
          <dl className="facts">
            <div><dt>Images with at least one copy</dt><dd>{pct(r.linkedShare, 1)}</dd></div>
            <div><dt>Copy groups (2 or more images)</dt><dd>{groups.length.toLocaleString()}</dd></div>
            <div><dt>Largest group</dt><dd>{sizes.length ? sizes[sizes.length - 1] : 1}</dd></div>
            <div><dt>Median group size</dt><dd>{sizes.length ? sizes[Math.floor(sizes.length / 2)] : 1}</dd></div>
            <div><dt>Byte-identical sets</dt><dd>{r.duplicateSets.length}</dd></div>
            <div><dt>…filed under different labels</dt><dd>{r.duplicateSets.filter((d) => d.conflicting).length}</dd></div>
          </dl>
          <div className="downloads">
            <button className="btn ghost" onClick={exportGroups}>Download groups (CSV)</button>
            <button className="btn ghost" onClick={exportLinks} disabled={!r.links.length}>Download links (CSV)</button>
            <span className="split-export">
              <label>Test share <input type="number" min={5} max={50} value={testFrac} onChange={(e) => setTestFrac(Math.max(5, Math.min(50, Number(e.target.value) || 20)))} />%</label>
              <button className="btn primary" onClick={exportSplit}>Download group-aware split</button>
            </span>
          </div>
          {groups.length > 0 && (
            <>
              <h3 className="pairs-title">Largest copy groups</h3>
              <ol className="groups">
                {groups.slice(0, shown).map((g, k) => (
                  <li key={k} className="group">
                    <div className="group-head"><span>{result.items[g[0]].label}</span><span className="num">{g.length} images</span></div>
                    <div className="group-strip">
                      {g.slice(0, 10).map((i) => <img key={i} src={urlOf(result.items[i])} alt={result.items[i].name} title={result.items[i].name} loading="lazy" />)}
                      {g.length > 10 && <span className="group-more">+{g.length - 10}</span>}
                    </div>
                  </li>
                ))}
              </ol>
              {shown < groups.length && <button className="btn ghost more" onClick={() => setShown(shown + 24)}>Show more groups ({groups.length - shown} left)</button>}
              <p className="note">Strongest link: p = {fmtP(r.links[0]?.p ?? 1)}. Links join same-class images only; images of different classes are never linked.</p>
            </>
          )}
        </section>
      )}
    </div>
  );
}
