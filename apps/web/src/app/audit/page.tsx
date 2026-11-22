import type { Metadata } from "next";
import { Suspense } from "react";
import { AuditApp } from "@/components/audit/AuditApp";
import { PageHeader } from "@/components/PageHeader";
import { share } from "@/lib/seo";

export const metadata: Metadata = share({
  title: "Audit a dataset",
  description: "Check a train/test split for augmented copies, or group the copies in one folder before you split. Runs in your browser; images are never uploaded.",
  alternates: { canonical: "/audit" },
});

export default function AuditPage() {
  return (
    <div className="wrap">
      <PageHeader kicker="Audit" title="Check your split before you trust the score.">
        <p>
          Give AugLeak folders with one sub-folder per class, or ZIP files of them. It compares every test image with every training image under
          28 transforms and reports the pairs that are copies, at the false-link rate you pick. The work happens in this tab, on this device.
        </p>
      </PageHeader>
      <Suspense fallback={<div className="h-64" />}>
        <AuditApp />
      </Suspense>
    </div>
  );
}
