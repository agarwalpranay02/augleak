import { NextResponse } from "next/server";
import { z } from "zod";
import { exposure } from "@/lib/engine/core/stats";
import { CORS } from "@/lib/server/api";
import { clientIp, problem } from "@/lib/server/http";
import { limitHeaders, rateLimit } from "@/lib/server/ratelimit";

export const dynamic = "force-dynamic";

const Q = z.object({
  photos: z.coerce.number().int().min(2).max(10_000_000),
  copies: z.coerce.number().int().min(1).max(1000),
  test_share: z.coerce.number().gt(0).lt(1),
});

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** Share of test images with at least one copy in training under a random split (Proposition 1). No key needed. */
export async function GET(req: Request) {
  const l = await rateLimit(`exp:${clientIp(req)}`, 60, 60);
  if (!l.ok) return problem(429, "rate_limited", "Too many requests from this address.", { ...CORS, ...limitHeaders(l) });
  const p = Q.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!p.success) return problem(400, "invalid_request", "Pass photos (integer ≥ 2), copies (images per photograph, original included, ≥ 1) and test_share (between 0 and 1).", CORS);
  const { photos, copies, test_share } = p.data;
  const N = photos * copies;
  const nTrain = Math.round(N * (1 - test_share));
  const q = exposure(N, nTrain, copies);
  return NextResponse.json(
    { images: N, train_images: nTrain, test_images: N - nTrain, exposure: Number(q.toFixed(6)), approximation: Number((1 - test_share ** (copies - 1)).toFixed(6)) },
    { headers: { ...CORS, ...limitHeaders(l), "Cache-Control": "public, max-age=3600" } },
  );
}
