// Decoding an image file to RGBA pixels the way the reference (Pillow) does: no EXIF rotation,
// no colour-profile conversion, no premultiplied alpha. Works in the page and in workers.
export async function decodeRGBA(blob: Blob): Promise<{ data: Uint8ClampedArray; w: number; h: number }> {
  const bmp = await createImageBitmap(blob, { imageOrientation: "none", colorSpaceConversion: "none", premultiplyAlpha: "none" } as ImageBitmapOptions);
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = c.getContext("2d", { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;
  ctx.drawImage(bmp, 0, 0);
  const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height);
  const out = { data, w: bmp.width, h: bmp.height };
  bmp.close();
  return out;
}

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
  return Array.from(d, (b) => b.toString(16).padStart(2, "0")).join("");
}
