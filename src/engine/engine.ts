// Orchestrates an audit in the browser: a pool of workers computes features and score blocks,
// a separate worker runs the statistics. Nothing leaves the user's device.
import type { ImageRef, ScanReport, SplitReport } from "../core/audit";
import { DIM, N_HASH, N_VIEWS } from "../core/features";
import type { WorkerIn, WorkerOut } from "./worker";

export interface InputImage { name: string; label: string; blob: Blob; url: string }
export interface Progress { stage: "reading" | "comparing" | "testing"; done: number; total: number }
interface Feat { base: Float32Array; views: Float32Array; hash: Float32Array; sha: string }

export const MAX_IMAGES = 4000;

function poolSize() {
  const c = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4;
  return Math.max(1, Math.min(8, c - 1));
}

function spawn(): Worker {
  return new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
}

async function features(images: InputImage[], pool: Worker[], onProgress: (p: Progress) => void): Promise<{ feats: Feat[]; failed: { name: string; message: string }[] }> {
  const feats: Feat[] = new Array(images.length);
  const failed: { name: string; message: string }[] = [];
  let done = 0;
  const chunks: { idx: number; blob: Blob }[][] = pool.map(() => []);
  images.forEach((im, i) => chunks[i % pool.length].push({ idx: i, blob: im.blob }));
  await Promise.all(pool.map((w, k) => new Promise<void>((resolve) => {
    w.onmessage = (e: MessageEvent<WorkerOut>) => {
      const m = e.data;
      if (m.type === "feature") { feats[m.idx] = { base: m.base, views: m.views, hash: m.hash, sha: m.sha }; done++; onProgress({ stage: "reading", done, total: images.length }); }
      else if (m.type === "featureError") { failed.push({ name: images[m.idx].name, message: m.message }); done++; }
      else if (m.type === "featuresDone") resolve();
    };
    w.postMessage({ type: "features", jobs: chunks[k] } satisfies WorkerIn);
  })));
  return { feats, failed };
}

async function scores(queries: Feat[], database: Feat[], pool: Worker[], onProgress: (p: Progress) => void) {
  const nq = queries.length, nb = database.length;
  const base = new Float32Array(nb * DIM), hb = new Float32Array(nb * 64);
  database.forEach((f, j) => { base.set(f.base, j * DIM); hb.set(f.hash.subarray(0, 64), j * 64); });
  await Promise.all(pool.map((w) => new Promise<void>((resolve) => {
    w.onmessage = (e: MessageEvent<WorkerOut>) => { if (e.data.type === "baseSet") resolve(); };
    w.postMessage({ type: "setBase", base, hb, nb } satisfies WorkerIn);
  })));
  const S = new Float32Array(nq * nb), H = new Float32Array(nq * nb);
  const block = Math.max(1, Math.min(32, Math.ceil(nq / (pool.length * 4))));
  const starts: number[] = [];
  for (let i = 0; i < nq; i += block) starts.push(i);
  let next = 0, done = 0;
  await Promise.all(pool.map((w) => new Promise<void>((resolve) => {
    const send = () => {
      if (next >= starts.length) { resolve(); return; }
      const first = starts[next++], rows = Math.min(block, nq - first);
      const views = new Float32Array(rows * N_VIEWS * DIM), hq = new Float32Array(rows * N_HASH * 64);
      for (let r = 0; r < rows; r++) { views.set(queries[first + r].views, r * N_VIEWS * DIM); hq.set(queries[first + r].hash, r * N_HASH * 64); }
      w.postMessage({ type: "score", first, rows, views, hq } satisfies WorkerIn, [views.buffer, hq.buffer]);
    };
    w.onmessage = (e: MessageEvent<WorkerOut>) => {
      const m = e.data;
      if (m.type !== "scored") return;
      S.set(m.S, m.first * nb); H.set(m.H, m.first * nb);
      done += m.rows; onProgress({ stage: "comparing", done, total: nq });
      send();
    };
    send();
  })));
  return { S, H };
}

function stats<T>(msg: unknown, transfer: Transferable[]): Promise<T> {
  const w = new Worker(new URL("./stats.worker.ts", import.meta.url), { type: "module" });
  return new Promise<T>((resolve, reject) => {
    w.onmessage = (e) => { w.terminate(); if (e.data.ok) resolve(e.data.result as T); else reject(new Error(e.data.message)); };
    w.onerror = (e) => { w.terminate(); reject(new Error(e.message)); };
    w.postMessage(msg, transfer);
  });
}

const refs = (imgs: InputImage[], feats: Feat[]): ImageRef[] => imgs.map((im, i) => ({ name: im.name, label: im.label, hash: feats[i].sha }));

function keepGood(imgs: InputImage[], feats: Feat[]) {
  const keep = imgs.map((_, i) => !!feats[i]);
  return { imgs: imgs.filter((_, i) => keep[i]), feats: feats.filter((_, i) => keep[i]) };
}

export async function runCheck(train: InputImage[], test: InputImage[], alpha: number, onProgress: (p: Progress) => void) {
  const pool = Array.from({ length: poolSize() }, spawn);
  try {
    const all = await features([...train, ...test], pool, onProgress);
    const tr = keepGood(train, all.feats.slice(0, train.length));
    const te = keepGood(test, all.feats.slice(train.length));
    const { S, H } = await scores(te.feats, tr.feats, pool, onProgress);
    onProgress({ stage: "testing", done: 0, total: 1 });
    const report = await stats<SplitReport>({ type: "check", train: refs(tr.imgs, tr.feats), test: refs(te.imgs, te.feats), S, H, alpha }, [S.buffer, H.buffer]);
    return { report, train: tr.imgs, test: te.imgs, failed: all.failed };
  } finally { pool.forEach((w) => w.terminate()); }
}

export async function runScan(items: InputImage[], alpha: number, onProgress: (p: Progress) => void) {
  const pool = Array.from({ length: poolSize() }, spawn);
  try {
    const all = await features(items, pool, onProgress);
    const it = keepGood(items, all.feats);
    const { S, H } = await scores(it.feats, it.feats, pool, onProgress);
    onProgress({ stage: "testing", done: 0, total: 1 });
    const report = await stats<ScanReport>({ type: "scan", items: refs(it.imgs, it.feats), S, H, alpha }, [S.buffer, H.buffer]);
    return { report, items: it.imgs, failed: all.failed };
  } finally { pool.forEach((w) => w.terminate()); }
}
