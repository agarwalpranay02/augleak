/// <reference lib="webworker" />
// Runs the statistical part of an audit off the main thread.
import { checkSplit, scanRelease, type ImageRef } from "./core/audit";

export type StatsIn =
  | { type: "check"; train: ImageRef[]; test: ImageRef[]; S: Float32Array; H: Float32Array; alpha: number }
  | { type: "scan"; items: ImageRef[]; S: Float32Array; H: Float32Array; alpha: number };

self.onmessage = (e: MessageEvent<StatsIn>) => {
  const m = e.data;
  try {
    const result = m.type === "check" ? checkSplit(m.train, m.test, m.S, m.H, m.alpha) : scanRelease(m.items, m.S, m.H, m.alpha);
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({ ok: true, result });
  } catch (err) {
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({ ok: false, message: err instanceof Error ? err.message : String(err) });
  }
};

// Tell the page this worker is listening: messages sent before this point could be lost.
(self as unknown as DedicatedWorkerGlobalScope).postMessage({ ready: true });
