import "server-only";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { featuresFromRGBA, type ImageFeatures } from "./core/features";

export const MAX_IMAGE_BYTES = 2_000_000;
export const MAX_PIXELS = 25_000_000;

/** Decodes an uploaded image like Pillow does (no EXIF rotation) and computes AugLeak features. */
export async function featuresFromUpload(buf: Buffer): Promise<{ features: ImageFeatures; sha256: string; width: number; height: number }> {
  const { data, info } = await sharp(buf, { limitInputPixels: MAX_PIXELS, failOn: "error" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = new Uint8Array(data.buffer, data.byteOffset, data.length);
  return {
    features: featuresFromRGBA(rgba, info.width, info.height),
    sha256: createHash("sha256").update(buf).digest("hex"),
    width: info.width,
    height: info.height,
  };
}
