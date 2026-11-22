import type { Metadata } from "next";
import { Inspector } from "@/components/Inspector";
import { PageHeader } from "@/components/PageHeader";
import { share } from "@/lib/seo";

export const metadata: Metadata = share({
  title: "Inspect a pair",
  description: "Are two images copies? See their correlation under the 28 transforms AugLeak tries, the best match, and their 64-bit perceptual hashes. Runs in your browser.",
  alternates: { canonical: "/inspect" },
});

export default function InspectPage() {
  return (
    <div className="wrap">
      <PageHeader kicker="Inspect" title="Are these two images copies?">
        <p>Compare any two images the way AugLeak does: flipped, turned, rotated and re-cropped, on structure rather than colour. Nothing is uploaded.</p>
      </PageHeader>
      <Inspector />
    </div>
  );
}
