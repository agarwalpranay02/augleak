/// <reference lib="webworker" />
// One worker of the pool: decodes images and computes features, then computes score blocks.
import { DIM, N_HASH, N_VIEWS, featuresFromRGBA } from "../core/features";
import { hashScores, structureScores } from "../core/score";

export type WorkerIn =
  | { type: "features"; jobs: { idx: number; blob: Blob }[] }
  | { type: "setBase"; base: Float32Array; hb: Float32Array; nb: number }
  | { type: "score"; first: number; rows: number; views: Float32Array; hq: Float32Array };

export type WorkerOut =
  | { type: "feature"; idx: number; base: Float32Array; views: Float32Array; hash: Float32Array; sha: string; w: number; h: number }
  | { type: "featureError"; idx: number; message: string }
  | { type: "featuresDone" }
  | { type: "baseSet" }
  | { type: "scored"; first: number; rows: number; S: Float32Array; H: Float32Array };

let base: Float32Array | null = null, hb: Float32Array | null = null, nb = 0;

async function sha256(buf: ArrayBuffer): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
  return Array.from(d, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function decode(blob: Blob): Promise<{ data: Uint8ClampedArray; w: number; h: number }> {
  // Like Pillow: no EXIF rotation, no colour-profile conversion, no premultiplied alpha.
  const bmp = await createImageBitmap(blob, { imageOrientation: "none", colorSpaceConversion: "none", premultiplyAlpha: "none" } as ImageBitmapOptions);
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = c.getContext("2d", { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;
  ctx.drawImage(bmp, 0, 0);
  const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height);
  const out = { data, w: bmp.width, h: bmp.height };
  bmp.close();
  return out;
}

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const m = e.data;
  const post = (msg: WorkerOut, tr: Transferable[] = []) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg, tr);
  if (m.type === "features") {
    for (const { idx, blob } of m.jobs) {
      try {
        const buf = await blob.arrayBuffer();
        const sha = await sha256(buf);
        const { data, w, h } = await decode(new Blob([buf]));
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

export { DIM, N_HASH, N_VIEWS };
