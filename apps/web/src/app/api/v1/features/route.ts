import { NextResponse } from "next/server";
import { DIM, N_VIEWS } from "@/lib/engine/core/features";
import { hashHex } from "@/lib/engine/pair";
import { featuresFromUpload, MAX_IMAGE_BYTES } from "@/lib/engine/server";
import { VIEW_NAMES } from "@/lib/engine/transforms";
import { authorize, CORS, readImages } from "@/lib/server/api";
import { problem } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const b64 = (a: Float32Array) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString("base64");

/** AugLeak features of one image: the 732-d structure vector (and optionally its 28 transformed views) and the 64-bit hash. */
export async function POST(req: Request) {
  const auth = await authorize(req);
  if (!auth.ok) return auth.res;
  const read = await readImages(req, ["image"], MAX_IMAGE_BYTES);
  if (!read.ok) return read.res;
  const withViews = new URL(req.url).searchParams.get("views") === "1";
  try {
    const f = await featuresFromUpload(read.files[0]);
    return NextResponse.json(
      {
        sha256: f.sha256,
        width: f.width,
        height: f.height,
        hash: hashHex(f.features),
        structure: { dim: DIM, dtype: "float32", encoding: "base64 little-endian", data: b64(f.features.base) },
        ...(withViews ? { views: { count: N_VIEWS, names: VIEW_NAMES, dim: DIM, dtype: "float32", encoding: "base64 little-endian, view-major", data: b64(f.features.views) } } : {}),
      },
      { headers: auth.headers },
    );
  } catch {
    return problem(422, "unreadable_image", "The file could not be decoded as an image.", CORS);
  }
}
