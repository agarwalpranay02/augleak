import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { share } from "@/lib/seo";
import { SITE } from "@/lib/site";

export const metadata: Metadata = share({
  title: "About",
  description: "Why AugLeak exists, who built it, and how to get in touch.",
  alternates: { canonical: "/about" },
});

export default function AboutPage() {
  return (
    <div className="wrap">
      <PageHeader kicker="About" title="Built because a test score should mean something.">
        <p>
          AugLeak started with a plant-disease dataset whose released images were already augmented: a random split put an edited copy of almost every test leaf into training.
          Looking further showed the same problem in medical imaging and in benchmarks people cite every day, and no tool that could find the copies without the creator&apos;s metadata.
        </p>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="card p-6 sm:p-8">
          <h2 className="text-[22px] font-semibold">What AugLeak is for</h2>
          <div className="prose-site mt-4 text-[16px]">
            <p><strong>Researchers</strong> can check a dataset before they report a number on it, and attach the audit to their paper.</p>
            <p><strong>Reviewers</strong> can check a split that a paper claims is clean, without asking the authors for metadata.</p>
            <p><strong>Dataset creators</strong> can find repeat shots, exact duplicates and label conflicts before they publish, and release a group-aware split with the data.</p>
            <p>
              It is deliberately conservative. Copies it cannot match stay unlinked, so its numbers are lower bounds, and it says so. Every result on this site can be reproduced from the code and data in the
              <a href={SITE.github}> repository</a>.
            </p>
          </div>
        </section>
        <section className="card h-fit p-6 sm:p-8">
          <h2 className="text-[22px] font-semibold">Who built it</h2>
          <p className="mt-4 text-[16px] text-[var(--color-ink-2)]">
            <a className="font-semibold text-[var(--color-ink)] underline" href={SITE.founderUrl} target="_blank" rel="noreferrer">{SITE.founder}</a>, an AI/ML engineer working on computer vision,
            edge AI and agricultural AI, and the author of the research behind AugLeak.
          </p>
          <h3 className="mt-6 text-[16px] font-semibold">Get in touch</h3>
          <ul className="mt-2 grid gap-2 text-[15.5px]">
            <li><a className="text-[var(--color-train)] underline" href={SITE.issues} target="_blank" rel="noreferrer">Report a problem or suggest a dataset to audit</a></li>
            <li><a className="text-[var(--color-train)] underline" href={SITE.founderGithub} target="_blank" rel="noreferrer">GitHub</a></li>
            {SITE.email && <li><a className="text-[var(--color-train)] underline" href={`mailto:${SITE.email}`}>{SITE.email}</a></li>}
          </ul>
          <h3 className="mt-6 text-[16px] font-semibold">Licence</h3>
          <p className="mt-2 text-[15px] text-[var(--color-ink-2)]">Free to use for research and education. See the <Link className="underline" href="/legal/terms">terms</Link> and the licence in the repository.</p>
        </section>
      </div>

      <section className="card mt-6 p-6 sm:p-8">
        <h2 className="text-[22px] font-semibold">Credits</h2>
        <ul className="mt-4 grid gap-2 text-[15.5px] text-[var(--color-ink-2)] md:grid-cols-2">
          <li>Demo images: Fruits-360, Horea Mureșan and Mihai Oltean (MIT).</li>
          <li>Registry examples: Brain Tumor Classification (MRI), Bhuvaji et al. (CC0); CIFAR-10, Krizhevsky (2009).</li>
          <li>Typefaces: Archivo (Omnibus-Type) and IBM Plex (IBM), both under the SIL Open Font License.</li>
          <li>Built with Next.js, React, Tailwind CSS, sharp, better-auth and Drizzle ORM.</li>
        </ul>
      </section>
    </div>
  );
}
