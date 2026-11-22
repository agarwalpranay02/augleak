// Exact ports of the image operations the Python reference uses (Pillow 13, SciPy 1.18),
// so that the browser computes the same features as augleak_cli.py.

const PRECISION_BITS = 22; // Pillow: 32 - 8 - 2

function bilinear(x: number): number {
  if (x < 0) x = -x;
  return x < 1 ? 1 - x : 0;
}

interface Coeffs { ksize: number; bounds: Int32Array; kk: Float64Array }

// Pillow Resample.c: precompute_coeffs (bilinear filter, support 1)
function precompute(inSize: number, outSize: number): Coeffs {
  const scale = inSize / outSize;
  const filterscale = scale < 1 ? 1 : scale;
  const support = 1 * filterscale;
  const ksize = Math.ceil(support) * 2 + 1;
  const kk = new Float64Array(outSize * ksize);
  const bounds = new Int32Array(outSize * 2);
  for (let xx = 0; xx < outSize; xx++) {
    const center = (xx + 0.5) * scale;
    let ww = 0;
    const ss = 1 / filterscale;
    let xmin = Math.trunc(center - support + 0.5);
    if (xmin < 0) xmin = 0;
    let xmax = Math.trunc(center + support + 0.5);
    if (xmax > inSize) xmax = inSize;
    xmax -= xmin;
    const o = xx * ksize;
    for (let x = 0; x < xmax; x++) {
      const w = bilinear((x + xmin - center + 0.5) * ss);
      kk[o + x] = w;
      ww += w;
    }
    for (let x = 0; x < xmax; x++) if (ww !== 0) kk[o + x] /= ww;
    bounds[xx * 2] = xmin;
    bounds[xx * 2 + 1] = xmax;
  }
  return { ksize, bounds, kk };
}

function toInt8bpc(kk: Float64Array): Int32Array {
  const out = new Int32Array(kk.length);
  const one = 1 << PRECISION_BITS;
  for (let i = 0; i < kk.length; i++) {
    const v = kk[i] * one;
    out[i] = kk[i] < 0 ? Math.trunc(-0.5 + v) : Math.trunc(0.5 + v);
  }
  return out;
}

function clip8(v: number): number {
  if (v >= (1 << PRECISION_BITS) * 256) return 255;
  if (v <= 0) return 0;
  return Math.floor(v / (1 << PRECISION_BITS));
}

/** Pillow Image.resize((ow, oh), BILINEAR) for an 8-bit "L" image. */
export function resizeL(src: Uint8Array, w: number, h: number, ow: number, oh: number): Uint8Array {
  if (w === ow && h === oh) return src.slice();
  const H = precompute(w, ow), V = precompute(h, oh);
  const needH = ow !== w, needV = oh !== h;
  const kh = toInt8bpc(H.kk), kv = toInt8bpc(V.kk);
  let img = src, iw = w, ih = h;
  const yFirst = V.bounds[0];
  const yLast = V.bounds[oh * 2 - 2] + V.bounds[oh * 2 - 1];
  const vb = V.bounds.slice();
  if (needH) {
    for (let i = 0; i < oh; i++) vb[i * 2] -= yFirst;
    const rows = yLast - yFirst;
    const tmp = new Uint8Array(ow * rows);
    for (let yy = 0; yy < rows; yy++) {
      const row = (yy + yFirst) * iw;
      for (let xx = 0; xx < ow; xx++) {
        const xmin = H.bounds[xx * 2], xmax = H.bounds[xx * 2 + 1], o = xx * H.ksize;
        let ss = 1 << (PRECISION_BITS - 1);
        for (let x = 0; x < xmax; x++) ss += img[row + x + xmin] * kh[o + x];
        tmp[yy * ow + xx] = clip8(ss);
      }
    }
    img = tmp; iw = ow; ih = rows;
  }
  if (needV) {
    const out = new Uint8Array(ow * oh);
    for (let yy = 0; yy < oh; yy++) {
      const ymin = vb[yy * 2], ymax = vb[yy * 2 + 1], o = yy * V.ksize;
      for (let xx = 0; xx < ow; xx++) {
        let ss = 1 << (PRECISION_BITS - 1);
        for (let y = 0; y < ymax; y++) ss += img[(y + ymin) * iw + xx] * kv[o + y];
        out[yy * ow + xx] = clip8(ss);
      }
    }
    return out;
  }
  void ih;
  return img;
}

/** Pillow Image.resize((ow, oh), BILINEAR) for a 32-bit float "F" image. */
export function resizeF(src: Float32Array, w: number, h: number, ow: number, oh: number): Float32Array {
  if (w === ow && h === oh) return src.slice();
  const H = precompute(w, ow), V = precompute(h, oh);
  const needH = ow !== w, needV = oh !== h;
  let img = src, iw = w;
  const yFirst = V.bounds[0];
  const yLast = V.bounds[oh * 2 - 2] + V.bounds[oh * 2 - 1];
  const vb = V.bounds.slice();
  if (needH) {
    for (let i = 0; i < oh; i++) vb[i * 2] -= yFirst;
    const rows = yLast - yFirst;
    const tmp = new Float32Array(ow * rows);
    for (let yy = 0; yy < rows; yy++) {
      const row = (yy + yFirst) * iw;
      for (let xx = 0; xx < ow; xx++) {
        const xmin = H.bounds[xx * 2], xmax = H.bounds[xx * 2 + 1], o = xx * H.ksize;
        let ss = 0;
        for (let x = 0; x < xmax; x++) ss += img[row + x + xmin] * H.kk[o + x];
        tmp[yy * ow + xx] = ss;
      }
    }
    img = tmp; iw = ow;
  }
  if (needV) {
    const out = new Float32Array(ow * oh);
    for (let yy = 0; yy < oh; yy++) {
      const ymin = vb[yy * 2], ymax = vb[yy * 2 + 1], o = yy * V.ksize;
      for (let xx = 0; xx < ow; xx++) {
        let ss = 0;
        for (let y = 0; y < ymax; y++) ss += img[(y + ymin) * iw + xx] * V.kk[o + y];
        out[yy * ow + xx] = ss;
      }
    }
    return out;
  }
  return img;
}

