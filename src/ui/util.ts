export function download(name: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function csv(rows: (string | number | boolean)[][]): string {
  return rows.map((r) => r.map((v) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n") + "\n";
}

/** p-values as 3.1 × 10⁻⁸ style strings. */
export function fmtP(p: number): string {
  if (p === 0) return "exact copy";
  if (p < 1e-38) return "< 10⁻³⁸";
  if (p >= 0.01) return p.toFixed(2);
  const e = Math.floor(Math.log10(p));
  const m = p / 10 ** e;
  const sup = String(e).replace(/-/g, "⁻").replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+d]);
  return `${m.toFixed(1)} × 10${sup}`;
}

export function pct(x: number, d = 0): string {
  return `${(100 * x).toFixed(d)}%`;
}

export const ALPHAS = [1e-2, 1e-3, 1e-4] as const;
export const alphaLabel = (a: number) => ({ 0.01: "10⁻²", 0.001: "10⁻³", 0.0001: "10⁻⁴" } as Record<number, string>)[a] ?? String(a);
