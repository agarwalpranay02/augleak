// Pair scores: structure view = max over the 28 query transforms of the correlation with the
// database image; hash view = max over the 8 dihedral hash transforms. Stored as float16 values,
// exactly as augleak_cli.scores does.
import { DIM, N_HASH, N_VIEWS } from "./features";
import { toHalf } from "./stats";

function dot(a: Float32Array, ao: number, b: Float32Array, bo: number, n: number): number {
  let s0 = 0, s1 = 0, s2 = 0, s3 = 0, i = 0;
  for (; i + 3 < n; i += 4) {
    s0 += a[ao + i] * b[bo + i];
    s1 += a[ao + i + 1] * b[bo + i + 1];
    s2 += a[ao + i + 2] * b[bo + i + 2];
    s3 += a[ao + i + 3] * b[bo + i + 3];
  }
  for (; i < n; i++) s0 += a[ao + i] * b[bo + i];
  return s0 + s1 + s2 + s3;
}

/** Structure scores for `rows` query images (views: rows*N_VIEWS*DIM) against nb database images (base: nb*DIM). */
export function structureScores(views: Float32Array, rows: number, base: Float32Array, nb: number): Float32Array {
  const out = new Float32Array(rows * nb);
  for (let i = 0; i < rows; i++) {
    const qo = i * N_VIEWS * DIM;
    for (let j = 0; j < nb; j++) {
      const bo = j * DIM;
      let m = -Infinity;
      for (let t = 0; t < N_VIEWS; t++) {
        const s = Math.fround(dot(views, qo + t * DIM, base, bo, DIM));
        if (s > m) m = s;
      }
      out[i * nb + j] = toHalf(m);
    }
  }
  return out;
}

/** Hash scores for `rows` query images (hq: rows*N_HASH*64) against nb database identity hashes (hb: nb*64). */
export function hashScores(hq: Float32Array, rows: number, hb: Float32Array, nb: number): Float32Array {
  const out = new Float32Array(rows * nb);
  for (let i = 0; i < rows; i++) {
    const qo = i * N_HASH * 64;
    for (let j = 0; j < nb; j++) {
      let m = -Infinity;
      for (let t = 0; t < N_HASH; t++) {
        const s = dot(hq, qo + t * 64, hb, j * 64, 64);
        if (s > m) m = s;
      }
      out[i * nb + j] = toHalf(m);
    }
  }
  return out;
}
