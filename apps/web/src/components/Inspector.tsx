"use client";
import { useEffect, useRef, useState } from "react";
import { DIM, DISC, RES, featuresFromRGBA, type ImageFeatures } from "@/lib/engine/core/features";
import { decodeRGBA, sha256Hex } from "@/lib/engine/decode";
import { comparePair, hashHex, type PairReport } from "@/lib/engine/pair";
import { VIEW_NAMES } from "@/lib/engine/transforms";

interface Side { url: string; name: string; f: ImageFeatures; sha: string; w: number; h: number }

const SAMPLES = [
  { label: "CIFAR-10: a flipped duplicate", a: "/registry/cifar-10/3-test.jpg", b: "/registry/cifar-10/3-train.jpg" },
  { label: "Brain MRI: the same slice, re-encoded", a: "/registry/brain-mri/1-test.jpg", b: "/registry/brain-mri/1-train.jpg" },
  { label: "Fruits-360: nearby video frames", a: "/registry/fruits-360/1-test.jpg", b: "/registry/fruits-360/1-train.jpg" },
  { label: "Two different photographs", a: "/registry/brain-mri/1-test.jpg", b: "/registry/cifar-10/0-train.jpg" },
];

async function load(blob: Blob, name: string): Promise<Side> {
  const buf = await blob.arrayBuffer();
  const [{ data, w, h }, sha] = await Promise.all([decodeRGBA(new Blob([buf])), sha256Hex(buf)]);
  return { url: URL.createObjectURL(new Blob([buf])), name, f: featuresFromRGBA(data, w, h), sha, w, h };
}

