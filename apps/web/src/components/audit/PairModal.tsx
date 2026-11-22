"use client";
import { useEffect, useRef, useState } from "react";
import { featuresFromRGBA } from "@/lib/engine/core/features";
import { decodeRGBA } from "@/lib/engine/decode";
import type { InputImage } from "@/lib/engine/engine";
import { urlOf } from "@/lib/engine/files";
import { comparePair, type PairReport } from "@/lib/engine/pair";
import { fmtP } from "@/lib/format";

interface Props {
  a: InputImage; b: InputImage;
  aLabel: string; bLabel: string;
  p: number; exact: boolean;
  onClose: () => void;
  onPrev?: () => void; onNext?: () => void;
}

/** Side-by-side view of a linked pair, with an overlay slider and the transform that matched. */
export function PairModal({ a, b, aLabel, bLabel, p, exact, onClose, onPrev, onNext }: Props) {
  const [mix, setMix] = useState(0);
  const [computed, setRep] = useState<{ a: unknown; b: unknown; r: PairReport } | null>(null);
  const rep = computed && computed.a === a && computed.b === b ? computed.r : null;
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    const onKey = (e: KeyboardEvent) => { if (e.key === "ArrowLeft") onPrev?.(); if (e.key === "ArrowRight") onNext?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPrev, onNext]);

  useEffect(() => {
    let live = true;
    (async () => {
      const [da, db] = await Promise.all([decodeRGBA(a.blob), decodeRGBA(b.blob)]);
      const r = comparePair(featuresFromRGBA(da.data, da.w, da.h), featuresFromRGBA(db.data, db.w, db.h));
      if (live) setRep({ a, b, r });
    })().catch(() => {});
    return () => { live = false; };
  }, [a, b]);

  return (
    <dialog ref={dialog} onClose={onClose} onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      className="m-auto w-[min(980px,calc(100vw-24px))] rounded-2xl border border-[var(--color-rule)] bg-[var(--color-card)] p-0 text-[var(--color-ink)] backdrop:bg-[rgb(11_21_36/0.6)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-rule)] px-5 py-3">
        <h2 className="text-[16px] font-semibold">Linked pair</h2>
        <div className="flex items-center gap-1">
          {onPrev && <button className="btn btn-sm btn-ghost" onClick={onPrev} aria-label="Previous pair">Previous</button>}
          {onNext && <button className="btn btn-sm btn-ghost" onClick={onNext} aria-label="Next pair">Next</button>}
          <button className="btn btn-sm btn-ghost" onClick={() => dialog.current?.close()}>Close</button>
        </div>
      </div>
      <div className="grid gap-6 p-5 md:grid-cols-[1fr_280px]">
        <div>
          <div className="grid grid-cols-2 gap-3">
            <Pic img={a} label={aLabel} tone="test" />
            <Pic img={b} label={bLabel} tone="train" />
          </div>
          <div className="mt-4">
            <div className="relative mx-auto aspect-square w-full max-w-[420px] overflow-hidden rounded-xl bg-[var(--color-paper-2)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urlOf(a)} alt="" className="absolute inset-0 h-full w-full object-contain" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urlOf(b)} alt="" className="absolute inset-0 h-full w-full object-contain" style={{ opacity: mix / 100 }} />
            </div>
            <label className="mx-auto mt-3 flex max-w-[420px] items-center gap-3 text-[14px] text-[var(--color-ink-2)]">
              <span className="shrink-0">{aLabel}</span>
              <input type="range" min={0} max={100} value={mix} onChange={(e) => setMix(+e.target.value)} className="w-full accent-[var(--color-leak)]" aria-label="Blend between the two images" />
              <span className="shrink-0">{bLabel}</span>
            </label>
          </div>
        </div>
        <dl className="grid content-start gap-3 text-[14.5px]">
          <Row k="Verdict" v={exact ? <span className="chip chip-leak">byte-identical files</span> : <span className="chip chip-leak">linked copy</span>} />
          <Row k="p-value" v={<span className="mono">{exact ? "0" : fmtP(p)}</span>} />
          <Row k="Class" v={a.label} />
          <Row k="Best transform" v={rep ? <span>{rep.structure.transform}{rep.structure.direction === "b_to_a" ? ` (of the ${bLabel} image)` : ""}</span> : <span className="text-[var(--color-ink-3)]">computing…</span>} />
          <Row k="Structure correlation" v={rep ? <span className="mono">{rep.structure.score.toFixed(3)}</span> : "…"} />
          <Row k="Hash bits that agree" v={rep ? <span className="mono">{rep.hash.agreeingBits} / 64 ({rep.hash.transform})</span> : "…"} />
          <p className="mt-2 text-[13.5px] text-[var(--color-ink-3)]">
            The p-value comes from the whole audit: it compares this pair&apos;s hubness-corrected score with the best matches between different classes.
          </p>
        </dl>
      </div>
    </dialog>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 border-b border-[var(--color-rule-2)] pb-2">
      <dt className="text-[var(--color-ink-3)]">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function Pic({ img, label, tone }: { img: InputImage; label: string; tone: "test" | "train" }) {
  return (
    <figure>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={urlOf(img)} alt={`${label} image ${img.name}`} className={`aspect-square w-full rounded-xl bg-[var(--color-paper-2)] object-contain ring-2 ${tone === "test" ? "ring-[var(--color-test)]" : "ring-[var(--color-train)]"}`} />
      <figcaption className="mt-2 flex items-center gap-2 text-[13px]">
        <span className={`chip ${tone === "test" ? "chip-test" : "chip-train"}`}>{label}</span>
        <span className="mono truncate text-[var(--color-ink-2)]" title={img.name}>{img.name}</span>
      </figcaption>
    </figure>
  );
}
