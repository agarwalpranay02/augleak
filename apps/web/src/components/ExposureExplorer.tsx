"use client";
import { useId, useState } from "react";
import { exposure } from "@/lib/engine/core/stats";

/**
 * Proposition 1 and 2 of the paper, interactive: how many test images have a copy in training
 * under a random split, and what that does to the accuracy a paper reports.
 */
export function ExposureExplorer({ compact = false }: { compact?: boolean }) {
  const [k, setK] = useState(8);
  const [test, setTest] = useState(20);
  const [seen, setSeen] = useState(99);
  const [fresh, setFresh] = useState(70);
  const photos = 1000;
  const q = exposure(photos * k, Math.round(photos * k * (1 - test / 100)), k);
  const reported = q * seen + (1 - q) * fresh;
  const id = useId();

  // exposure curve over k = 1..32
  const ks = Array.from({ length: 32 }, (_, i) => i + 1);
  const pts = ks.map((kk) => [kk, exposure(photos * kk, Math.round(photos * kk * (1 - test / 100)), kk)] as const);
  const X = (kk: number) => 36 + ((kk - 1) / 31) * 300;
  const Y = (v: number) => 14 + (1 - v) * 150;
  const path = pts.map(([kk, v], i) => `${i ? "L" : "M"}${X(kk).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");

  return (
    <div className={`grid gap-6 ${compact ? "" : "lg:grid-cols-2"}`}>
      <div className="card p-5 sm:p-6">
        <h3 className="text-[17px] font-semibold">How many test images have a copy in training?</h3>
        <p className="mt-1 text-[14.5px] text-[var(--color-ink-2)]">A random split of a release that ships every photograph with copies.</p>
        <div className="mt-5 grid gap-4">
          <Slider id={`${id}-k`} label="Images per photograph, original included" value={k} min={1} max={32} onChange={setK} suffix="" />
          <Slider id={`${id}-t`} label="Test share" value={test} min={5} max={50} onChange={setTest} suffix="%" />
        </div>
        <div className="mt-5 flex items-end gap-4">
          <p className="display text-[64px] leading-none text-[var(--color-leak)] tnum">{(100 * q).toFixed(q > 0.995 && q < 1 ? 1 : 0)}%</p>
          <p className="pb-1 text-[15px] text-[var(--color-ink-2)]">of test images have at least one copy in the training set.</p>
        </div>
        <svg viewBox="0 0 350 190" className="mt-4 w-full" role="img" aria-label={`Exposure rises with the number of copies per photograph; at ${k} it is ${(100 * q).toFixed(0)}%.`}>
          {[0, 0.5, 1].map((v) => (
            <g key={v}>
              <line x1={36} x2={336} y1={Y(v)} y2={Y(v)} stroke="var(--color-rule-2)" />
              <text x={30} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-3)">{v * 100}%</text>
            </g>
          ))}
          {[1, 8, 16, 24, 32].map((kk) => <text key={kk} x={X(kk)} y={182} textAnchor="middle" fontSize="11" fill="var(--color-ink-3)">{kk}</text>)}
          <path d={path} fill="none" stroke="var(--color-leak)" strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx={X(k)} cy={Y(q)} r="5" fill="var(--color-leak)" stroke="#fff" strokeWidth="2" />
        </svg>
        <p className="text-[13px] text-[var(--color-ink-3)]">Images per photograph (x) against the share of exposed test images (y), for 1,000 photographs.</p>
      </div>

      <div className="card p-5 sm:p-6">
        <h3 className="text-[17px] font-semibold">What that does to the reported accuracy</h3>
        <p className="mt-1 text-[14.5px] text-[var(--color-ink-2)]">
          The reported score is a mix of two scores, weighted by exposure: <span className="mono text-[13.5px]">reported = q × seen + (1 − q) × new</span>.
        </p>
        <div className="mt-5 grid gap-4">
          <Slider id={`${id}-s`} label="Accuracy on test images whose copy was in training" value={seen} min={40} max={100} onChange={setSeen} suffix="%" />
          <Slider id={`${id}-f`} label="Accuracy on genuinely new photographs" value={fresh} min={20} max={100} onChange={setFresh} suffix="%" />
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-[var(--color-leak-soft)] p-4">
            <dt className="text-[14px] text-[var(--color-ink-2)]">The paper would report</dt>
            <dd className="display mt-1 text-[44px] leading-none text-[var(--color-leak)] tnum">{reported.toFixed(1)}%</dd>
          </div>
          <div className="rounded-xl bg-[var(--color-ok-soft)] p-4">
            <dt className="text-[14px] text-[var(--color-ink-2)]">Deployment would see</dt>
            <dd className="display mt-1 text-[44px] leading-none text-[var(--color-ok)] tnum">{fresh.toFixed(1)}%</dd>
          </div>
        </dl>
        <p className="mt-4 text-[14px] text-[var(--color-ink-2)]">
          The error can also go the other way: heavily filtered copies are harder than the originals, so a test set full of them can understate accuracy. The paper measures both cases.
        </p>
      </div>
    </div>
  );
}

function Slider({ id, label, value, min, max, onChange, suffix }: { id: string; label: string; value: number; min: number; max: number; onChange: (v: number) => void; suffix: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[14.5px] text-[var(--color-ink-2)]">{label}</label>
        <span className="mono text-[14px] font-medium">{value}{suffix}</span>
      </div>
      <input id={id} type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full accent-[var(--color-leak)]" />
    </div>
  );
}
