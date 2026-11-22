import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "AugLeak: find the test images your model has already seen",
    short_name: "AugLeak",
    description: "Audit image datasets for augmented copies that leak across the train/test split, on your own device.",
    start_url: "/audit?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#f1f4f7",
    theme_color: "#0b1524",
    lang: "en",
    categories: ["developer", "education", "productivity", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Audit a split", url: "/audit?source=shortcut" },
      { name: "Find copy groups", url: "/audit?mode=groups&source=shortcut" },
      { name: "Inspect a pair", url: "/inspect?source=shortcut" },
    ],
  };
}