/** scipy.ndimage.gaussian_filter(a, sigma=1) for a float32 image (mode 'reflect', truncate 4). */
export function gaussian1(a: Float32Array, w: number, h: number): Float32Array {
  const r = 4;
  const wts = new Float64Array(2 * r + 1);
  let s = 0;
  for (let i = -r; i <= r; i++) { wts[i + r] = Math.exp(-0.5 * i * i); s += wts[i + r]; }
  for (let i = 0; i < wts.length; i++) wts[i] /= s;
  const refl = (i: number, n: number) => {
    // 'reflect' (half-sample symmetric): d c b a | a b c d | d c b a
    const p = 2 * n;
    i = ((i % p) + p) % p;
    return i < n ? i : p - 1 - i;
  };
  // axis 0 (rows), then axis 1 (columns), each written to float32 as SciPy does
  const t = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += a[refl(y + k, h) * w + x] * wts[k + r];
      t[y * w + x] = acc;
    }
  const o = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += t[y * w + refl(x + k, w)] * wts[k + r];
      o[y * w + x] = acc;
    }
  return o;
}

/** numpy.rot90(a, k) for a square n x n array (counter-clockwise). */
export function rot90(a: Float32Array, n: number, k: number): Float32Array {
  k = ((k % 4) + 4) % 4;
  if (k === 0) return a.slice();
  const o = new Float32Array(n * n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      let v: number;
      if (k === 1) v = a[j * n + (n - 1 - i)];
      else if (k === 2) v = a[(n - 1 - i) * n + (n - 1 - j)];
      else v = a[(n - 1 - j) * n + i];
      o[i * n + j] = v;
    }
  return o;
}

export function fliplr(a: Float32Array, n: number): Float32Array {
  const o = new Float32Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) o[i * n + j] = a[i * n + (n - 1 - j)];
  return o;
}

function cosdg(d: number) { return [0, 90, 180, 270].includes(((d % 360) + 360) % 360) ? [1, 0, -1, 0][[0, 90, 180, 270].indexOf(((d % 360) + 360) % 360)] : Math.cos((d * Math.PI) / 180); }
function sindg(d: number) { return [0, 90, 180, 270].includes(((d % 360) + 360) % 360) ? [0, 1, 0, -1][[0, 90, 180, 270].indexOf(((d % 360) + 360) % 360)] : Math.sin((d * Math.PI) / 180); }

/** scipy.ndimage.rotate(a, angle, reshape=False, order=1, mode='nearest') for n x n float32. */
export function rotate(a: Float32Array, n: number, angle: number): Float32Array {
  const c = cosdg(angle), s = sindg(angle), ctr = (n - 1) / 2;
  const o = new Float32Array(n * n);
  const clamp = (v: number) => (v < 0 ? 0 : v > n - 1 ? n - 1 : v);
  const idx = (i: number) => (i < 0 ? 0 : i > n - 1 ? n - 1 : i);
  for (let r = 0; r < n; r++)
    for (let q = 0; q < n; q++) {
      const yr = clamp(c * (r - ctr) + s * (q - ctr) + ctr);
      const xc = clamp(-s * (r - ctr) + c * (q - ctr) + ctr);
      const y0 = Math.floor(yr), x0 = Math.floor(xc);
      const ty = yr - y0, tx = xc - x0;
      const a00 = a[idx(y0) * n + idx(x0)], a01 = a[idx(y0) * n + idx(x0 + 1)];
      const a10 = a[idx(y0 + 1) * n + idx(x0)], a11 = a[idx(y0 + 1) * n + idx(x0 + 1)];
      o[r * n + q] = (1 - ty) * ((1 - tx) * a00 + tx * a01) + ty * ((1 - tx) * a10 + tx * a11);
    }
  return o;
}

/** detector._crop: square crop of side round(n*s) at relative position, resized back to n x n. */
export function crop(a: Float32Array, n: number, s: number, cx = 0.5, cy = 0.5): Float32Array {
  const w = roundHalfEven(n * s);
  const x0 = roundHalfEven((n - w) * cx), y0 = roundHalfEven((n - w) * cy);
  const c = new Float32Array(w * w);
  for (let i = 0; i < w; i++) for (let j = 0; j < w; j++) c[i * w + j] = a[(y0 + i) * n + (x0 + j)];
  return resizeF(c, w, w, n, n);
}

/** Python's round(): halves go to the even neighbour. */
export function roundHalfEven(v: number): number {
  const f = Math.floor(v), d = v - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}
