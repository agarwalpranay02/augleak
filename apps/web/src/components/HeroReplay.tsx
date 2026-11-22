"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fmtP } from "@/lib/format";

export interface ReplayPair { test: string; train: string; p: number }
interface Props { pairs: ReplayPair[]; cleanTest: string[]; otherTrain: string[]; nTest: number; nTrain: number; nFlagged: number }

const W = 560, H = 430, TILE = 56, GAP = 10;
const COLS_X = { test: [24, 24 + TILE + GAP], train: [W - 24 - 2 * TILE - GAP, W - 24 - TILE] };
const ROW_Y = (r: number) => 52 + r * (TILE + GAP);

/** Replays the bundled Fruits-360 demo audit: each flagged test image is linked to its training copy. */
export function HeroReplay({ pairs, cleanTest, otherTrain, nTest, nTrain, nFlagged }: Props) {
  const layout = useMemo(() => {
    // 12 test tiles (flagged + clean, interleaved) on the left, 12 training tiles on the right
    const test = [...pairs.map((p) => ({ src: p.test, k: pairs.indexOf(p) })), ...cleanTest.map((src) => ({ src, k: -1 }))];
    const order = [0, 6, 1, 8, 2, 7, 3, 9, 4, 10, 5, 11].map((i) => test[i]).filter(Boolean);
    const trainSlots = [3, 10, 0, 7, 5, 1];
    const train: { src: string; k: number }[] = Array.from({ length: 12 }, () => ({ src: "", k: -1 }));
    pairs.forEach((p, k) => (train[trainSlots[k]] = { src: p.train, k }));
    let o = 0;
    for (let i = 0; i < 12; i++) if (!train[i].src) train[i] = { src: otherTrain[o++], k: -1 };
    const pos = (i: number, side: "test" | "train") => ({ x: COLS_X[side][i % 2], y: ROW_Y(Math.floor(i / 2)) });
    const links = pairs.map((_, k) => {
      const a = pos(order.findIndex((t) => t.k === k), "test");
      const b = pos(train.findIndex((t) => t.k === k), "train");
      const x1 = a.x + TILE, y1 = a.y + TILE / 2, x2 = b.x, y2 = b.y + TILE / 2;
      const mx = (x1 + x2) / 2;
      return { d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, k };
    });
    return { order, train, pos, links };
  }, [pairs, cleanTest, otherTrain]);

  const [step, setStep] = useState(0);
  const [run, setRun] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { const t = setTimeout(() => setStep(pairs.length + 1), 0); return () => clearTimeout(t); }
    const timers = [setTimeout(() => setStep(0), 0), ...Array.from({ length: pairs.length + 1 }, (_, i) => setTimeout(() => setStep(i + 1), 900 + i * 650))];
    return () => timers.forEach(clearTimeout);
  }, [run, pairs.length]);
  const done = step > pairs.length;
  const shown = Math.min(step, pairs.length);

  return (
    <figure className="relative rounded-2xl border border-white/12 bg-[var(--color-night-2)] p-3 shadow-[0_40px_80px_-40px_rgb(0_0_0/0.7)] sm:p-4">
      <div className="flex items-center justify-between px-1 pb-2 text-[13px] text-white/70">
        <span className="mono">fruits-360 · official split · α = 10⁻³</span>
        <span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${done ? "bg-[var(--color-leak)]" : "bg-emerald-400 animate-pulse-soft"}`} />{done ? "audit complete" : "auditing"}</span>
      </div>
      <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
          <line x1={W / 2} y1={30} x2={W / 2} y2={H - 8} stroke="rgb(255 255 255 / 0.22)" strokeWidth="2" strokeDasharray="5 6" />
          <text x={COLS_X.test[0]} y={30} fill="#e9b25a" fontSize="13" fontWeight="600" fontFamily="var(--font-sans)">test</text>
          <text x={COLS_X.train[1] + TILE} y={30} fill="#8db6e6" fontSize="13" fontWeight="600" textAnchor="end" fontFamily="var(--font-sans)">train</text>
          {layout.links.map((l) => (
            <path key={`${run}-${l.k}`} d={l.d} fill="none" stroke="#ff3d74" strokeWidth="2.2" strokeLinecap="round"
              style={{ strokeDasharray: 400, strokeDashoffset: l.k < shown ? 0 : 400, transition: "stroke-dashoffset .6s cubic-bezier(.22,1,.36,1)", opacity: l.k < shown ? 1 : 0 }} />
          ))}
        </svg>
        {layout.order.map((t, i) => {
          const p = layout.pos(i, "test");
          const hit = t.k >= 0 && t.k < shown;
          return <Tile key={`t${i}`} src={t.src} x={p.x} y={p.y} color={hit ? "#ff3d74" : "#b4730b"} dim={done && t.k < 0} />;
        })}
        {layout.train.map((t, i) => {
          const p = layout.pos(i, "train");
          const hit = t.k >= 0 && t.k < shown;
          return <Tile key={`r${i}`} src={t.src} x={p.x} y={p.y} color={hit ? "#ff3d74" : "#2a62a4"} dim={done && t.k < 0} />;
        })}
        {pairs.map((p, k) => k === shown - 1 && !done && (
          <div key={k} className="mono absolute left-1/2 -translate-x-1/2 rounded-md bg-[var(--color-night)] px-2 py-1 text-[12px] text-[#ff8fb0]" style={{ top: `${(H - 30) / H * 100}%` }}>
            p = {fmtP(p.p)}
          </div>
        ))}
      </div>
      <figcaption className="flex flex-wrap items-end justify-between gap-3 px-1 pt-3">
        <p className="text-[15px] text-white/85">
          <span className="display text-[40px] leading-none text-white tnum">{done ? nFlagged : "…"}</span>
          <span className="ml-2">of {nTest} test images have a copy among {nTrain} training images</span>
        </p>
        <div className="flex gap-2">
          <button type="button" className="btn btn-sm btn-on-night" onClick={() => setRun((r) => r + 1)}>Replay</button>
          <Link href="/audit?demo=1" className="btn btn-sm btn-leak">Run it yourself</Link>
        </div>
      </figcaption>
    </figure>
  );
}

function Tile({ src, x, y, color, dim }: { src: string; x: number; y: number; color: string; dim: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/demo/fruits360/${src}`}
      alt=""
      width={TILE}
      height={TILE}
      className="absolute rounded-md bg-white object-contain transition-[opacity,box-shadow] duration-500"
      style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, width: `${(TILE / W) * 100}%`, height: `${(TILE / H) * 100}%`, boxShadow: `0 0 0 2px ${color}`, opacity: dim ? 0.35 : 1 }}
    />
  );
}
