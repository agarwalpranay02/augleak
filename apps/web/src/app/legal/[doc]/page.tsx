import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { SITE } from "@/lib/site";

const DOCS = {
  privacy: {
    title: "Privacy",
    updated: "22 November 2026",
    body: [
      ["Your images stay on your device", "The audit and the pair inspector run entirely in your browser. Images you choose are read and compared in this tab and are never sent to our servers. Only summaries of your recent audits (counts, not images) are kept in your browser's storage, and you can clear them on the audit page."],
      ["The API", "Images you send to the API are processed in memory to compute the response and are not stored. We count calls per key to apply fair-use limits."],
      ["Accounts", "If you sign in, we store your name, email address and, for Google sign-in, your profile picture URL, plus the API keys you create (stored as salted hashes) and their monthly call counts. You can revoke keys at any time; to delete your account, open an issue on GitHub or write to us."],
      ["Logs and cookies", "Our host keeps standard request logs for security and reliability. We set only the cookies needed to keep you signed in. There are no advertising or tracking cookies."],
    ],
  },
  terms: {
    title: "Terms",
    updated: "22 November 2026",
    body: [
      ["Use", "AugLeak is free to use for research, education and personal projects. For commercial use of the code, see the licence in the repository."],
      ["No warranty", "AugLeak gives statistical evidence, not certainty. Detected groups are a lower bound and the false-link rate is approximate. Check important conclusions yourself; the site and API are provided as they are, without warranty of any kind."],
      ["Fair use of the API", "Don't try to get around the rate limits, share keys publicly, or send content you have no right to process. We may revoke keys that are abused."],
      ["Datasets", "You are responsible for having the right to use the images you audit. The datasets shown on this site belong to their creators and keep their own licences."],
    ],
  },
} as const;

type Doc = keyof typeof DOCS;

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  return doc in DOCS ? { title: DOCS[doc as Doc].title, alternates: { canonical: `/legal/${doc}` } } : {};
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  if (!(doc in DOCS)) notFound();
  const d = DOCS[doc as Doc];
  return (
    <div className="wrap">
      <PageHeader kicker="Legal" title={d.title}><p>Last updated {d.updated}.</p></PageHeader>
      <div className="card max-w-3xl p-6 sm:p-8">
        {d.body.map(([h, t]) => (
          <section key={h} className="mt-6 first:mt-0">
            <h2 className="text-[18px] font-semibold">{h}</h2>
            <p className="mt-2 text-[16px] text-[var(--color-ink-2)]">{t}</p>
          </section>
        ))}
        <p className="mt-8 text-[15px] text-[var(--color-ink-3)]">Questions: <a className="underline" href={SITE.issues}>open an issue on GitHub</a>.</p>
      </div>
    </div>
  );
}
