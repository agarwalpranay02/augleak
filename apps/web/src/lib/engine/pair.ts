// Comparing two single images: per-transform structure correlations and hash agreement.
// Used by the pair inspector and by the /api/v1/compare endpoint (same numbers on both).
import { DIM, N_HASH, N_VIEWS, type ImageFeatures } from "./core/features";
import { HASH_VIEW_NAMES, VIEW_NAMES } from "./transforms";

export interface PairReport {
  /** correlation of each of the 28 views of A with B as it is (and the reverse) */
  aToB: number[];
  bToA: number[];
  structure: { score: number; transform: string; direction: "a_to_b" | "b_to_a" };
  hash: { agreeingBits: number; transform: string };
}

function dot(a: Float32Array, ao: number, b: Float32Array, bo: number, n: number) {
  let s = 0;
  for (let i = 0; i < n; i++) s += a[ao + i] * b[bo + i];
  return s;
}

export function comparePair(A: ImageFeatures, B: ImageFeatures): PairReport {
  const aToB = Array.from({ length: N_VIEWS }, (_, t) => dot(A.views, t * DIM, B.base, 0, DIM));
  const bToA = Array.from({ length: N_VIEWS }, (_, t) => dot(B.views, t * DIM, A.base, 0, DIM));
  const ia = aToB.indexOf(Math.max(...aToB)), ib = bToA.indexOf(Math.max(...bToA));
  const structure = aToB[ia] >= bToA[ib]
    ? { score: aToB[ia], transform: VIEW_NAMES[ia], direction: "a_to_b" as const }
    : { score: bToA[ib], transform: VIEW_NAMES[ib], direction: "b_to_a" as const };
  let best = -Infinity, bt = 0;
  for (let t = 0; t < N_HASH; t++) {
    const d = dot(A.hash, t * 64, B.hash, 0, 64);
    if (d > best) { best = d; bt = t; }
  }
  // hash vectors hold ±1/8, so a dot product d means (agree − disagree) / 64
  const agreeingBits = Math.round((best * 64 + 64) / 2);
  return { aToB, bToA, structure, hash: { agreeingBits, transform: HASH_VIEW_NAMES[bt] } };
}

/** Identity hash of an image as 16 hex characters (bit = 1 where the DCT coefficient is above the median). */
export function hashHex(f: ImageFeatures): string {
  let hex = "";
  for (let i = 0; i < 64; i += 4) {
    let v = 0;
    for (let j = 0; j < 4; j++) v = (v << 1) | (f.hash[i + j] > 0 ? 1 : 0);
    hex += v.toString(16);
  }
  return hex;
}
