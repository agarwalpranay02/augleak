/// <reference lib="webworker" />
// One worker of the pool: decodes images and computes features, then computes score blocks.
import { DIM, N_HASH, N_VIEWS, featuresFromRGBA } from "./core/features";
import { hashScores, structureScores } from "./core/score";
import { decodeRGBA, sha256Hex } from "./decode";

export type WorkerIn =
  | { type: "features"; jobs: { idx: number; blob: Blob }[] }
  | { type: "setBase"; base: Float32Array; hb: Float32Array; nb: number }
  | { type: "score"; first: number; rows: number; views: Float32Array; hq: Float32Array };

export type WorkerOut =
  | { type: "feature"; idx: number; base: Float32Array; views: Float32Array; hash: Float32Array; sha: string; w: number; h: number }
  | { type: "featureError"; idx: number; message: string }
  | { type: "featuresDone" }
  | { type: "baseSet" }
  | { type: "ready" }
  | { type: "scored"; first: number; rows: number; S: Float32Array; H: Float32Array };

let base: Float32Array | null = null, hb: Float32Array | null = null, nb = 0;

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const m = e.data;
  const post = (msg: WorkerOut, tr: Transferable[] = []) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg, tr);
  if (m.type === "features") {
    for (const { idx, blob } of m.jobs) {
      try {
        const buf = await blob.arrayBuffer();
        const sha = await sha256Hex(buf);
        const { data, w, h } = await decodeRGBA(new Blob([buf]));
        const f = featuresFromRGBA(data, w, h);
        post({ type: "feature", idx, base: f.base, views: f.views, hash: f.hash, sha, w, h }, [f.base.buffer, f.views.buffer, f.hash.buffer]);
      } catch (err) {
        post({ type: "featureError", idx, message: err instanceof Error ? err.message : String(err) });
      }
    }
    post({ type: "featuresDone" });
  } else if (m.type === "setBase") {
    base = m.base; hb = m.hb; nb = m.nb;
    post({ type: "baseSet" });
  } else if (m.type === "score") {
    const S = structureScores(m.views, m.rows, base!, nb);
    const H = hashScores(m.hq, m.rows, hb!, nb);
    post({ type: "scored", first: m.first, rows: m.rows, S, H }, [S.buffer, H.buffer]);
  }
};

// Tell the page this worker is listening: messages sent before this point could be lost.
(self as unknown as DedicatedWorkerGlobalScope).postMessage({ type: "ready" } satisfies WorkerOut);

export { DIM, N_HASH, N_VIEWS };
