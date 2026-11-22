// Per-image features of the AugLeak detector (structure view with transform search, and the
// perceptual-hash view), ported from src/detector.py and augleak_cli.py of the paper's code.
import { crop, fliplr, gaussian1, resizeF, resizeL, rot90, rotate } from "./resample";

export const RES = 32;
export const N64 = 64;
export const ANGLES = [15, -15, 30, -30, 45, -45];
export const N_VIEWS = 28; // 8 dihedral + 12 rotations + 8 crops
export const N_HASH = 8;

function makeDisc(res = RES, r = 0.48): Int32Array {
  const idx: number[] = [];
  const c = (res - 1) / 2;
  for (let y = 0; y < res; y++)
    for (let x = 0; x < res; x++) if ((y - c) ** 2 + (x - c) ** 2 <= (r * res) ** 2) idx.push(y * res + x);
  return Int32Array.from(idx);
}
export const DISC = makeDisc();
export const DIM = DISC.length; // 732

/** Pillow convert("L") from RGBA pixels (alpha ignored), ITU-R 601 with Pillow's fixed-point rounding. */
export function rgbaToL(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < w * h; i++, p += 4)
    out[i] = (rgba[p] * 19595 + rgba[p + 1] * 38470 + rgba[p + 2] * 7471 + 0x8000) >>> 16;
  return out;
}

/** detector.gray64: grayscale, 64 x 64 bilinear, Gaussian blur sigma 1 (float32). */
export function gray64FromL(L: Uint8Array, w: number, h: number): Float32Array {
  const g = resizeL(L, w, h, N64, N64);
  return gaussian1(Float32Array.from(g), N64, N64);
}

/** detector._canon: 64x64 float gray -> mean-centred, L2-normalised vector inside the disc. */
export function canon(a: Float32Array, out?: Float32Array, off = 0): Float32Array {
  const v = resizeF(a, N64, N64, RES, RES);
  const o = out ?? new Float32Array(DIM);
  let m = 0;
  for (let i = 0; i < DIM; i++) m += Math.fround(v[DISC[i]]);
  m = Math.fround(m / DIM);
  let nn = 0;
  for (let i = 0; i < DIM; i++) { const x = Math.fround(v[DISC[i]] - m); o[off + i] = x; nn += x * x; }
  const d = Math.sqrt(nn) + 1e-6;
  for (let i = 0; i < DIM; i++) o[off + i] = o[off + i] / d;
  return o;
}

/** The 28 query views of detector.structure_views (extra_angles=True, CROPS=True), flattened. */
export function structureViews(a: Float32Array): Float32Array {
  const out = new Float32Array(N_VIEWS * DIM);
  let v = 0;
  for (let k = 0; k < 4; k++) {
    const r = rot90(a, N64, k);
    canon(r, out, DIM * v++);
    canon(fliplr(r, N64), out, DIM * v++);
  }
  const fl = fliplr(a, N64);
  for (const ang of ANGLES) {
    canon(rotate(a, N64, ang), out, DIM * v++);
    canon(rotate(fl, N64, ang), out, DIM * v++);
  }
  for (const sc of [0.8, 0.65]) {
    canon(crop(a, N64, sc), out, DIM * v++);
    canon(crop(fl, N64, sc), out, DIM * v++);
  }
  for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) canon(crop(a, N64, 0.75, cx, cy), out, DIM * v++);
  return out;
}

// --- perceptual hash: orthonormal DCT-II of the 32 x 32 thumbnail, top-left 8 x 8 block ---
const DCT8 = (() => {
  const m = new Float64Array(8 * 32);
  for (let k = 0; k < 8; k++) {
    const f = k === 0 ? Math.sqrt(1 / 32) : Math.sqrt(2 / 32);
    for (let n = 0; n < 32; n++) m[k * 32 + n] = f * Math.cos((Math.PI * k * (2 * n + 1)) / 64);
  }
  return m;
})();

function hashBits(a: Float32Array, out: Float32Array, off: number) {
  const t = resizeF(a, N64, N64, 32, 32);
  const tmp = new Float64Array(8 * 32); // DCT along rows (axis 1) for the first 8 frequencies
  for (let y = 0; y < 32; y++)
    for (let k = 0; k < 8; k++) {
      let s = 0;
      for (let n = 0; n < 32; n++) s += t[y * 32 + n] * DCT8[k * 32 + n];
      tmp[k * 32 + y] = s;
    }
  const D = new Float64Array(64);
  for (let ky = 0; ky < 8; ky++)
    for (let kx = 0; kx < 8; kx++) {
      let s = 0;
      for (let y = 0; y < 32; y++) s += tmp[kx * 32 + y] * DCT8[ky * 32 + y];
      D[ky * 8 + kx] = Math.fround(s);
    }
  const rest = Array.from(D.subarray(1)).sort((p, q) => p - q);
  const med = rest[31]; // median of 63 values
  for (let i = 0; i < 64; i++) out[off + i] = (D[i] > med ? 1 : -1) / 8;
}

/** detector.hash_views for one image: 8 dihedral transforms x 64 bits (+-1/8). Row 0 = identity. */
export function hashViews(a: Float32Array): Float32Array {
  const out = new Float32Array(N_HASH * 64);
  let v = 0;
  for (let k = 0; k < 4; k++) {
    const r = rot90(a, N64, k);
    hashBits(r, out, 64 * v++);
    hashBits(fliplr(r, N64), out, 64 * v++);
  }
  return out;
}

export interface ImageFeatures {
  base: Float32Array;    // DIM: identity structure vector (database side)
  views: Float32Array;   // N_VIEWS * DIM: query transforms
  hash: Float32Array;    // N_HASH * 64: dihedral hash vectors (row 0 = identity)
}

export function featuresFromRGBA(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): ImageFeatures {
  const g = gray64FromL(rgbaToL(rgba, w, h), w, h);
  const views = structureViews(g);
  return { base: views.slice(0, DIM), views, hash: hashViews(g) };
}
