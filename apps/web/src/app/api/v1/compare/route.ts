import { NextResponse } from "next/server";
import { comparePair, hashHex } from "@/lib/engine/pair";
import { featuresFromUpload, MAX_IMAGE_BYTES } from "@/lib/engine/server";
import { authorize, CORS, readImages } from "@/lib/server/api";
import { problem } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** Compares two images: structure correlation under the 28 transforms, hash agreement, byte identity. */
export async function POST(req: Request) {
  const auth = await authorize(req);
  if (!auth.ok) return auth.res;
  const read = await readImages(req, ["a", "b"], MAX_IMAGE_BYTES);
  if (!read.ok) return read.res;
  const t0 = performance.now();
  try {
    const [A, B] = await Promise.all(read.files.map(featuresFromUpload));
    const r = comparePair(A.features, B.features);
    return NextResponse.json(
      {
        byte_identical: A.sha256 === B.sha256,
        structure: { score: round(r.structure.score), transform: r.structure.transform, direction: r.structure.direction },
        hash: { agreeing_bits: r.hash.agreeingBits, transform: r.hash.transform, a: hashHex(A.features), b: hashHex(B.features) },
        per_transform: { a_to_b: r.aToB.map(round), b_to_a: r.bToA.map(round) },
        images: { a: { width: A.width, height: A.height, sha256: A.sha256 }, b: { width: B.width, height: B.height, sha256: B.sha256 } },
        note: "Scores are not p-values. A p-value needs the other images of the dataset; run an audit for that.",
        latency_ms: Number((performance.now() - t0).toFixed(1)),
      },
      { headers: auth.headers },
    );
  } catch {
    return problem(422, "unreadable_image", "One of the files could not be decoded as an image.", CORS);
  }
}

const round = (x: number) => Number(x.toFixed(4));
