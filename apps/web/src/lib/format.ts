/** p-values as "3.1 × 10⁻⁸"; 0 means a byte-identical copy. */
export function fmtP(p: number): string {
  if (p === 0) return "0 (identical file)";
  if (!Number.isFinite(p)) return "–";
  if (p < 1e-38) return "< 10⁻³⁸";
  if (p >= 0.01) return p.toFixed(2);
  const e = Math.floor(Math.log10(p));
  const m = p / 10 ** e;
  return `${m.toFixed(1)} × 10${sup(e)}`;
}

export function sup(n: number): string {
  return String(n).replace(/-/g, "⁻").replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+d]);
}

export const pct = (x: number, d = 0) => `${(100 * x).toFixed(d)}%`;

export const ALPHAS = [1e-2, 1e-3, 1e-4] as const;
export const alphaLabel = (a: number) => `10${sup(Math.round(Math.log10(a)))}`;

export function csv(rows: (string | number | boolean)[][]): string {
  return rows.map((r) => r.map((v) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n") + "\n";
}

export function download(name: string, text: string | Blob, type = "text/plain") {
  const url = URL.createObjectURL(typeof text === "string" ? new Blob([text], { type }) : text);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
