// The two audits of the AugLeak command-line tool, on precomputed score matrices.
//  - checkSplit: which test images have a copy in the training set (augleak test)
//  - scanRelease: which images of one release are copies of one photograph (augleak scan / split)
import { combinedPvalues, exposure } from "./stats";

export interface ImageRef { name: string; label: string; hash: string }

export interface FlaggedTest {
  test: number;            // index into test images
  train: number;           // closest same-class training image
  p: number;               // combined p-value of that pair (0 for byte-identical copies)
  exact: boolean;          // byte-identical to the training image
}

export interface SplitReport {
  nTrain: number; nTest: number;
  alpha: number;
  flagged: FlaggedTest[];
  clean: number[];
  crossLabelExact: { test: number; train: number }[];
  nulls: { loc: number; scale: number }[];
  /** Closest same-class training image of every test image, for any threshold. */
  best: FlaggedTest[];
}

function labelsToInt(a: ImageRef[], b: ImageRef[]): [Int32Array, Int32Array, string[]] {
  const classes = Array.from(new Set([...a, ...b].map((x) => x.label))).sort();
  const id = new Map(classes.map((c, i) => [c, i]));
  return [Int32Array.from(a.map((x) => id.get(x.label)!)), Int32Array.from(b.map((x) => id.get(x.label)!)), classes];
}

/** `augleak test TRAIN TEST`: scores are test x train matrices for the structure and hash views. */
export function checkSplit(train: ImageRef[], test: ImageRef[], S: Float32Array, H: Float32Array, alpha: number): SplitReport {
  const [ytr, yte] = labelsToInt(train, test);
  const nt = test.length, nb = train.length;
  const { P, nulls } = combinedPvalues([S, H], nt, nb, yte, ytr, false);
  const byHash = new Map<string, number[]>();
  train.forEach((t, j) => { const v = byHash.get(t.hash) ?? []; v.push(j); byHash.set(t.hash, v); });
  const flagged: FlaggedTest[] = [], clean: number[] = [], cross: { test: number; train: number }[] = [], all: FlaggedTest[] = [];
  for (let i = 0; i < nt; i++) {
    let best = 1, arg = -1;
    for (let j = 0; j < nb; j++) {
      if (ytr[j] !== yte[i]) continue;
      const p = P[i * nb + j];
      if (arg < 0 || p < best) { best = p; arg = j; }
    }
    const same = byHash.get(test[i].hash) ?? [];
    const exactSame = same.find((j) => ytr[j] === yte[i]);
    const exactOther = same.find((j) => ytr[j] !== yte[i]);
    if (exactOther !== undefined) cross.push({ test: i, train: exactOther });
    const b: FlaggedTest = exactSame !== undefined ? { test: i, train: exactSame, p: 0, exact: true } : { test: i, train: arg, p: arg >= 0 ? best : 1, exact: false };
    all.push(b);
    if (b.exact || (arg >= 0 && best < alpha)) flagged.push(b); else clean.push(i);
  }
  flagged.sort((a, b) => a.p - b.p);
  return { nTrain: nb, nTest: nt, alpha, flagged, clean, crossLabelExact: cross, nulls, best: all };
}

export interface ScanReport {
  n: number; classes: string[]; alpha: number;
  links: { a: number; b: number; p: number; exact: boolean }[];
  group: Int32Array;               // detected group id of every image
  groupSizes: number[];
  duplicateSets: { members: number[]; conflicting: boolean }[];
  linkedShare: number;
  predictedExposure: number;       // random 80/20 split, from detected groups (a lower bound)
}

function find(p: Int32Array, i: number): number {
  while (p[i] !== i) { p[i] = p[p[i]]; i = p[i]; }
  return i;
}

/** `augleak scan DATA`: scores are n x n matrices of one release against itself. */
export function scanRelease(items: ImageRef[], S: Float32Array, H: Float32Array, alpha: number): ScanReport {
  const n = items.length;
  const [y, , classes] = labelsToInt(items, items);
  const { P } = combinedPvalues([S, H], n, n, y, y, true);
  const parent = Int32Array.from({ length: n }, (_, i) => i);
  const links: ScanReport["links"] = [];
  const seen = new Set<number>();
  const byHash = new Map<string, number[]>();
  items.forEach((t, i) => { const v = byHash.get(t.hash) ?? []; v.push(i); byHash.set(t.hash, v); });
  const exactPairs = new Set<string>();
  for (const v of byHash.values())
    for (const i of v) for (const j of v) if (i < j && y[i] === y[j]) exactPairs.add(`${i},${j}`);
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (y[i] !== y[j]) continue;
      const p = Math.min(P[i * n + j], P[j * n + i]);
      const exact = exactPairs.has(`${i},${j}`);
      if (p < alpha || exact) {
        links.push({ a: i, b: j, p: exact ? 0 : p, exact });
        parent[find(parent, i)] = find(parent, j);
        seen.add(i); seen.add(j);
      }
    }
  const roots = new Map<number, number>();
  const group = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const r = find(parent, i);
    if (!roots.has(r)) roots.set(r, roots.size);
    group[i] = roots.get(r)!;
  }
  const groupSizes = new Array(roots.size).fill(0);
  for (let i = 0; i < n; i++) groupSizes[group[i]]++;
  const duplicateSets = Array.from(byHash.values()).filter((v) => v.length > 1)
    .map((v) => ({ members: v, conflicting: new Set(v.map((i) => items[i].label)).size > 1 }));
  const nTr = Math.round(0.8 * n);
  let ex = 0;
  for (let i = 0; i < n; i++) ex += exposure(n, nTr, groupSizes[group[i]]);
  links.sort((a, b) => a.p - b.p);
  return { n, classes, alpha, links, group, groupSizes, duplicateSets, linkedShare: seen.size / n, predictedExposure: ex / n };
}

/** Seeded group-aware split: whole detected groups go to train or test. */
export function groupSplit(group: Int32Array, testFrac: number, seed: number): { train: number[]; test: number[] } {
  let s = seed >>> 0 || 1;
  const rand = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ids = Array.from(new Set(Array.from(group)));
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const testIds = new Set(ids.slice(0, Math.round(ids.length * testFrac)));
  const train: number[] = [], test: number[] = [];
  group.forEach((g, i) => (testIds.has(g) ? test : train).push(i));
  return { train, test };
}
