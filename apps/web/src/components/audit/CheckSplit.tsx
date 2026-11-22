"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SplitReport } from "@/lib/engine/core/audit";
import { MAX_IMAGES, runCheck, type InputImage, type Progress } from "@/lib/engine/engine";
import { classCounts, loadDemo, urlOf } from "@/lib/engine/files";
import { ALPHAS, alphaLabel, csv, download, fmtP, pct } from "@/lib/format";
import { addHistory } from "@/lib/history";
import { toast } from "@/lib/toast";
import { FolderDrop } from "./FolderDrop";
import { PairModal } from "./PairModal";
import { ProgressBar } from "./Progress";

interface Result { report: SplitReport; train: InputImage[]; test: InputImage[]; failed: { name: string; message: string }[]; demo: boolean; seconds: number }

export function CheckSplit({ autoDemo, onHistory }: { autoDemo: boolean; onHistory: () => void }) {
  const [train, setTrain] = useState<InputImage[] | null>(null);
  const [test, setTest] = useState<InputImage[] | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [started, setStarted] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [alpha, setAlpha] = useState<number>(1e-3);
  const [cls, setCls] = useState("all");
  const [shown, setShown] = useState(24);
  const [open, setOpen] = useState<number | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const busy = !!progress;

  const problem = useMemo(() => {
    if (!train || !test) return null;
    const total = train.length + test.length;
    if (total > MAX_IMAGES) return `That is ${total.toLocaleString()} images. The browser handles up to ${MAX_IMAGES.toLocaleString()} per run; for more, use the command-line tool in the repository.`;
    const names = new Set([...classCounts(train), ...classCounts(test)].map(([c]) => c));
    if (names.size < 2) return "AugLeak needs at least two classes (one sub-folder per class): it calibrates its false-link rate on matches between classes.";
    const tr = new Set(classCounts(train).map(([c]) => c));
    const missing = classCounts(test).map(([c]) => c).filter((c) => !tr.has(c));
    if (missing.length) return `These test classes have no training folder: ${missing.slice(0, 4).join(", ")}${missing.length > 4 ? "…" : ""}. Their images can't be flagged.`;
    return null;
  }, [train, test]);

  async function run(tr: InputImage[], te: InputImage[], demo: boolean, name: string) {
    setError(null); setResult(null); setShown(24); setCls("all");
    const t0 = Date.now(); setStarted(t0);
    setProgress({ stage: "reading", done: 0, total: tr.length + te.length });
    try {
      const r = await runCheck(tr, te, alpha, setProgress);
      const seconds = (Date.now() - t0) / 1000;
      setResult({ ...r, demo, seconds });
      const n = r.report.best.filter((b) => b.exact || b.p < alpha).length;
      await addHistory({ id: crypto.randomUUID(), at: Date.now(), mode: "split", name, images: tr.length + te.length, classes: classCounts([...tr, ...te]).length, alpha,
        headline: `${n} of ${r.report.nTest} test images have a copy in training`, share: n / Math.max(1, r.report.nTest), seconds });
      onHistory();
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setProgress(null); }
  }

  async function demo() {
    setError(null); setResult(null);
    setStarted(Date.now());
    setProgress({ stage: "reading", done: 0, total: 1 });
    try {
      const d = await loadDemo((done, total) => setProgress({ stage: "reading", done, total }));
      setTrain(d.train); setTest(d.test);
      await run(d.train, d.test, true, "Fruits-360 demo");
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setProgress(null); }
  }

  const started1 = useRef(false);
  useEffect(() => {
    if (autoDemo && !started1.current) { started1.current = true; demo(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDemo]);

  const flagged = useMemo(() => (result ? result.report.best.filter((b) => b.exact || b.p < alpha).sort((a, b) => a.p - b.p) : []), [result, alpha]);
  const perClass = useMemo(() => {
    if (!result) return [];
    const m = new Map<string, { n: number; f: number }>();
    result.test.forEach((t) => { const e = m.get(t.label) ?? { n: 0, f: 0 }; e.n++; m.set(t.label, e); });
    flagged.forEach((f) => { m.get(result.test[f.test].label)!.f++; });
    return Array.from(m.entries()).sort((a, b) => b[1].f / b[1].n - a[1].f / a[1].n);
  }, [result, flagged]);
  const visible = cls === "all" ? flagged : flagged.filter((f) => result!.test[f.test].label === cls);

  function report() {
    if (!result) return null;
    const { report: r, train: tr, test: te } = result;
    return {
      tool: "AugLeak 1.0 (browser)", created: new Date().toISOString(), alpha,
      train_images: r.nTrain, test_images: r.nTest, flagged: flagged.length, flagged_share: flagged.length / Math.max(1, r.nTest),
      byte_identical: flagged.filter((f) => f.exact).length,
      identical_file_other_label: r.crossLabelExact.map((c) => ({ test: te[c.test].name, train: tr[c.train].name })),
      per_class: perClass.map(([c, v]) => ({ class: c, test_images: v.n, flagged: v.f })),
      pairs: flagged.map((f) => ({ test: te[f.test].name, class: te[f.test].label, train: tr[f.train].name, p_value: f.p, byte_identical: f.exact })),
    };
  }
  function markdown() {
    const r = report(); if (!r) return "";
    return [
      `# AugLeak audit`,
      ``,
      `- Training images: ${r.train_images}; test images: ${r.test_images}; false-link rate α = ${alpha}`,
      `- **${r.flagged} test images (${pct(r.flagged_share, 1)}) have a copy in the training set**, ${r.byte_identical} of them byte-identical.`,
      `- Identical files filed under a different label: ${r.identical_file_other_label.length}`,
      ``,
      `| Class | Test images | With a copy in training |`,
      `|---|---:|---:|`,
      ...r.per_class.map((c) => `| ${c.class} | ${c.test_images} | ${c.flagged} (${pct(c.flagged / Math.max(1, c.test_images), 1)}) |`),
      ``,
      `Produced with AugLeak (https://augleak.vercel.app); p-values use the label-calibrated null of the AugLeak paper.`,
      ``,
    ].join("\n");
  }

  return (
    <div>
      <div className="grid items-stretch gap-4 md:grid-cols-[1fr_28px_1fr]">
        <FolderDrop tone="train" title="Training folder" hint="Drop a folder here, choose one, or open a ZIP. One sub-folder per class, e.g. train/healthy/*.jpg, train/rust/*.jpg."
          images={train} onChange={(x) => { setTrain(x); setResult(null); }} disabled={busy} />
        <div className="seam hidden md:block" aria-hidden="true" />
        <FolderDrop tone="test" title="Test folder" hint="The same class sub-folders, holding your test images."
          images={test} onChange={(x) => { setTest(x); setResult(null); }} disabled={busy} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[14.5px] text-[var(--color-ink-2)]">
          False-link rate
          <select className="field w-auto py-2" value={alpha} onChange={(e) => setAlpha(Number(e.target.value))} disabled={busy}>
            {ALPHAS.map((a) => <option key={a} value={a}>α = {alphaLabel(a)}</option>)}
          </select>
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <button className="btn btn-ghost" disabled={busy} onClick={demo}>Try it on Fruits-360</button>
          <button className="btn btn-leak" disabled={busy || !train || !test || !!problem} onClick={() => train && test && run(train, test, false, "Train/test split")}>Check split</button>
        </div>
      </div>
      {problem && <p className="mt-4 rounded-xl bg-[var(--color-leak-soft)] px-4 py-3 text-[14.5px] text-[#8a1435]">{problem}</p>}
      {progress && <ProgressBar p={progress} started={started} />}
      {error && <p className="mt-4 rounded-xl bg-[var(--color-leak-soft)] px-4 py-3 text-[14.5px] text-[#8a1435]">Something went wrong: {error}</p>}

      {result && (
        <section ref={resultsRef} className="mt-10 scroll-mt-24" aria-label="Results">
          <div className="grid gap-6 lg:grid-cols-[auto_1fr] lg:items-end">
            <p className="display text-[clamp(72px,10vw,120px)] leading-[0.85] text-[var(--color-leak)] tnum">
              {flagged.length}<span className="ml-3 text-[0.32em] text-[var(--color-ink-2)]">of {result.report.nTest}</span>
            </p>
            <div className="pb-2">
              <p className="text-[19px] font-medium">test images ({pct(flagged.length / Math.max(1, result.report.nTest), 1)}) have a copy in the training set at α = {alphaLabel(alpha)}.</p>
              <p className="mt-1 text-[15px] text-[var(--color-ink-2)]">
                {flagged.length ? "A model can score well on these by recognising the copy, so accuracy on this test set is optimistic." : "No copies found at this false-link rate."} Finished in {result.seconds.toFixed(1)} s on this device.
              </p>
            </div>
          </div>
          {result.demo && (
            <p className="mt-5 max-w-3xl rounded-xl bg-[var(--color-paper-2)] px-4 py-3 text-[14.5px] text-[var(--color-ink-2)]">
              Demo data: three classes of the official Fruits-360 split (every second training frame and 25 random test images per class). Fruits-360 frames come from videos of rotating fruit, and many test frames sit a few frames from a training frame. The Python reference flags the same 29 images.
            </p>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Fact k="Byte-identical to a training image" v={flagged.filter((f) => f.exact).length} />
            <Fact k="Identical file under another label" v={result.report.crossLabelExact.length} warn={result.report.crossLabelExact.length > 0} />
            <Fact k="Test images left after removing copies" v={(result.report.nTest - flagged.length).toLocaleString()} />
            <Fact k="Files that could not be read" v={result.failed.length} warn={result.failed.length > 0} />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[14.5px] text-[var(--color-ink-2)]">False-link rate</span>
            {ALPHAS.map((a) => (
              <button key={a} onClick={() => setAlpha(a)} aria-pressed={a === alpha}
                className={`rounded-full border px-3 py-1 text-[14px] ${a === alpha ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-white" : "border-[var(--color-rule)] bg-[var(--color-card)] text-[var(--color-ink-2)]"}`}>α = {alphaLabel(a)}</button>
            ))}
            <span className="text-[13.5px] text-[var(--color-ink-3)]">Lower α: fewer, surer links. Switching is instant.</span>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button className="btn btn-sm btn-ghost" disabled={!flagged.length} onClick={() => {
              const te = result.test, tr = result.train;
              download("augleak-flagged.csv", csv([["test_image", "class", "closest_train_image", "p_value", "byte_identical"], ...flagged.map((f) => [te[f.test].name, te[f.test].label, tr[f.train].name, f.p.toExponential(3), f.exact])]), "text/csv");
            }}>Flagged list (CSV)</button>
            <button className="btn btn-sm btn-ghost" onClick={() => {
              const bad = new Set(flagged.map((f) => f.test));
              download("augleak-clean-test.txt", result.test.filter((_, i) => !bad.has(i)).map((t) => t.name).join("\n") + "\n");
            }}>Clean test list</button>
            <button className="btn btn-sm btn-ghost" onClick={() => download("augleak-report.json", JSON.stringify(report(), null, 2), "application/json")}>Full report (JSON)</button>
            <button className="btn btn-sm btn-ghost" onClick={async () => { await navigator.clipboard.writeText(markdown()); toast("Summary copied as Markdown"); }}>Copy summary (Markdown)</button>
          </div>

          {perClass.length > 1 && (
            <div className="card mt-8 overflow-x-auto">
              <table className="table-site">
                <caption className="px-4 pt-4 text-left text-[15px] font-semibold">By class</caption>
                <thead><tr><th>Class</th><th className="num">Test images</th><th className="num">With a copy in training</th><th className="w-[40%]"><span className="sr-only">Share</span></th></tr></thead>
                <tbody>
                  {perClass.map(([c, v]) => (
                    <tr key={c}>
                      <td>{c}</td>
                      <td className="num">{v.n}</td>
                      <td className="num">{v.f} <span className="text-[var(--color-ink-3)]">({pct(v.f / v.n, 0)})</span></td>
                      <td><div className="h-2 rounded-full bg-[var(--color-rule-2)]"><div className="h-2 rounded-full bg-[var(--color-leak)]" style={{ width: pct(v.f / v.n, 1) }} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {flagged.length > 0 && (
            <>
              <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
                <h3 className="text-[20px] font-semibold">Each test image and its closest training copy</h3>
                {perClass.length > 1 && (
                  <label className="flex items-center gap-2 text-[14.5px] text-[var(--color-ink-2)]">Class
                    <select className="field w-auto py-1.5" value={cls} onChange={(e) => { setCls(e.target.value); setShown(24); }}>
                      <option value="all">All classes</option>
                      {perClass.filter(([, v]) => v.f).map(([c]) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                )}
              </div>
              <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visible.slice(0, shown).map((f, i) => {
                  const t = result.test[f.test], s = result.train[f.train];
                  return (
                    <li key={f.test}>
                      <button type="button" onClick={() => setOpen(i)} className="card grid w-full grid-cols-[84px_84px_1fr] items-center gap-2.5 p-2.5 text-left transition-shadow hover:shadow-[0_10px_28px_-18px_rgb(11_21_36/0.5)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={urlOf(t)} alt={`Test image ${t.name}`} loading="lazy" className="aspect-square w-full rounded-lg bg-[var(--color-paper-2)] object-cover ring-2 ring-[var(--color-test)]" />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={urlOf(s)} alt={`Training image ${s.name}`} loading="lazy" className="aspect-square w-full rounded-lg bg-[var(--color-paper-2)] object-cover ring-2 ring-[var(--color-train)]" />
                        <span className="flex min-w-0 flex-col gap-0.5 pl-1">
                          <span className="mono truncate text-[12.5px]" title={t.name}>{t.name}</span>
                          <span className="mono truncate text-[12.5px] text-[var(--color-ink-3)]" title={s.name}>{s.name}</span>
                          <span className={`mt-1 text-[13px] ${f.exact ? "font-semibold" : "mono"} text-[var(--color-leak)]`}>{f.exact ? "byte-identical" : `p = ${fmtP(f.p)}`}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              {shown < visible.length && <button className="btn btn-ghost mt-5" onClick={() => setShown(shown + 48)}>Show more ({visible.length - shown} left)</button>}
            </>
          )}
          {open !== null && visible[open] && (
            <PairModal
              a={result.test[visible[open].test]} b={result.train[visible[open].train]} aLabel="test" bLabel="train"
              p={visible[open].p} exact={visible[open].exact}
              onClose={() => setOpen(null)}
              onPrev={open > 0 ? () => setOpen(open - 1) : undefined}
              onNext={open < Math.min(shown, visible.length) - 1 ? () => setOpen(open + 1) : undefined}
            />
          )}
        </section>
      )}
    </div>
  );
}

function Fact({ k, v, warn }: { k: string; v: number | string; warn?: boolean }) {
  return (
    <div className={`rounded-xl p-4 ${warn ? "bg-[var(--color-leak-soft)]" : "bg-[var(--color-card)] ring-1 ring-[var(--color-rule)]"}`}>
      <p className="text-[13.5px] text-[var(--color-ink-2)]">{k}</p>
      <p className="display mt-1 text-[34px] leading-none tnum">{v}</p>
    </div>
  );
}