export function Inspector() {
  const [A, setA] = useState<Side | null>(null);
  const [B, setB] = useState<Side | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const rep: PairReport | null = A && B ? comparePair(A.f, B.f) : null;

  async function sample(i: number) {
    setErr(null);
    try {
      const s = SAMPLES[i];
      const [a, b] = await Promise.all([s.a, s.b].map(async (u) => load(await (await fetch(u)).blob(), u.split("/").slice(-2).join("/"))));
      setA(a); setB(b);
    } catch { setErr("Could not load the sample."); }
  }
  useEffect(() => {
    const t = setTimeout(() => sample(0), 0);
    return () => clearTimeout(t);
  }, []);

  const best = rep ? (rep.structure.direction === "a_to_b" ? rep.aToB : rep.bToA) : [];
  const viewsOf = rep?.structure.direction === "b_to_a" ? B : A;
  const baseOf = rep?.structure.direction === "b_to_a" ? A : B;
  const top = best.length ? best.indexOf(Math.max(...best)) : -1;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <span className="self-center text-[14.5px] text-[var(--color-ink-2)]">Try a sample:</span>
        {SAMPLES.map((s, i) => <button key={s.label} className="btn btn-sm btn-ghost" onClick={() => sample(i)}>{s.label}</button>)}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_28px_1fr]">
        <Drop label="Image A" tone="test" side={A} onFile={async (f) => { try { setErr(null); setA(await load(f, f.name)); } catch { setErr("That file could not be decoded as an image."); } }} />
        <div className="seam hidden md:block" aria-hidden="true" />
        <Drop label="Image B" tone="train" side={B} onFile={async (f) => { try { setErr(null); setB(await load(f, f.name)); } catch { setErr("That file could not be decoded as an image."); } }} />
      </div>
      {err && <p className="mt-4 rounded-xl bg-[var(--color-leak-soft)] px-4 py-3 text-[14.5px] text-[#8a1435]">{err}</p>}

      {rep && A && B && (
        <section className="mt-10" aria-label="Comparison">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Fact k="Best structure correlation" v={rep.structure.score.toFixed(3)} hi={rep.structure.score > 0.9} />
            <Fact k="Under the transform" v={rep.structure.transform} small />
            <Fact k="Hash bits that agree" v={`${rep.hash.agreeingBits} / 64`} hi={rep.hash.agreeingBits >= 58} />
            <Fact k="Byte-identical files" v={A.sha === B.sha ? "yes" : "no"} hi={A.sha === B.sha} />
          </div>
          <p className="mt-4 max-w-3xl text-[14.5px] text-[var(--color-ink-2)]">
            A correlation of 1 means identical structure. Copies usually score above 0.9, but whether a score is high enough depends on how alike a dataset&apos;s images are.
            That is what the p-values of an <a className="text-[var(--color-train)] underline" href="/audit">audit</a> account for, using the dataset&apos;s other classes.
          </p>

          <h2 className="mt-10 text-[20px] font-semibold">What AugLeak compares</h2>
          <p className="mt-1 max-w-3xl text-[14.5px] text-[var(--color-ink-2)]">
            Each image is reduced to a blurred 32 × 32 thumbnail inside a circle, mean-centred and normalised. One image is tried in 28 versions; each tile shows that version and its correlation with the other image as it is. The best one counts.
          </p>
          <div className="mt-5 grid gap-6 lg:grid-cols-[180px_1fr]">
            <div>
              <p className="text-[14px] font-semibold">Reference: {baseOf === A ? "A" : "B"} as it is</p>
              <Thumb vec={baseOf!.f.base} off={0} size={160} ring="var(--color-train)" />
              <p className="mt-4 text-[14px] font-semibold">Hashes (64 bits)</p>
              <HashGrid hex={hashHex(A.f)} other={hashHex(B.f)} />
              <p className="mono mt-1 text-[12px] text-[var(--color-ink-3)]">A {hashHex(A.f)}<br />B {hashHex(B.f)}</p>
            </div>
            <ol className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-7">
              {VIEW_NAMES.map((n, t) => (
                <li key={n} className={`rounded-xl p-1.5 text-center ${t === top ? "bg-[var(--color-leak-soft)] ring-2 ring-[var(--color-leak)]" : "bg-[var(--color-card)] ring-1 ring-[var(--color-rule)]"}`}>
                  <Thumb vec={viewsOf!.f.views} off={t * DIM} size={84} />
                  <p className={`mono mt-1 text-[13px] ${t === top ? "font-semibold text-[var(--color-leak)]" : ""}`}>{best[t].toFixed(3)}</p>
                  <p className="text-[11.5px] leading-tight text-[var(--color-ink-3)]">{n}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}
    </div>
  );
}

function Fact({ k, v, hi, small }: { k: string; v: string; hi?: boolean; small?: boolean }) {
  return (
    <div className={`rounded-xl p-4 ${hi ? "bg-[var(--color-leak-soft)]" : "bg-[var(--color-card)] ring-1 ring-[var(--color-rule)]"}`}>
      <p className="text-[13.5px] text-[var(--color-ink-2)]">{k}</p>
      <p className={`mt-1 ${small ? "text-[18px] font-semibold leading-snug" : "display text-[34px] leading-none"} tnum ${hi ? "text-[var(--color-leak)]" : ""}`}>{v}</p>
    </div>
  );
}

function Drop({ label, tone, side, onFile }: { label: string; tone: "test" | "train"; side: Side | null; onFile: (f: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={`flex items-center gap-4 rounded-2xl border-2 border-dashed p-4 ${over ? "border-solid" : ""} ${tone === "test" ? "border-[var(--color-test)] bg-[var(--color-test-soft)]" : "border-[var(--color-train)] bg-[var(--color-train-soft)]"}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      onPaste={(e) => { const f = e.clipboardData.files[0]; if (f) onFile(f); }}
    >
      {side
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={side.url} alt={label} className="h-28 w-28 shrink-0 rounded-xl bg-white object-contain" />
        : <div className="grid h-28 w-28 shrink-0 place-items-center rounded-xl bg-white/60 text-[13px] text-[var(--color-ink-3)]">no image</div>}
      <div className="min-w-0">
        <p className={`text-[16px] font-semibold ${tone === "test" ? "text-[var(--color-test)]" : "text-[var(--color-train)]"}`}>{label}</p>
        {side && <p className="mono truncate text-[12.5px] text-[var(--color-ink-2)]" title={side.name}>{side.name} · {side.w}×{side.h}</p>}
        <p className="mt-1 text-[13.5px] text-[var(--color-ink-3)]">Drop, paste or choose an image.</p>
        <button className="btn btn-sm btn-ghost mt-2" onClick={() => input.current?.click()}>Choose image</button>
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      </div>
    </div>
  );
}

/** Renders a disc-shaped canonical vector (DIM values) as a grayscale thumbnail. */
function Thumb({ vec, off, size, ring }: { vec: Float32Array; off: number; size: number; ring?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(RES, RES);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < DIM; i++) { lo = Math.min(lo, vec[off + i]); hi = Math.max(hi, vec[off + i]); }
    for (let p = 0; p < RES * RES; p++) img.data.set([233, 237, 241, 255], p * 4);
    for (let i = 0; i < DIM; i++) {
      const v = Math.round(((vec[off + i] - lo) / (hi - lo || 1)) * 255);
      img.data.set([v, v, v, 255], DISC[i] * 4);
    }
    ctx.putImageData(img, 0, 0);
  }, [vec, off]);
  return <canvas ref={ref} width={RES} height={RES} className="mx-auto rounded-lg [image-rendering:pixelated]" style={{ width: size, height: size, boxShadow: ring ? `0 0 0 2px ${ring}` : undefined }} aria-hidden="true" />;
}

function HashGrid({ hex, other }: { hex: string; other: string }) {
  const bits = (h: string) => h.split("").flatMap((c) => parseInt(c, 16).toString(2).padStart(4, "0").split("").map(Number));
  const a = bits(hex), b = bits(other);
  return (
    <div className="mt-2 grid w-[160px] grid-cols-8 gap-[3px]" aria-label={`${a.filter((x, i) => x === b[i]).length} of 64 bits agree`}>
      {a.map((x, i) => (
        <span key={i} className="aspect-square rounded-[2px]" style={{ background: x === b[i] ? (x ? "var(--color-ink)" : "var(--color-rule)") : "var(--color-leak)" }} />
      ))}
    </div>
  );
}
