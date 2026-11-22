import type { Metadata } from "next";
import { SITE } from "@/lib/site";

/** The site-wide share card, rendered by app/opengraph-image.tsx. */
export const SHARE_CARD = { url: "/opengraph-image", width: 1200, height: 630, alt: "AugLeak: find the test images your model has already seen" };

/** Gives a page its own share preview from its title and description, keeping the image and site name. */
export function share(m: Metadata): Metadata {
  const title = typeof m.title === "string" ? (m.title.includes(SITE.name) ? m.title : `${m.title} · ${SITE.name}`) : undefined;
  const description = typeof m.description === "string" ? m.description : undefined;
  const og = m.openGraph ?? {};
  const images = og.images ?? [SHARE_CARD];
  return {
    ...m,
    openGraph: { type: "website", siteName: SITE.name, locale: "en_IN", ...(title && { title }), ...(description && { description }), ...og, images },
    twitter: { card: "summary_large_image", ...(title && { title }), ...(description && { description }), images },
  };
}
