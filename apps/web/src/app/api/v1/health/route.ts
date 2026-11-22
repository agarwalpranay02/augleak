import { NextResponse } from "next/server";
import { featuresFromRGBA } from "@/lib/engine/core/features";
import { comparePair } from "@/lib/engine/pair";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Runs the engine on a synthetic image and its mirror image: the pair must match under a flip. */
export async function GET() {
  const w = 48, h = 40, a = new Uint8Array(w * h * 4), b = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = (x * 5 + y * y) % 256, i = (y * w + x) * 4, j = (y * w + (w - 1 - x)) * 4;
      a.set([v, 255 - v, (x * y) % 256, 255], i);
      b.set([v, 255 - v, (x * y) % 256, 255], j);
    }
  const r = comparePair(featuresFromRGBA(a, w, h), featuresFromRGBA(b, w, h));
  const ok = r.structure.score > 0.999 && r.structure.transform.includes("flipped");
  return NextResponse.json({ status: ok ? "ok" : "degraded", version: SITE.version, engine: "augleak-structure+hash" }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
