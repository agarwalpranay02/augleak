import { useMemo, useState } from "react";
import type { SplitReport } from "../core/audit";
import { MAX_IMAGES, runCheck, type InputImage, type Progress } from "../engine/engine";
import { classCounts, loadDemo, urlOf } from "../engine/files";
import { FolderPicker } from "./FolderPicker";
import { ProgressBar } from "./ProgressBar";
import { ALPHAS, alphaLabel, csv, download, fmtP, pct } from "./util";

interface Result { report: SplitReport; train: InputImage[]; test: InputImage[]; failed: { name: string; message: string }[]; demo: boolean }

export function CheckSplit() {
  const [train, setTrain] = useState<InputImage[] | null>(null);
  const [test, setTest] = useState<InputImage[] | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [alpha, setAlpha] = useState<number>(1e-3);
  const [shown, setShown] = useState(24);
  const busy = !!progress;

  const problem = useMemo(() => {
    if (!train || !test) return null;
    const total = train.length + test.length;
    if (total > MAX_IMAGES) return `That is ${total.toLocaleString()} images. The browser version handles up to ${MAX_IMAGES.toLocaleString()} at a time; for larger sets use the command-line tool.`;
    const cls = new Set([...classCounts(train), ...classCounts(test)].map(([c]) => c));
    if (cls.size < 2) return "AugLeak needs at least two classes (one sub-folder per class), because it calibrates its error rate on matches between classes.";
    return null;
  }, [train, test]);

  async function run(tr: InputImage[], te: InputImage[], demo: boolean) {
    setError(null); setResult(null); setShown(24);
    setProgress({ stage: "reading", done: 0, total: tr.length + te.length });
    try {
      const r = await runCheck(tr, te, alpha, setProgress);
      setResult({ ...r, demo });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setProgress(null); }
  }

  async function demo() {
    setError(null); setResult(null);
    setProgress({ stage: "reading", done: 0, total: 1 });
    try {
      const d = await loadDemo((done, total) => setProgress({ stage: "reading", done, total }));
      setTrain(d.train); setTest(d.test);
      await run(d.train, d.test, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)); setProgress(null);
    }
  }

  const flagged = useMemo(() => result ? result.report.best.filter((b) => b.exact || b.p < alpha).sort((a, b) => a.p - b.p) : [], [result, alpha]);

  function exportFiles() {
    if (!result) return;
    const { train: tr, test: te } = result;
    download("flagged.csv", csv([["test_image", "class", "closest_train_image", "p_value", "byte_identical"],
      ...flagged.map((f) => [te[f.test].name, te[f.test].label, tr[f.train].name, f.p.toExponential(3), f.exact])]), "text/csv");
  }
  function exportClean() {
    if (!result) return;
    const bad = new Set(flagged.map((f) => f.test));
    download("clean_test.txt", result.test.filter((_, i) => !bad.has(i)).map((t) => t.name).join("\n") + "\n");
  }

  return (
    <div className="panel">
      <p className="panel-intro">
        Give AugLeak your training folder and your test folder, each with one sub-folder per class. It reports
        every test image that has a copy in training, whether the copy is flipped, rotated, cropped, recoloured or filtered.
      </p>
      <div className="split-pickers">
        <FolderPicker side="train" title="Training folder" hint="Drop a folder here, or choose one. Example: train/healthy/*.jpg, train/rust/*.jpg"
          images={train} onChange={(x) => { setTrain(x.length ? x : null); setResult(null); }} disabled={busy} />
        <div className="split-line" aria-hidden="true"><span>split</span></div>
        <FolderPicker side="test" title="Test folder" hint="The same class folders, holding your test images."
          images={test} onChange={(x) => { setTest(x.length ? x : null); setResult(null); }} disabled={busy} />
      </div>

      <div className="run-row">
        <label className="alpha">
          False-link rate
          <select value={alpha} onChange={(e) => setAlpha(Number(e.target.value))} disabled={busy}>
            {ALPHAS.map((a) => <option key={a} value={a}>α = {alphaLabel(a)}</option>)}
          </select>
        </label>
        <button className="btn primary" disabled={busy || !train || !test || !!problem} onClick={() => train && test && run(train, test, false)}>
          Check split
        </button>
        <button className="btn ghost" disabled={busy} onClick={demo}>Try it on Fruits-360</button>
      </div>
      {problem && <p className="note warn">{problem}</p>}
      {progress && <ProgressBar p={progress} />}
      {error && <p className="note warn">Something went wrong: {error}</p>}

      {result && (
        <section className="results" aria-live="polite">
          <div className="verdict">
            <p className="verdict-num">{flagged.length.toLocaleString()}<span> of {result.report.nTest.toLocaleString()}</span></p>
            <p className="verdict-text">
              test images ({pct(flagged.length / Math.max(1, result.report.nTest), 1)}) have a copy in the training set at α = {alphaLabel(alpha)}.
              {flagged.length > 0 && " A model can score well on these by recognising the copy, so the test accuracy is optimistic."}
            </p>
          </div>
          {result.demo && (
            <p className="note">
              Demo data: three classes of the official Fruits-360 split (every second training frame, 25 random test images per class).
              Fruits-360 frames come from videos of rotating fruit, and many test frames sit a few frames away from a training frame.
            </p>
          )}
          <dl className="facts">
            <div><dt>Byte-identical to a training image</dt><dd>{result.report.best.filter((b) => b.exact).length}</dd></div>
            <div><dt>Identical file under another label</dt><dd>{result.report.crossLabelExact.length}</dd></div>
            <div><dt>Test images left after removing copies</dt><dd>{(result.report.nTest - flagged.length).toLocaleString()}</dd></div>
            {result.failed.length > 0 && <div><dt>Files that could not be read</dt><dd>{result.failed.length}</dd></div>}
          </dl>
          <div className="alpha-switch" role="group" aria-label="False-link rate">
            {ALPHAS.map((a) => (
              <button key={a} className={a === alpha ? "on" : ""} onClick={() => setAlpha(a)}>α = {alphaLabel(a)}</button>
            ))}
            <span className="alpha-help">Lower α: fewer, surer links.</span>
          </div>
          <div className="downloads">
            <button className="btn ghost" onClick={exportFiles} disabled={!flagged.length}>Download flagged list (CSV)</button>
            <button className="btn ghost" onClick={exportClean}>Download clean test list</button>
          </div>
          {flagged.length > 0 && (
            <>
              <h3 className="pairs-title">Test image and its closest training copy</h3>
              <ol className="pairs">
                {flagged.slice(0, shown).map((f) => {
                  const t = result.test[f.test], s = result.train[f.train];
                  return (
                    <li key={f.test} className="pair">
                      <figure><img src={urlOf(t)} alt={`Test image ${t.name}`} loading="lazy" /><figcaption>test</figcaption></figure>
                      <figure><img src={urlOf(s)} alt={`Training image ${s.name}`} loading="lazy" /><figcaption>train</figcaption></figure>
                      <div className="pair-meta">
                        <span className="file" title={t.name}>{t.name}</span>
                        <span className="file dim" title={s.name}>{s.name}</span>
                        <span className={`p${f.exact ? " exact" : ""}`}>{f.exact ? "byte-identical" : `p = ${fmtP(f.p)}`}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
              {shown < flagged.length && <button className="btn ghost more" onClick={() => setShown(shown + 48)}>Show more ({flagged.length - shown} left)</button>}
            </>
          )}
        </section>
      )}
    </div>
  );
}
