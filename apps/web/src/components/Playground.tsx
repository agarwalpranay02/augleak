"use client";
import { useState } from "react";

const SAMPLE_A = "/registry/cifar-10/3-test.jpg";
const SAMPLE_B = "/registry/cifar-10/3-train.jpg";

/** Calls the live API from the page: exposure without a key, compare with one. */
export function Playground() {
  const [key, setKey] = useState("");
  const [a, setA] = useState<File | null>(null);
  const [b, setB] = useState<File | null>(null);
  const [out, setOut] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function call(fn: () => Promise<Response>) {
    setBusy(true); setOut(""); setStatus("");
    try {
      const t0 = performance.now();
      const r = await fn();
      setStatus(`${r.status} ${r.statusText || ""} · ${(performance.now() - t0).toFixed(0)} ms`);
      setOut(JSON.stringify(await r.json(), (k, v) => (k === "per_transform" ? "[28 + 28 values]" : v), 2));
    } catch (e) {
      setStatus("network error"); setOut(String(e));
    } finally { setBusy(false); }
  }

  async function compare() {
    const fa = a ?? new File([await (await fetch(SAMPLE_A)).blob()], "sample-a.jpg", { type: "image/jpeg" });
    const fb = b ?? new File([await (await fetch(SAMPLE_B)).blob()], "sample-b.jpg", { type: "image/jpeg" });
    const fd = new FormData();
    fd.append("a", fa); fd.append("b", fb);
    await call(() => fetch("/api/v1/compare", { method: "POST", headers: { Authorization: `Bearer ${key.trim()}` }, body: fd }));
  }

  return (
    <div className="card p-6 sm:p-8">
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <label className="block"><span className="label">API key (for compare and features)</span>
            <input className="field mono" placeholder="al_live_…" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} />
          </label>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="block"><span className="label">Image a</span><input type="file" accept="image/*" className="block w-full text-[14px]" onChange={(e) => setA(e.target.files?.[0] ?? null)} /></label>
            <label className="block"><span className="label">Image b</span><input type="file" accept="image/*" className="block w-full text-[14px]" onChange={(e) => setB(e.target.files?.[0] ?? null)} /></label>
          </div>
          <p className="mt-2 text-[13.5px] text-[var(--color-ink-3)]">Leave the files empty to send a sample pair: a CIFAR-10 test image and its flipped training copy.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={busy || !key.trim()} onClick={compare}>POST /api/v1/compare</button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => call(() => fetch("/api/v1/exposure?photos=1000&copies=16&test_share=0.2"))}>GET /api/v1/exposure</button>
          </div>
        </div>
        <div>
          <p className="label">Response {status && <span className="mono ml-2 text-[var(--color-ink-3)]">{status}</span>}</p>
          <pre className="code min-h-[240px] whitespace-pre-wrap" aria-live="polite">{out || "Send a request to see the response."}</pre>
        </div>
      </div>
    </div>
  );
}
