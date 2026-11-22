// Parity with the paper's Python code (augleak_cli.py, Pillow 13, SciPy 1.18).
// Fixtures are produced by scripts/make_fixtures.py from the bundled demo data; the test is
// skipped when they are absent (they are large and not committed).
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DIM, N_VIEWS, featuresFromRGBA, gray64FromL, hashViews, rgbaToL, structureViews } from "./features";
import { hashScores, structureScores } from "./score";
import { combinedPvalues } from "./stats";
import { checkSplit, type ImageRef } from "./audit";

const FX = new URL("../../fixtures/", import.meta.url).pathname;
const has = existsSync(FX + "pixels.bin");
const f32 = (f: string) => new Float32Array(readFileSync(FX + f).buffer.slice(0));
const f64 = (f: string) => new Float64Array(readFileSync(FX + f).buffer.slice(0));

describe.skipIf(!has)("parity with augleak_cli.py", () => {
  const meta = has ? JSON.parse(readFileSync(FX + "meta.json", "utf8")) : null;
  const px = has ? new Uint8Array(readFileSync(FX + "pixels.bin")) : new Uint8Array();
  const rgba = (k: number) => {
    const m = meta.items[k];
    return { a: px.subarray(m.off, m.off + m.w * m.h * 4), w: m.w, h: m.h };
  };

  it("features of one image", () => {
    const { a, w, h } = rgba(0);
    const g = gray64FromL(rgbaToL(a, w, h), w, h);
    const gr = f32("g0.f32");
    let md = 0;
    for (let i = 0; i < g.length; i++) md = Math.max(md, Math.abs(g[i] - gr[i]));
    expect(md).toBeLessThan(1e-4);
    const V = structureViews(g), Vr = f32("V0.f32");
    let mv = 0;
    for (let i = 0; i < N_VIEWS * DIM; i++) mv = Math.max(mv, Math.abs(V[i] - Vr[i]));
    expect(mv).toBeLessThan(1e-4);
    const H = hashViews(g), Hr = f32("h0.f32");
    let agree = 0;
    for (let i = 0; i < H.length; i++) agree += H[i] === Hr[i] ? 1 : 0;
    expect(agree / H.length).toBeGreaterThan(0.99);
  });

  it("scores, p-values and flagged test images", () => {
    const ntr = meta.ntrain, nte = meta.ntest;
    const feats = meta.items.map((_: unknown, k: number) => { const { a, w, h } = rgba(k); return featuresFromRGBA(a, w, h); });
    const tr = feats.slice(0, ntr), te = feats.slice(ntr);
    const base = new Float32Array(ntr * DIM); tr.forEach((f: { base: Float32Array }, j: number) => base.set(f.base, j * DIM));
    const hb = new Float32Array(ntr * 64); tr.forEach((f: { hash: Float32Array }, j: number) => hb.set(f.hash.subarray(0, 64), j * 64));
    const views = new Float32Array(nte * N_VIEWS * DIM); te.forEach((f: { views: Float32Array }, i: number) => views.set(f.views, i * N_VIEWS * DIM));
    const hq = new Float32Array(nte * 8 * 64); te.forEach((f: { hash: Float32Array }, i: number) => hq.set(f.hash, i * 512));
    const S = structureScores(views, nte, base, ntr), H = hashScores(hq, nte, hb, ntr);
    const Sr = f32("S.f32"), Hr = f32("H.f32"), Pr = f64("P.f64");
    let ms = 0, hdiff = 0;
    for (let k = 0; k < S.length; k++) { ms = Math.max(ms, Math.abs(S[k] - Sr[k])); if (Math.abs(H[k] - Hr[k]) > 1e-6) hdiff++; }
    console.log("max structure-score diff", ms, "hash diffs", hdiff, "of", H.length);
    expect(ms).toBeLessThanOrEqual(1e-3);          // one float16 step at most
    expect(hdiff / H.length).toBeLessThan(0.01);
    const items = meta.items as { path: string; label: string }[];
    const ref = (k: number): ImageRef => ({ name: items[k].path, label: items[k].label, hash: items[k].path.split("/").pop()! });
    const trainRefs = items.slice(0, ntr).map((_, k) => ref(k)), testRefs = items.slice(ntr).map((_, k) => ref(ntr + k));
    const cls = Array.from(new Set(items.map((x) => x.label))).sort();
    const yt = Int32Array.from(testRefs.map((r) => cls.indexOf(r.label))), yb = Int32Array.from(trainRefs.map((r) => cls.indexOf(r.label)));
    const { P } = combinedPvalues([S, H], nte, ntr, yt, yb, false);
    let worst = 0;
    for (let k = 0; k < P.length; k++) {
      if (Pr[k] < 1e-12 && P[k] < 1e-12) continue;
      worst = Math.max(worst, Math.abs(Math.log10(Math.max(P[k], 1e-300)) - Math.log10(Math.max(Pr[k], 1e-300))));
    }
    console.log("worst log10 p diff", worst);
    expect(worst).toBeLessThan(0.05);              // p-values agree to within 12%
    const rep = checkSplit(trainRefs, testRefs, S, H, 1e-3);
    const mine = rep.flagged.map((f) => testRefs[f.test].name).sort();
    const theirs = (JSON.parse(readFileSync(FX + "flagged_ref.json", "utf8")) as string[]).sort();
    expect(mine).toEqual(theirs);
  }, 600_000);
});

describe.skipIf(!has || !existsSync(FX + "scan_links_ref.json"))("scan parity with augleak_cli.py", () => {
  it("links within the demo training folder", async () => {
    const { scanRelease } = await import("./audit");
    const meta = JSON.parse(readFileSync(FX + "meta.json", "utf8"));
    const px = new Uint8Array(readFileSync(FX + "pixels.bin"));
    const items = (meta.items as { path: string; label: string; w: number; h: number; off: number }[]).slice(0, meta.ntrain);
    const feats = items.map((m) => featuresFromRGBA(px.subarray(m.off, m.off + m.w * m.h * 4), m.w, m.h));
    const n = items.length;
    const base = new Float32Array(n * DIM), hb = new Float32Array(n * 64);
    const views = new Float32Array(n * N_VIEWS * DIM), hq = new Float32Array(n * 512);
    feats.forEach((f, i) => { base.set(f.base, i * DIM); hb.set(f.hash.subarray(0, 64), i * 64); views.set(f.views, i * N_VIEWS * DIM); hq.set(f.hash, i * 512); });
    const S = structureScores(views, n, base, n), H = hashScores(hq, n, hb, n);
    const refs = items.map((m) => ({ name: m.path.replace(/^train\//, ""), label: m.label, hash: m.path }));
    const rep = scanRelease(refs, S, H, 1e-3);
    const mine = rep.links.map((l) => [refs[l.a].name, refs[l.b].name].sort().join("|")).sort();
    const theirs = JSON.parse(readFileSync(FX + "scan_links_ref.json", "utf8")) as string[];
    const a = new Set(mine), b = new Set(theirs);
    const onlyMine = mine.filter((x) => !b.has(x)).length, onlyTheirs = theirs.filter((x) => !a.has(x)).length;
    console.log("scan links: browser", mine.length, "python", theirs.length, "only browser", onlyMine, "only python", onlyTheirs);
    expect((onlyMine + onlyTheirs) / theirs.length).toBeLessThan(0.002);
  }, 900_000);
});
