import Link from "next/link";
import { ExposureExplorer } from "@/components/ExposureExplorer";
import { HeroReplay } from "@/components/HeroReplay";
import { AUDITS, PAPER } from "@/lib/site";
import demo from "../../public/demo/fruits360/result.json";
import manifest from "../../public/demo/fruits360/manifest.json";

export default function Home() {
  const pairs = [0, 2, 3, 25, 26, 28].map((i) => demo.flagged[i]).filter(Boolean);
  const flaggedTest = new Set(demo.flagged.map((f) => f.test));
  const flaggedTrain = new Set(demo.flagged.map((f) => f.train));
  const cleanTest = (manifest as string[]).filter((m) => m.startsWith("test/") && !flaggedTest.has(m)).filter((_, i) => i % 7 === 3).slice(0, 6);
  const otherTrain = (manifest as string[]).filter((m) => m.startsWith("train/") && !flaggedTrain.has(m)).filter((_, i) => i % 61 === 11).slice(0, 6);

  return (
    <>
      {/* hero */}
      <section className="night grid-night relative overflow-hidden">
        <div className="wrap grid items-center gap-12 pb-20 pt-14 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-20">
          <div>
            <h1 className="display text-[clamp(52px,8.4vw,112px)] text-white">
              Your test set has seen this before.
            </h1>
            <p className="mt-7 max-w-[34rem] text-[18px] leading-relaxed text-white/80">
              Many image datasets ship every photograph with flipped, rotated and filtered copies. Split one at random and copies land on both sides,
              so the test score measures memory. AugLeak finds those copies from the pixels alone, in your browser, with a false-link rate you choose.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/audit" className="btn btn-leak">Audit your dataset</Link>
              <Link href="/research" className="btn btn-on-night">Read the research</Link>
            </div>
            <ul className="mt-9 grid gap-2 text-[15px] text-white/75">
              <li className="flex items-center gap-2.5"><Dot />Your images never leave your device. No upload, no account.</li>
              <li className="flex items-center gap-2.5"><Dot />Same results as the paper&apos;s reference Python code.</li>
            </ul>
          </div>
          <HeroReplay pairs={pairs} cleanTest={cleanTest} otherTrain={otherTrain} nTest={demo.nTest} nTrain={demo.nTrain} nFlagged={demo.flagged.length} />
        </div>
      </section>

      {/* evidence band */}
      <section className="border-b border-[var(--color-rule)] bg-[var(--color-card)]">
        <div className="wrap grid gap-px py-2 sm:grid-cols-2 lg:grid-cols-4">
          <Stat big={`${PAPER.finetune.reported} → ${PAPER.finetune.fresh}`} text="A fine-tuned MobileNetV3 on a pre-augmented CIFAR release: the random-split score against its score on fresh photographs (3 seeds)." />
          <Stat big="51%" text="of the official test set of a popular brain-MRI benchmark has a copy in training; 22% are byte-identical files." />
          <Stat big={PAPER.exposureAt16} text="of test images have a copy in training under a random split, once each photograph ships with 15 copies." />
          <Stat big={`${PAPER.detection.augleakAP} vs ${PAPER.detection.embeddingAP}`} text="Average precision at finding copies on a public leaf-disease release: AugLeak against an ImageNet embedding." />
        </div>
      </section>

      {/* the problem */}
      <section className="wrap pt-20">
        <div className="max-w-3xl">
          <h2 className="display text-[clamp(38px,5vw,60px)]">A random split almost never keeps copies apart.</h2>
          <p className="mt-5 text-[17px] text-[var(--color-ink-2)]">
            If each photograph comes with k − 1 edited copies, a test image escapes only if every one of its copies also lands in the test set.
            With a 20% test share that happens with probability 0.2<sup>k−1</sup>: one test image in five when each photograph has a single copy,
            one in 78,000 when it has seven. Everything else is scored on something the model has already seen.
          </p>
        </div>
        <div className="mt-10"><ExposureExplorer /></div>
      </section>

      {/* tools */}
      <section className="wrap pt-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="display text-[clamp(38px,5vw,60px)]">Four ways to check a dataset</h2>
          <p className="max-w-md text-[16px] text-[var(--color-ink-2)]">All of them run on your own device. Folders, single images or a ZIP file.</p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <Tool href="/audit" title="Audit a train/test split" tag="most used" body="Drop your training and test folders. Get every test image with a copy in training, the copy next to it, a p-value, and a clean test list to download." art={<SplitArt />} />
          <Tool href="/audit?mode=groups" title="Find copy groups in one folder" body="Before you split: group the images that are copies of one photograph, then download a train/test split that keeps every group on one side." art={<GroupArt />} />
          <Tool href="/inspect" title="Inspect a pair" body="Are these two images copies? See the correlation under all 28 transforms AugLeak tries, the best one, and the 64-bit hashes side by side." art={<PairArt />} />
          <Tool href="/developers" title="Call the API" body="Compare two images or fetch AugLeak features from your own pipeline. Free keys after you sign in." art={<ApiArt />} />
        </div>
      </section>

      {/* registry teaser */}
      <section className="wrap pt-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="display text-[clamp(38px,5vw,60px)]">What we found in public datasets</h2>
          <Link href="/registry" className="btn btn-ghost">Open the registry</Link>
        </div>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AUDITS.filter((a) => a.id !== "cifar-10").map((a) => (
            <li key={a.id}>
              <Link href={`/registry#${a.id}`} className="card group flex h-full flex-col p-5 transition-shadow hover:shadow-[0_12px_32px_-18px_rgb(11_21_36/0.45)]">
                <span className="text-[14px] font-semibold text-[var(--color-ink-2)]">{a.short}</span>
                <span className="display mt-3 text-[54px] leading-none text-[var(--color-leak)]">{a.headline}</span>
                <span className="mt-2 text-[15px] text-[var(--color-ink-2)]">{a.headlineText}</span>
                <span className="mt-auto pt-4 text-[14px] font-semibold text-[var(--color-train)] group-hover:underline">See the evidence</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* how it works */}
      <section className="wrap pt-24">
        <h2 className="display max-w-3xl text-[clamp(38px,5vw,60px)]">How AugLeak decides that two images are copies</h2>
        <p className="mt-5 max-w-2xl text-[17px] text-[var(--color-ink-2)]">
          Released copies are made to look different. In an ImageNet embedding a filtered copy often sits closer to other filtered images than to its own original, so AugLeak compares structure instead, and calibrates every decision on the class labels.
        </p>
        <ol className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2">
          <Step n={1} title="Compare structure, not colour">Each image becomes a blurred 32 × 32 grayscale thumbnail inside a circle. Contrast changes, thresholds and gamma alter intensities but keep where things are, so the correlation survives them.</Step>
          <Step n={2} title="Undo the geometric edits">One image is also tried flipped, turned, rotated by up to 45° and re-cropped (28 versions), and the best match counts. A perceptual hash searched over flips and turns is a second, independent view.</Step>
          <Step n={3} title="Discount images that match everything">Plain, low-texture images resemble many others. Each score is standardised against both images&apos; typical scores, so a pair counts only if the two single each other out.</Step>
          <Step n={4} title="Calibrate on the class labels">Augmentation never changes a label, so an image&apos;s best match in another class is never its copy. An extreme-value fit to those matches turns every score into a p-value; pairs below your α are linked. Identical files are always linked.</Step>
        </ol>
      </section>

      {/* research */}
      <section className="wrap pt-24">
        <div className="night grid-night overflow-hidden rounded-3xl p-8 sm:p-12">
          <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-end">
            <div>
              <p className="text-[15px] font-semibold text-[#ff8fb0]">The research behind it</p>
              <h2 className="display-wide mt-3 text-[clamp(26px,3vw,36px)] leading-tight text-white">{PAPER.title}</h2>
              <p className="muted mt-4 max-w-2xl text-[16px]">
                Theory that predicts how many test images are exposed, controlled experiments that measure how far reported accuracy moves, the detector, three evaluation protocols that need no metadata, and an audit of six public collections.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link href="/research" className="btn btn-leak">Methods and results</Link>
              <a href="https://github.com/agarwalpranay02/augleak/tree/main/research" className="btn btn-on-night" target="_blank" rel="noreferrer">Reproduce it</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Dot() {
  return <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-leak)]" />;
}

function Stat({ big, text }: { big: string; text: string }) {
  return (
    <div className="px-1 py-6 sm:px-5">
      <p className="display text-[40px] leading-none text-[var(--color-ink)] tnum">{big}</p>
      <p className="mt-3 text-[14.5px] text-[var(--color-ink-2)]">{text}</p>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[44px_1fr] gap-4">
      <span className="display grid h-11 w-11 place-items-center rounded-full border-2 border-[var(--color-ink)] text-[20px]">{n}</span>
      <div>
        <h3 className="text-[18px] font-semibold">{title}</h3>
        <p className="mt-1.5 text-[15.5px] text-[var(--color-ink-2)]">{children}</p>
      </div>
    </li>
  );
}

function Tool({ href, title, body, art, tag }: { href: string; title: string; body: string; art: React.ReactNode; tag?: string }) {
  return (
    <Link href={href} className="card group grid grid-cols-[1fr_120px] items-center gap-5 p-6 transition-shadow hover:shadow-[0_12px_32px_-18px_rgb(11_21_36/0.45)] sm:grid-cols-[1fr_150px]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[19px] font-semibold">{title}</h3>
          {tag && <span className="chip chip-leak">{tag}</span>}
        </div>
        <p className="mt-2 text-[15px] text-[var(--color-ink-2)]">{body}</p>
        <span className="mt-4 inline-block text-[14px] font-semibold text-[var(--color-train)] group-hover:underline">Open</span>
      </div>
      <div aria-hidden="true">{art}</div>
    </Link>
  );
}

const T = "#b4730b", R = "#2a62a4", L = "#df2459";
function SplitArt() {
  return (
    <svg viewBox="0 0 150 100" className="w-full">
      {[0, 1, 2].map((i) => <rect key={`a${i}`} x="10" y={10 + i * 28} width="34" height="22" rx="4" fill="#f8edd8" stroke={T} strokeWidth="1.5" />)}
      {[0, 1, 2].map((i) => <rect key={`b${i}`} x="106" y={10 + i * 28} width="34" height="22" rx="4" fill="#e2ecf7" stroke={R} strokeWidth="1.5" />)}
      <line x1="75" y1="4" x2="75" y2="96" stroke="#d2d9e1" strokeWidth="2" strokeDasharray="4 4" />
      <path d="M44 21 C75 21 75 77 106 77" fill="none" stroke={L} strokeWidth="2" />
      <path d="M44 77 C75 77 75 49 106 49" fill="none" stroke={L} strokeWidth="2" />
    </svg>
  );
}
function GroupArt() {
  return (
    <svg viewBox="0 0 150 100" className="w-full">
      {[[20, 20], [48, 14], [34, 46]].map(([x, y], i) => <rect key={i} x={x} y={y} width="24" height="20" rx="4" fill="#e2ecf7" stroke={R} strokeWidth="1.5" />)}
      {[[92, 40], [118, 58], [96, 70]].map(([x, y], i) => <rect key={i} x={x} y={y} width="24" height="20" rx="4" fill="#e2ecf7" stroke={R} strokeWidth="1.5" />)}
      <ellipse cx="46" cy="38" rx="40" ry="32" fill="none" stroke={L} strokeWidth="1.8" strokeDasharray="4 3" />
      <ellipse cx="112" cy="64" rx="32" ry="28" fill="none" stroke={L} strokeWidth="1.8" strokeDasharray="4 3" />
    </svg>
  );
}
function PairArt() {
  return (
    <svg viewBox="0 0 150 100" className="w-full">
      <rect x="8" y="22" width="56" height="56" rx="6" fill="#f8edd8" stroke={T} strokeWidth="1.5" />
      <rect x="86" y="22" width="56" height="56" rx="6" fill="#e2ecf7" stroke={R} strokeWidth="1.5" />
      <path d="M22 62 L36 36 L50 62 Z" fill={T} opacity=".55" />
      <path d="M128 62 L114 36 L100 62 Z" fill={R} opacity=".55" />
      <path d="M66 50 H84" stroke={L} strokeWidth="2.4" />
      <text x="75" y="96" textAnchor="middle" fontSize="11" fill="#66727f" fontFamily="var(--font-mono)">flipped</text>
    </svg>
  );
}
function ApiArt() {
  return (
    <svg viewBox="0 0 150 100" className="w-full">
      <rect x="6" y="14" width="138" height="72" rx="8" fill="#0b1524" />
      <text x="16" y="38" fontSize="11" fill="#8db6e6" fontFamily="var(--font-mono)">POST /v1/compare</text>
      <text x="16" y="56" fontSize="11" fill="#dbe5f2" fontFamily="var(--font-mono)">&quot;structure&quot;: 0.97</text>
      <text x="16" y="72" fontSize="11" fill="#ff8fb0" fontFamily="var(--font-mono)">&quot;copy&quot;: true</text>
    </svg>
  );
}
