import type { Progress } from "../engine/engine";

const LABEL = { reading: "Reading images", comparing: "Comparing images", testing: "Computing p-values" } as const;

export function ProgressBar({ p }: { p: Progress }) {
  const frac = p.stage === "testing" ? 1 : p.total ? p.done / p.total : 0;
  return (
    <div className="progress" role="status">
      <div className="progress-text">
        <span>{LABEL[p.stage]}</span>
        {p.stage !== "testing" && <span className="num">{p.done.toLocaleString()} / {p.total.toLocaleString()}</span>}
      </div>
      <div className={`progress-track${p.stage === "testing" ? " pulse" : ""}`}><div style={{ width: `${(100 * frac).toFixed(1)}%` }} /></div>
    </div>
  );
}
