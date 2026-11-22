import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { fmtP } from "@/lib/format";
import { share } from "@/lib/seo";
import { AUDITS } from "@/lib/site";
import examples from "../../../public/registry/examples.json";

export const metadata: Metadata = share({
  title: "Dataset registry",
  description: "What AugLeak found in the official splits of public image datasets: brain MRI, PlantDoc, COVID-19 radiographs, Fruits-360 and CIFAR-10.",
  alternates: { canonical: "/registry" },
});

type Ex = { test: string; train: string; cls: string; p: number; kind: string };

export default function RegistryPage() {
  const ex = examples as Record<string, Ex[]>;
  return (
    <div className="wrap">
      <PageHeader kicker="Registry" title="What we found in public datasets.">
        <p>
          AugLeak run on the official or customary splits of widely used image collections. Counts come from the paper&apos;s audit code, and every top-ranked pair was checked by eye.
          The judgements are released with the <a className="text-[var(--color-train)] underline" href="https://github.com/agarwalpranay02/augleak/tree/main/research/results">research code</a>.
        </p>
      </PageHeader>

      <nav aria-label="Datasets" className="flex flex-wrap gap-2">
        {AUDITS.map((a) => <a key={a.id} href={`#${a.id}`} className="btn btn-sm btn-ghost">{a.short}</a>)}
      </nav>

      <div className="mt-10 grid gap-8">
        {AUDITS.map((a) => (
          <article key={a.id} id={a.id} className="card scroll-mt-24 overflow-hidden">
            <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[300px_1fr]">
              <div>
                <h2 className="text-[22px] font-semibold leading-tight">{a.name}</h2>
                <p className="mt-1 text-[14.5px] text-[var(--color-ink-2)]">{a.source}</p>
                <p className="display mt-6 text-[84px] leading-[0.85] text-[var(--color-leak)]">{a.headline}</p>
                <p className="mt-2 text-[16px] font-medium">{a.headlineText}</p>
                <dl className="mt-6 grid gap-2 text-[14px]">
                  <div className="grid grid-cols-[72px_1fr] gap-2"><dt className="text-[var(--color-ink-3)]">Split</dt><dd>{a.split}</dd></div>
                  <div className="grid grid-cols-[72px_1fr] gap-2"><dt className="text-[var(--color-ink-3)]">Size</dt><dd>{a.size}</dd></div>
                  <div className="grid grid-cols-[72px_1fr] gap-2"><dt className="text-[var(--color-ink-3)]">Licence</dt><dd>{a.licence}</dd></div>
                  <div className="grid grid-cols-[72px_1fr] gap-2"><dt className="text-[var(--color-ink-3)]">Source</dt><dd><a className="break-all text-[var(--color-train)] underline" href={a.url} target="_blank" rel="noreferrer">{a.url.replace(/^https?:\/\//, "")}</a></dd></div>
                </dl>
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-[var(--color-ink-2)]">Findings</h3>
                <ul className="mt-3 grid gap-3">
                  {a.findings.map((f) => (
                    <li key={f} className="grid grid-cols-[14px_1fr] gap-3 text-[16px]">
                      <span aria-hidden="true" className="mt-[9px] h-2 w-2 rounded-full bg-[var(--color-leak)]" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {"note" in a && a.note && <p className="mt-5 rounded-xl bg-[var(--color-paper-2)] px-4 py-3 text-[14.5px] text-[var(--color-ink-2)]">{a.note}</p>}
                {ex[a.id] && (
                  <>
                    <h3 className="mt-7 text-[15px] font-semibold text-[var(--color-ink-2)]">Examples: test image, then its training copy</h3>
                    <ul className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                      {ex[a.id].map((e, i) => (
                        <li key={i} className="rounded-xl bg-[var(--color-paper)] p-2">
                          <div className="grid grid-cols-2 gap-1.5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`/registry/${a.id}/${i}-test.jpg`} alt={`Test image ${e.test} (${e.cls})`} loading="lazy" className="aspect-square w-full rounded-lg object-cover ring-2 ring-[var(--color-test)] [image-rendering:auto]" />
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`/registry/${a.id}/${i}-train.jpg`} alt={`Training image ${e.train} (${e.cls})`} loading="lazy" className="aspect-square w-full rounded-lg object-cover ring-2 ring-[var(--color-train)]" />
                          </div>
                          <p className="mt-2 text-[13px] font-medium">{e.kind}</p>
                          <p className="mono text-[12px] text-[var(--color-ink-3)]">{e.p === 0 ? "identical file" : `p = ${fmtP(e.p)}`}</p>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      <section className="mt-16 grid gap-6 lg:grid-cols-2">
        <div className="card p-6 sm:p-8">
          <h2 className="text-[20px] font-semibold">Two releases we cannot name yet</h2>
          <p className="mt-3 text-[15.5px] text-[var(--color-ink-2)]">
            The paper also audits two public leaf-disease releases that ship every photograph with 15 edited copies. In both, many &quot;different&quot; source photographs are the same leaf shot again moments later,
            so even a split by file name leaks: 57 of 60 and 52 of 60 top-ranked cross-group pairs were repeat shots. They will be named here once the paper is public.
          </p>
        </div>
        <div className="card p-6 sm:p-8">
          <h2 className="text-[20px] font-semibold">Audit a dataset yourself</h2>
          <p className="mt-3 text-[15.5px] text-[var(--color-ink-2)]">Run the same audit on your own split in the browser, or on any size of dataset with the command-line tool in the repository.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/audit" className="btn btn-leak">Open the audit</Link>
            <a href="https://github.com/agarwalpranay02/augleak/tree/main/research" className="btn btn-ghost" target="_blank" rel="noreferrer">Command-line tool</a>
          </div>
        </div>
      </section>
    </div>
  );
}
