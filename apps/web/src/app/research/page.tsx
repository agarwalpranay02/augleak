import type { Metadata } from "next";
import Image from "next/image";
import { ExposureExplorer } from "@/components/ExposureExplorer";
import { PageHeader } from "@/components/PageHeader";
import { share } from "@/lib/seo";
import { PAPER, SITE } from "@/lib/site";

export const metadata: Metadata = share({
  title: "Research",
  description: "The theory, experiments and audits behind AugLeak: why random splits of pre-augmented datasets overstate accuracy, how far, and how to audit a release without metadata.",
  alternates: { canonical: "/research" },
});

const REPO = `${SITE.github}/tree/main/research`;

export default function ResearchPage() {
  return (
    <div className="wrap">
      <PageHeader kicker="Research" title="Every number, and how it was measured.">
        <p>AugLeak comes from a study of how pre-augmented image datasets are evaluated. This page summarises its theory, experiments, detector and audits. All code, results and judgements are in the repository.</p>
      </PageHeader>

      <section className="card grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <p className="text-[14px] font-semibold text-[var(--color-ink-3)]">The paper</p>
          <h2 className="display-wide mt-2 text-[clamp(22px,2.6vw,30px)] leading-tight">{PAPER.title}</h2>
          <p className="mt-3 text-[15.5px] text-[var(--color-ink-2)]">{PAPER.author}. {PAPER.status}</p>
          <p className="mt-5 text-[16px] text-[var(--color-ink-2)]">
            Many public image datasets are released already augmented: each photograph comes with rotated, flipped, recoloured and filtered copies, and nothing records which files belong together.
            A random train/test split of such a release scores the model mostly on images whose copies it has seen. The paper predicts how many, measures how far the reported accuracy moves in both directions,
            proves why splitting by detected groups cannot remove the exposure, introduces AugLeak, and audits six public collections.
          </p>
        </div>
        <dl className="grid content-start gap-0 self-start rounded-xl border border-[var(--color-rule)] text-[15px]">
          {[
            ["Author", PAPER.author],
            ["Year", String(PAPER.year)],
            ["Status", "Manuscript; preprint coming soon"],
            ["Code and data", "github.com/agarwalpranay02/augleak"],
            ["Compute", "Two CPU cores, no GPU"],
          ].map(([k, v]) => (
            <div key={k} className="grid grid-cols-[120px_1fr] gap-3 border-b border-[var(--color-rule-2)] px-4 py-3 last:border-0">
              <dt className="text-[var(--color-ink-3)]">{k}</dt><dd className={k === "Code and data" ? "mono break-all text-[13.5px]" : ""}>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <figure className="mt-10">
        <Image src="/research/fig_concept.webp" alt="Diagram: a release ships each photograph with edited copies; a random split puts copies on both sides; AugLeak recovers the copy relationships from pixels." width={1099} height={428} className="w-full rounded-xl bg-white p-4 ring-1 ring-[var(--color-rule)]" />
        <figcaption className="mt-2 text-[14px] text-[var(--color-ink-3)]">The problem and the audit (Figure 1 of the paper).</figcaption>
      </figure>

      <Section id="theory" title="Theory">
        <div className="grid gap-5 lg:grid-cols-3">
          <Prop n={1} title="Exposure is almost total" formula="q = 1 − C(N−k, n) / C(N−1, n) ≈ 1 − ρᵏ⁻¹">
            With k images per photograph, N images in all, n of them in training and test share ρ, a test image has a copy in training with probability q. At k = 4 and ρ = 0.2 that is 99.2%.
          </Prop>
          <Prop n={2} title="The error has two sources" formula="reported = q · a_seen + (1 − q) · a_new">
            Reported accuracy mixes accuracy on exposed images with accuracy on new ones. It overstates when copies are easy to recognise and understates when the test images are heavily distorted.
          </Prop>
          <Prop n={3} title="Partial groups still leak" formula="P(leak) = 1 − ρᵐ⁻¹">
            A group that a detector cuts into m pieces still leaks with that probability. So a split by detected groups keeps exposure high unless groups are recovered completely; what it can remove is the inflation from close copies.
          </Prop>
        </div>
      </Section>

      <Section id="exposure" title="Try the exposure formula">
        <ExposureExplorer />
      </Section>

      <Section id="inflation" title="How far the reported accuracy moves">
        <p className="max-w-3xl text-[16px] text-[var(--color-ink-2)]">
          CIFAR-Aug is a controlled release built from CIFAR-10: 2,000 photographs, each shipped with 15 copies at one of three edit strengths, plus fresh test photographs that give the truth.
        </p>
        <div className="mt-6 card overflow-x-auto">
          <table className="table-site">
            <thead><tr><th>Model, edit strength</th><th className="num">Random split reports</th><th className="num">Fresh photographs</th><th className="num">Group split</th></tr></thead>
            <tbody>
              <tr><td>MobileNetV3 fine-tuned, medium (3 seeds)</td><td className="num">98.2%</td><td className="num">73.6%</td><td className="num">69.7%</td></tr>
              <tr><td>EfficientNet-B0 fine-tuned, medium (3 seeds)</td><td className="num">98.8%</td><td className="num">75.0%</td><td className="num">71.4%</td></tr>
              <tr><td>MobileNetV3 fine-tuned, weak (3 seeds)</td><td className="num">100.0%</td><td className="num">73.0%</td><td className="num">72.4%</td></tr>
              <tr><td>Frozen features, 1-NN, weak</td><td className="num">100%</td><td className="num">63%</td><td className="num">65%</td></tr>
              <tr><td>Frozen features, 1-NN, strong</td><td className="num">52%</td><td className="num">57%</td><td className="num">30%</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[14px] text-[var(--color-ink-3)]">With strong edits the random split understates accuracy: the distorted test images are harder than real photographs. On two real leaf-disease releases the random split overstates a linear probe by 6.3 and 8.4 points; on COVID-CXR an image-level split overstates patient-level accuracy by 5.6 points.</p>
        <figure className="mt-8">
          <Image src="/research/fig_inflation.webp" alt="Charts of reported versus true accuracy across edit strengths, dataset sizes and copies per photograph." width={1166} height={606} className="w-full rounded-xl bg-white p-3 ring-1 ring-[var(--color-rule)]" />
          <figcaption className="mt-2 text-[14px] text-[var(--color-ink-3)]">Figure 2 of the paper: inflation on CIFAR-Aug by edit strength, dataset size and copies per photograph.</figcaption>
        </figure>
        <figure className="mt-8">
          <Image src="/research/fig_exploit.webp" alt="Accuracy on exposed test images rises with the similarity of their closest training copy." width={1235} height={440} className="w-full rounded-xl bg-white p-3 ring-1 ring-[var(--color-rule)]" />
          <figcaption className="mt-2 text-[14px] text-[var(--color-ink-3)]">Figure 3: inflation comes from test images whose closest training copy is close in the model&apos;s own representation.</figcaption>
        </figure>
      </Section>

      <Section id="detection" title="Finding the copies">
        <p className="max-w-3xl text-[16px] text-[var(--color-ink-2)]">
          Average precision at recovering true copy pairs. Leaf-A and Leaf-B are two public leaf-disease releases whose file names reveal the groups; CIFAR-Aug uses 500 photographs from all ten classes.
        </p>
        <div className="mt-6 card overflow-x-auto">
          <table className="table-site">
            <thead><tr><th>Method</th><th className="num">Leaf-A</th><th className="num">Leaf-B</th><th className="num">CIFAR-Aug medium</th></tr></thead>
            <tbody>
              <tr><td>Perceptual hash with flips and turns</td><td className="num">0.44</td><td className="num">0.64</td><td className="num">0.04</td></tr>
              <tr><td>ImageNet embedding (MobileNetV3)</td><td className="num">0.03</td><td className="num">0.20</td><td className="num">0.62</td></tr>
              <tr><td>Invariant embedding</td><td className="num">0.10</td><td className="num">0.49</td><td className="num">0.66</td></tr>
              <tr className="bg-[var(--color-leak-soft)]"><td className="font-semibold">AugLeak (structure + hash)</td><td className="num font-semibold">0.57</td><td className="num font-semibold">0.76</td><td className="num">0.42</td></tr>
              <tr><td>AugLeak + invariant view</td><td className="num">0.52</td><td className="num">–</td><td className="num font-semibold">0.71</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[14px] text-[var(--color-ink-3)]">On the real releases the default AugLeak is best. On tiny 32 × 32 images with combined edits the pixel views are weaker, and adding the invariant view helps; with strong edits no method recovers most pairs. – : not run (memory limit).</p>
        <figure className="mt-8">
          <Image src="/research/fig_detect.webp" alt="Precision-recall curves, calibration of the false-link rate and per-variant recall of the detectors." width={1177} height={851} className="w-full rounded-xl bg-white p-3 ring-1 ring-[var(--color-rule)]" />
          <figcaption className="mt-2 text-[14px] text-[var(--color-ink-3)]">Figure 4: precision–recall, calibration of α, and recall by edit type.</figcaption>
        </figure>
      </Section>

      <Section id="protocols" title="Evaluating without metadata">
        <p className="max-w-3xl text-[16px] text-[var(--color-ink-2)]">Error of each protocol against the split by true groups, in points of linear-probe accuracy (mean of three seeds).</p>
        <div className="mt-6 card overflow-x-auto">
          <table className="table-site">
            <thead><tr><th>Release</th><th className="num">Random split</th><th className="num">Split by AugLeak groups</th><th className="num">Filter flagged test images</th></tr></thead>
            <tbody>
              <tr><td>Leaf-A</td><td className="num">+5.9</td><td className="num font-semibold">−1.8</td><td className="num">−11.9 (13% of the test set kept)</td></tr>
              <tr><td>Leaf-B</td><td className="num">+7.7</td><td className="num font-semibold">+1.1</td><td className="num">−1.3 (13% kept)</td></tr>
              <tr><td>CIFAR-Aug medium</td><td className="num">+36.3</td><td className="num">+31.4 (+9.1 with the invariant view)</td><td className="num">+35.0 (57% kept)</td></tr>
              <tr><td>CIFAR-Aug strong</td><td className="num">+16.3</td><td className="num">+15.5</td><td className="num">+15.3 (90% kept)</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[14px] text-[var(--color-ink-3)]">Splitting by detected groups removes most of the inflation when the detector&apos;s views match the edits. Filtering is unreliable. Only metadata gives a clean split.</p>
      </Section>

      <Section id="limits" title="Limits">
        <ul className="grid max-w-3xl gap-2 text-[16px] text-[var(--color-ink-2)]">
          <li>The models are frozen ImageNet backbones and small networks fine-tuned on CPUs. Large or self-supervised models were not tested.</li>
          <li>AugLeak&apos;s false-link rate is approximate. It depends on the views and on the number of classes; with two or three classes, read α as a lower bound.</li>
          <li>AugLeak never recovers complete groups, so a split by detected groups still leaks a little.</li>
          <li>Duplicate pairs were judged by eye on top-ranked candidates, with AI assistance; all judgements are released.</li>
        </ul>
      </Section>

      <Section id="reproduce" title="Reproduce it">
        <p className="max-w-3xl text-[16px] text-[var(--color-ink-2)]">
          The <a className="text-[var(--color-train)] underline" href={REPO} target="_blank" rel="noreferrer">research folder</a> holds every experiment script, every result file and the scripts that turn them into the paper&apos;s figures, tables and in-text numbers.
        </p>
        <pre className="code mt-5">{`git clone https://github.com/agarwalpranay02/augleak && cd augleak/research
pip install -r requirements.txt
python augleak_cli.py test path/to/train path/to/test --alpha 1e-3   # audit a split
python augleak_cli.py scan path/to/data --alpha 1e-3                 # find copy groups
bash build_paper.sh                                                  # figures, tables and numbers from results/`}</pre>
        <h3 className="mt-8 text-[17px] font-semibold">Cite</h3>
        <pre className="code mt-3">{`@misc{agarwal2026augleak,
  author = {Agarwal, Pranay},
  title  = {Copies Across the Split: Pre-Augmented Datasets Silently Corrupt
            Test Accuracy, and How to Audit Them Without Metadata},
  year   = {2026},
  note   = {Manuscript. Code: https://github.com/agarwalpranay02/augleak}
}`}</pre>
      </Section>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 pt-16">
      <h2 className="display text-[clamp(36px,4.5vw,54px)]">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Prop({ n, title, formula, children }: { n: number; title: string; formula: string; children: React.ReactNode }) {
  return (
    <div className="card flex flex-col p-6">
      <p className="text-[13.5px] font-semibold text-[var(--color-ink-3)]">Proposition {n}</p>
      <h3 className="mt-1 text-[19px] font-semibold">{title}</h3>
      <p className="mono mt-4 rounded-lg bg-[var(--color-paper)] px-3 py-2 text-[14.5px]">{formula}</p>
      <p className="mt-4 text-[15px] text-[var(--color-ink-2)]">{children}</p>
    </div>
  );
}
