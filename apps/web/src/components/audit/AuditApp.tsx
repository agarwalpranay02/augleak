"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { alphaLabel, pct } from "@/lib/format";
import { clearHistory, loadHistory, type AuditSummary } from "@/lib/history";
import { CheckSplit } from "./CheckSplit";
import { FindCopies } from "./FindCopies";

export function AuditApp() {
  const params = useSearchParams();
  const router = useRouter();
  const mode = params.get("mode") === "groups" ? "groups" : "split";
  const autoDemo = params.get("demo") === "1";
  const [history, setHistory] = useState<AuditSummary[]>([]);
  const refresh = useCallback(() => { loadHistory().then(setHistory); }, []);
  useEffect(refresh, [refresh]);

  const tabs = [
    { id: "split", label: "Check a train/test split", sub: "Two folders" },
    { id: "groups", label: "Find copy groups", sub: "One folder, before you split" },
  ] as const;

  return (
    <>
      <div role="tablist" aria-label="Audit mode" className="grid gap-2 sm:grid-cols-2">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={mode === t.id}
            onClick={() => router.replace(t.id === "groups" ? "/audit?mode=groups" : "/audit", { scroll: false })}
            className={`rounded-2xl border px-5 py-4 text-left transition-colors ${mode === t.id ? "border-[var(--color-ink)] bg-[var(--color-card)] shadow-[0_0_0_1px_var(--color-ink)]" : "border-[var(--color-rule)] bg-transparent hover:bg-[var(--color-card)]"}`}>
            <span className="block text-[17px] font-semibold">{t.label}</span>
            <span className="block text-[14px] text-[var(--color-ink-2)]">{t.sub}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-8">
        {mode === "split" ? <CheckSplit autoDemo={autoDemo} onHistory={refresh} /> : <FindCopies onHistory={refresh} />}
      </div>

      {history.length > 0 && (
        <section className="mt-16" aria-label="Recent audits">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[18px] font-semibold">Recent audits on this device</h2>
            <button className="text-[14px] text-[var(--color-ink-2)] underline" onClick={async () => { await clearHistory(); refresh(); }}>Clear</button>
          </div>
          <p className="mt-1 text-[14px] text-[var(--color-ink-3)]">Summaries only, stored in this browser. Images are never stored.</p>
          <div className="card mt-4 overflow-x-auto">
            <table className="table-site">
              <thead><tr><th>When</th><th>What</th><th>Result</th><th className="num">Images</th><th className="num">α</th><th className="num">Time</th></tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="whitespace-nowrap">{new Date(h.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td>{h.name}<span className="ml-2 chip chip-plain">{h.mode === "split" ? "split" : "groups"}</span></td>
                    <td>{h.headline} <span className="text-[var(--color-ink-3)]">({pct(h.share, 1)})</span></td>
                    <td className="num">{h.images.toLocaleString()}</td>
                    <td className="num">{alphaLabel(h.alpha)}</td>
                    <td className="num">{h.seconds.toFixed(1)} s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
