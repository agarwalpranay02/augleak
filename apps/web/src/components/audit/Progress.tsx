"use client";
import { useEffect, useState } from "react";
import type { Progress } from "@/lib/engine/engine";

const LABEL = { reading: "Reading images", comparing: "Comparing every pair", testing: "Computing p-values" } as const;

export function ProgressBar({ p, started }: { p: Progress; started: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const frac = p.stage === "testing" ? 1 : p.total ? p.done / p.total : 0;
  const elapsed = Math.max(0, (now - started) / 1000);
  return (
    <div className="card mt-6 p-5" role="status">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-[15px]">
        <span className="font-semibold" aria-live="polite">{LABEL[p.stage]}</span>
        <span className="mono text-[13.5px] text-[var(--color-ink-2)]">
          {p.stage !== "testing" && `${p.done.toLocaleString()} / ${p.total.toLocaleString()} · `}{elapsed.toFixed(0)} s
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-rule-2)]">
        <div className={`h-full rounded-full bg-[var(--color-ink)] transition-[width] duration-200 ${p.stage === "testing" ? "animate-pulse-soft" : ""}`} style={{ width: `${(100 * frac).toFixed(1)}%` }} />
      </div>
      <p className="mt-3 text-[13.5px] text-[var(--color-ink-3)]">
        {p.stage === "testing" ? "Fitting a null model per test image and class. On a laptop this takes a few seconds to a minute." : "Everything runs on this device, one worker per processor core. Keep this tab open."}
      </p>
    </div>
  );
}
