// Scoring statistics of augleak_cli.py: fp16 storage, hubness-corrected z-scores,
// label-calibrated Gumbel null, Bonferroni combination over views.

const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);

/** Round a float32 value to the nearest float16 and back (what torch .half() does). */
export function toHalf(x: number): number {
  f32[0] = x;
  const b = u32[0];
  const sign = b >>> 31 ? -1 : 1;
  const ax = Math.abs(f32[0]);
  if (!isFinite(ax)) return x;
  if (ax >= 65520) return sign * Infinity;
  const e = Math.max(Math.floor(Math.log2(ax || 1)), -14);
  // guard against log2 rounding at exact powers of two
  let ee = e;
  if (ax !== 0 && ax < 2 ** ee) ee -= 1;
  if (ax >= 2 ** (ee + 1)) ee += 1;
  ee = Math.max(ee, -14);
  const step = 2 ** (ee - 10);
  const q = ax / step;
  let n = Math.floor(q);
  const d = q - n;
  if (d > 0.5 || (d === 0.5 && n % 2 === 1)) n += 1;
  return sign * n * step;
}

/** Hubness-corrected scores (augleak_cli.zscore). M is rows x cols, row-major.
 *  Statistics use only other-class entries; when sameSet, the diagonal is excluded (NaN). */
export function zscore(M: Float32Array, rows: number, cols: number, yq: Int32Array, yb: Int32Array, sameSet: boolean): Float32Array {
  const mr = new Float64Array(rows), sr = new Float64Array(rows);
  const mc = new Float64Array(cols), sc = new Float64Array(cols);
  const cr = new Float64Array(rows), cc = new Float64Array(cols);
  for (let i = 0; i < rows; i++) {
    const yi = yq[i], o = i * cols;
    for (let j = 0; j < cols; j++) {
      if (yb[j] === yi) continue;
      const x = M[o + j];
      mr[i] += x; cr[i] += 1; mc[j] += x; cc[j] += 1;
    }
  }
  for (let i = 0; i < rows; i++) mr[i] /= Math.max(cr[i], 1);
  for (let j = 0; j < cols; j++) mc[j] /= Math.max(cc[j], 1);
  for (let i = 0; i < rows; i++) {
    const yi = yq[i], o = i * cols;
    for (let j = 0; j < cols; j++) {
      if (yb[j] === yi) continue;
      const x = M[o + j];
      sr[i] += (x - mr[i]) ** 2; sc[j] += (x - mc[j]) ** 2;
    }
  }
  for (let i = 0; i < rows; i++) sr[i] = Math.max(Math.sqrt(sr[i] / Math.max(cr[i], 1)), 1e-4);
  for (let j = 0; j < cols; j++) sc[j] = Math.max(Math.sqrt(sc[j] / Math.max(cc[j], 1)), 1e-4);
  const Z = new Float32Array(rows * cols);
  for (let i = 0; i < rows; i++) {
    const o = i * cols;
    for (let j = 0; j < cols; j++) {
      if (sameSet && i === j) { Z[o + j] = NaN; continue; }
      const x = M[o + j];
      Z[o + j] = Math.min((x - mr[i]) / sr[i], (x - mc[j]) / sc[j]);
    }
  }
  return Z;
}

/** Maximum-likelihood Gumbel (right-skewed) fit, as scipy.stats.gumbel_r.fit. */
export function gumbelFit(data: Float64Array): { loc: number; scale: number } {
  const n = data.length;
  let mean = 0;
  for (const x of data) mean += x;
  mean /= n;
  const lse = (s: number) => {
    let m = -Infinity;
    for (const x of data) m = Math.max(m, -x / s);
    let t = 0;
    for (const x of data) t += Math.exp(-x / s - m);
    return m + Math.log(t);
  };
  // d/d(scale) of the log-likelihood: mean - weighted mean (weights exp(-x/scale)) - scale = 0
  const f = (s: number) => {
    let m = -Infinity;
    for (const x of data) m = Math.max(m, -x / s);
    let sw = 0, swx = 0;
    for (const x of data) { const w = Math.exp(-x / s - m); sw += w; swx += w * x; }
    return mean - swx / sw - s;
  };
  let sd = 0;
  for (const x of data) sd += (x - mean) ** 2;
  sd = Math.sqrt(sd / n) || 1e-6;
  let lo = sd * 1e-3, hi = sd * 10;
  while (f(lo) < 0 && lo > 1e-12) lo /= 10;
  while (f(hi) > 0 && hi < 1e12) hi *= 10;
  for (let it = 0; it < 200; it++) {
    const mid = 0.5 * (lo + hi);
    if (f(mid) > 0) lo = mid; else hi = mid;
    if (hi - lo <= 1e-14 * Math.max(1, hi)) break;
  }
  const scale = 0.5 * (lo + hi);
  const loc = -scale * (lse(scale) - Math.log(n));
  return { loc, scale };
}

/** Bonferroni-combined p-values over views (augleak_cli.pvalues). Each view's hubness-corrected
 *  scores are calibrated by a Gumbel law fitted to every query's best other-class score. */
export function combinedPvalues(views: Float32Array[], rows: number, cols: number, yq: Int32Array, yb: Int32Array, sameSet: boolean) {
  const P = new Float32Array(rows * cols).fill(Infinity);
  const nulls: { loc: number; scale: number }[] = [];
  for (const M of views) {
    const Z = zscore(M, rows, cols, yq, yb, sameSet);
    const best: number[] = [];
    for (let i = 0; i < rows; i++) {
      let m = -1e9;
      const o = i * cols, yi = yq[i];
      for (let j = 0; j < cols; j++) {
        if (yb[j] === yi) continue;
        const z = Z[o + j];
        if (!Number.isNaN(z) && z > m) m = z;
      }
      if (m > -1e8) best.push(m);
    }
    const g = gumbelFit(Float64Array.from(best));
    nulls.push(g);
    for (let k = 0; k < rows * cols; k++) {
      const z = Z[k];
      const p = Number.isNaN(z) ? 1 : -Math.expm1(-Math.exp(-(z - g.loc) / g.scale));
      if (p < P[k]) P[k] = p;
    }
  }
  const nv = views.length;
  for (let k = 0; k < rows * cols; k++) P[k] = Math.min(P[k] * nv, 1);
  return { P, nulls };
}

/** Probability that a test image has a sibling in training (Proposition 1 of the paper). */
export function exposure(N: number, nTrain: number, k: number): number {
  if (k <= 1) return 0;
  if (nTrain > N - k) return 1;
  let logp = 0; // C(N-k, n) / C(N-1, n) = prod_{j=1}^{k-1} (N - n - j) / (N - j)
  for (let j = 1; j <= k - 1; j++) logp += Math.log((N - nTrain - j) / (N - j));
  return 1 - Math.exp(logp);
}
