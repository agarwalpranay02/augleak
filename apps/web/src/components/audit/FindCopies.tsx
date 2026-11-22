"use client";
import { useMemo, useRef, useState } from "react";
import { groupSplit, type ScanReport } from "@/lib/engine/core/audit";
import { MAX_IMAGES, runScan, type InputImage, type Progress } from "@/lib/engine/engine";
import { classCounts, loadDemo, urlOf } from "@/lib/engine/files";
import { ALPHAS, alphaLabel, csv, download, fmtP, pct } from "@/lib/format";
import { addHistory } from "@/lib/history";
import { FolderDrop } from "./FolderDrop";
import { PairModal } from "./PairModal";
import { ProgressBar } from "./Progress";

interface Result { report: ScanReport; items: InputImage[]; failed: { name: string; message: string }[]; seconds: number; demo: boolean }

export function FindCopies({ onHistory }: { onHistory: () => void }) {
  const [items, setItems] = useState<InputImage[] | null>(null);
  const [alpha, setAlpha] = useState<number>(1e-3);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [started, setStarted] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [testFrac, setTestFrac] = useState(20);
  const [seed, setSeed] = useState(1);
  const [shown, setShown] = useState(10);
  const [link, setLink] = useState<{ a: number; b: number; p: number; exact: boolean } | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const busy = !!progress;

  const problem = useMemo(() => {
    if (!items) return null;
    if (items.length > MAX_IMAGES) return `That is ${items.length.toLocaleString()} images. The browser handles up to ${MAX_IMAGES.toLocaleString()} per run; for more, use the command-line tool in the repository.`;
    if (classCounts(items).length < 2) return "AugLeak needs at least two classes (one sub-folder per class): it calibrates its false-link rate on matches between classes.";
    return null;
  }, [items]);

  async function run(it: InputImage[], demo: boolean, name: string) {
    setError(null); setResult(null); setShown(10);
    const t0 = Date.now(); setStarted(t0);
    setProgress({ stage: "reading", done: 0, total: it.length });
    try {
      const r = await runScan(it, alpha, setProgress);
      const seconds = (Date.now() - t0) / 1000;
      setResult({ ...r, seconds, demo });
      await addHistory({ id: crypto.randomUUID(), at: Date.now(), mode: "groups", name, images: it.length, classes: classCounts(it).length, alpha,
        headline: `${pct(r.report.linkedShare, 0)} of images have a copy; ${r.report.groupSizes.filter((s) => s > 1).length} copy groups`, share: r.report.linkedShare, seconds });
      onHistory();
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setProgress(null); }
  }

  async function demo() {
    setError(null); setResult(null); setStarted(Date.now());
    setProgress({ stage: "reading", done: 0, total: 1 });
    try {
      const d = await loadDemo((done, total) => setProgress({ stage: "reading", done, total }));
      setItems(d.train); await run(d.train, true, "Fruits-360 demo (training folder)");
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setProgress(null); }
  }

  const groups = useMemo(() => {
    if (!result) return [];
    const m = new Map<number, number[]>();
    result.report.group.forEach((g, i) => { const v = m.get(g) ?? []; v.push(i); m.set(g, v); });
    return Array.from(m.values()).filter((v) => v.length > 1).sort((a, b) => b.length - a.length);
  }, [result]);
  const linkOf = useMemo(() => {
    const m = new Map<number, ScanReport["links"][number]>();
    result?.report.links.forEach((l) => { if (!m.has(l.a)) m.set(l.a, l); if (!m.has(l.b)) m.set(l.b, l); });
    return m;
  }, [result]);

  const r = result?.report;
  const sizes = r ? r.groupSizes.filter((s) => s > 1).sort((a, b) => a - b) : [];
  return (
    <div>
      <FolderDrop tone="all" title="Dataset folder" hint="Drop a folder here, choose one, or open a ZIP. One sub-folder per class, e.g. data/healthy/*.jpg, data/rust/*.jpg."
        images={items} onChange={(x) => { setItems(x); setResult(null); }} disabled={busy} />
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[14.5px] text-[var(--color-ink-2)]">
          False-link rate
          <select className="field w-auto py-2" value={alpha} onChange={(e) => setAlpha(Number(e.target.value))} disabled={busy}>
            {ALPHAS.map((a) => <option key={a} value={a}>α = {alphaLabel(a)}</option>)}
          </select>
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <button className="btn btn-ghost" disabled={busy} onClick={demo}>Try it on Fruits-360</button>
          <button className="btn btn-leak" disabled={busy || !items || !!problem} onClick={() => items && run(items, false, "Dataset folder")}>Find copies</button>
        </div>
      </div>
      {problem && <p className="mt-4 rounded-xl bg-[var(--color-leak-soft)] px-4 py-3 text-[14.5px] text-[#8a1435]">{problem}</p>}
      {progress && <ProgressBar p={progress} started={started} />}
      {error && <p className="mt-4 rounded-xl bg-[var(--color-leak-soft)] px-4 py-3 text-[14.5px] text-[#8a1435]">Something went wrong: {error}</p>}

      {r && result && (
        <section ref={resultsRef} className="mt-10 scroll-mt-24" aria-label="Results">
          <div className="grid gap-6 lg:grid-cols-[auto_1fr] lg:items-end">
            <p className="display text-[clamp(72px,10vw,120px)] leading-[0.85] text-[var(--color-leak)] tnum">{pct(r.predictedExposure)}</p>
            <div className="pb-2">
              <p className="text-[19px] font-medium">of test images would have a detected copy in training under a random 80/20 split of these {r.n.toLocaleString()} images.</p>
              <p className="mt-1 text-[15px] text-[var(--color-ink-2)]">A lower bound: copies the detector cannot match stay in separate groups. Finished in {result.seconds.toFixed(1)} s on this device.</p>
            </div>
          </div>
          {result.demo && (
            <p className="mt-5 max-w-3xl rounded-xl bg-[var(--color-paper-2)] px-4 py-3 text-[14.5px] text-[var(--color-ink-2)]">
              Demo data: every second training frame of three Fruits-360 classes. Each class was filmed as a few videos of one rotating fruit, so its frames form a few large groups.
            </p>
          )}
          <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Fact k="Images with a copy" v={pct(r.linkedShare, 1)} />
            <Fact k="Copy groups (2+ images)" v={groups.length.toLocaleString()} />
            <Fact k="Largest group" v={sizes.length ? sizes[sizes.length - 1] : 1} />
            <Fact k="Median group size" v={sizes.length ? sizes[Math.floor(sizes.length / 2)] : 1} />
            <Fact k="Byte-identical sets" v={r.duplicateSets.length} />
            <Fact k="…under different labels" v={r.duplicateSets.filter((d) => d.conflicting).length} warn={r.duplicateSets.some((d) => d.conflicting)} />
          </div>

          <div className="card mt-8 p-5 sm:p-6">
            <h3 className="text-[17px] font-semibold">Download a group-aware split</h3>
            <p className="mt-1 text-[14.5px] text-[var(--color-ink-2)]">Whole groups go to one side, so no detected copy crosses the split. Groups are a lower bound, so report this split as an estimate, not a clean test.</p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label><span className="label">Test share (%)</span><input className="field w-28" type="number" min={5} max={50} value={testFrac} onChange={(e) => setTestFrac(Math.max(5, Math.min(50, Number(e.target.value) || 20)))} /></label>
              <label><span className="label">Seed</span><input className="field w-28" type="number" min={0} value={seed} onChange={(e) => setSeed(Math.max(0, Number(e.target.value) || 0))} /></label>
              <button className="btn btn-primary" onClick={() => {
                const s = groupSplit(r.group, testFrac / 100, seed);
                download("augleak-split.csv", csv([["image", "class", "group", "split"], ...result.items.map((x, i) => [x.name, x.label, r.group[i], s.test.includes(i) ? "test" : "train"])]), "text/csv");
              }}>Download split (CSV)</button>
              <button className="btn btn-ghost" onClick={() => download("augleak-groups.csv", csv([["image", "class", "group", "group_size"], ...result.items.map((x, i) => [x.name, x.label, r.group[i], r.groupSizes[r.group[i]]])]), "text/csv")}>Groups (CSV)</button>
              <button className="btn btn-ghost" disabled={!r.links.length} onClick={() => download("augleak-links.csv", csv([["image_a", "image_b", "p_value", "byte_identical"], ...r.links.map((l) => [result.items[l.a].name, result.items[l.b].name, l.p.toExponential(3), l.exact])]), "text/csv")}>Links (CSV)</button>
            </div>
          </div>

          {groups.length > 0 && (
            <>
              <h3 className="mt-10 text-[20px] font-semibold">Largest copy groups</h3>
              <p className="mt-1 text-[14.5px] text-[var(--color-ink-2)]">Select an image to see the link that put it in its group.</p>
              <ol className="mt-4 grid gap-3">
                {groups.slice(0, shown).map((g, k) => (
                  <li key={k} className="card p-3.5">
                    <div className="flex items-baseline justify-between gap-3 text-[14px]">
                      <span className="font-semibold">{result.items[g[0]].label}</span>
                      <span className="mono text-[var(--color-ink-2)]">{g.length} images</span>
                    </div>
                    <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1">
                      {g.slice(0, 14).map((i) => (
                        <button key={i} type="button" className="shrink-0 rounded-lg focus-visible:outline-2" onClick={() => { const l = linkOf.get(i); if (l) setLink(l); }} title={result.items[i].name}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={urlOf(result.items[i])} alt={result.items[i].name} loading="lazy" className="h-16 w-16 rounded-lg bg-[var(--color-paper-2)] object-cover ring-1 ring-[var(--color-rule)]" />
                        </button>
                      ))}
                      {g.length > 14 && <span className="mono grid shrink-0 place-items-center px-2 text-[13px] text-[var(--color-ink-3)]">+{g.length - 14}</span>}
                    </div>
                  </li>
                ))}
              </ol>
              {shown < groups.length && <button className="btn btn-ghost mt-5" onClick={() => setShown(shown + 20)}>Show more groups ({groups.length - shown} left)</button>}
              <p className="mt-4 text-[14px] text-[var(--color-ink-3)]">Strongest link: p = {fmtP(r.links[0]?.p ?? 1)}. Images of different classes are never linked.</p>
            </>
          )}
          {link && (
            <PairModal a={result.items[link.a]} b={result.items[link.b]} aLabel="image A" bLabel="image B" p={link.p} exact={link.exact} onClose={() => setLink(null)} />
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
      <p className="display mt-1 text-[30px] leading-none tnum">{v}</p>
    </div>
  );
}
