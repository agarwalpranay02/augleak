import { useState } from "react";
import { CheckSplit } from "./ui/CheckSplit";
import { FindCopies } from "./ui/FindCopies";
import { Exposure } from "./ui/Exposure";

const REPO = "https://github.com/agarwalpranay02/augleak";
const DEMO = `${import.meta.env.BASE_URL}demo/fruits360/`;

const HERO_PAIRS = [
  { test: "test/banana/r_56_100.jpg", train: "train/banana/r_55_100.jpg", p: "1.2 × 10⁻⁷" },
  { test: "test/banana/113_100.jpg", train: "train/banana/107_100.jpg", p: "1.9 × 10⁻⁸" },
  { test: "test/cherry/40_100.jpg", train: "train/cherry/314_100.jpg", p: "1.8 × 10⁻⁴" },
  { test: "test/peach/9_100.jpg", train: "train/peach/11_100.jpg", p: "3.0 × 10⁻⁴" },
];

type Tab = "check" | "scan" | "exposure";
const TABS: { id: Tab; label: string }[] = [
  { id: "check", label: "Check a train/test split" },
  { id: "scan", label: "Find copies in one folder" },
  { id: "exposure", label: "How many copies leak?" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("check");
  return (
    <>
      <header className="top">
        <a className="wordmark" href="#top" aria-label="AugLeak home"><Mark />AugLeak</a>
        <nav>
          <a href="#tool">Tool</a>
          <a href="#how">How it works</a>
          <a href={REPO} target="_blank" rel="noreferrer">Code</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <h1>Find the test images your model has already seen.</h1>
            <p className="lede">
              Many image datasets ship every photograph with flipped, rotated, recoloured and filtered copies. Split such a
              dataset at random and copies of the same photograph land in both training and test, so the test score measures memory.
              AugLeak finds those copies from the pixels alone, with a false-link rate you choose.
            </p>
            <div className="hero-actions">
              <a className="btn primary" href="#tool">Check your split</a>
              <span className="privacy"><LockIcon /> Runs in your browser. Your images are never uploaded.</span>
            </div>
          </div>
          <figure className="hero-fig">
            <div className="hero-cols" aria-hidden="true"><span className="c-test">test</span><span className="c-train">train</span></div>
            <ul>
              {HERO_PAIRS.map((h) => (
                <li key={h.test}>
                  <img src={DEMO + h.test} alt="" />
                  <svg viewBox="0 0 60 20" aria-hidden="true"><path d="M2 10 H58" /><circle cx="2" cy="10" r="2.5" /><circle cx="58" cy="10" r="2.5" /></svg>
                  <img src={DEMO + h.train} alt="" />
                  <span className="hero-p">p = {h.p}</span>
                </li>
              ))}
            </ul>
            <figcaption>Pairs AugLeak found in the official Fruits-360 split: each test image is a frame of the same rotating fruit as a training image.</figcaption>
          </figure>
        </section>

        <section id="tool" className="tool">
          <div className="tabs" role="tablist" aria-label="AugLeak tools">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </div>
          <div role="tabpanel">
            {tab === "check" && <CheckSplit />}
            {tab === "scan" && <FindCopies />}
            {tab === "exposure" && <Exposure />}
          </div>
        </section>

        <section id="how" className="how">
          <h2>How AugLeak decides that two images are copies</h2>
          <p className="how-intro">
            Released copies are made to look different, and an ImageNet embedding often places a filtered copy closer to other
            filtered images than to its own original. AugLeak compares images in four steps instead.
          </p>
          <ol className="steps">
            <li>
              <h3>Compare structure, not colour</h3>
              <p>Each image becomes a blurred 32 × 32 grayscale thumbnail inside a circle. Filters such as contrast equalisation,
                thresholding or gamma change the intensities but keep where things are, so the correlation survives them.</p>
            </li>
            <li>
              <h3>Undo the geometric edits</h3>
              <p>One image is also tried flipped, turned by quarter turns, rotated by up to 45° and re-cropped (28 versions),
                and the best match counts. A perceptual hash, searched over flips and quarter turns, is a second opinion.</p>
            </li>
            <li>
              <h3>Discount images that match everything</h3>
              <p>Plain, low-texture images resemble many others. Every score is standardised against each image's own typical score,
                and a pair only counts if both images single each other out.</p>
            </li>
            <li>
              <h3>Calibrate on the class labels</h3>
              <p>Augmentation never changes the label, so an image's best match in another class is never its copy. Those best matches
                show how high an unrelated match can score; an extreme-value fit turns every pair score into a p-value, and pairs below
                your α are linked. Byte-identical files are always linked.</p>
            </li>
          </ol>

          <div className="limits">
            <h3>What to keep in mind</h3>
            <ul>
              <li>Groups are a lower bound. Heavily edited copies, such as edge maps or crops of tiny images, can be missed, so a split by detected groups can still leak a little.</li>
              <li>α is the rate of false links to unrelated images, estimated from other classes. With only two or three classes it is approximate; read it as a lower bound.</li>
              <li>You need at least two classes, one sub-folder each. The browser version handles up to 4,000 images per run; the command-line tool in the repository handles more.</li>
              <li>Results match the reference Python implementation: on the demo split both flag the same 29 test images. Browsers decode some JPEG files slightly differently, which can move a borderline p-value.</li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="foot">
        <p>AugLeak is open source (MIT). The method and its evaluation are described in an accompanying research paper; a link will appear here when the preprint is public.</p>
        <p><a href={REPO} target="_blank" rel="noreferrer">Source code and command-line tool on GitHub</a></p>
        <p>Made by <a href="https://github.com/agarwalpranay02" target="_blank" rel="noreferrer">Pranay Agarwal</a></p>
        <p className="dim">Demo images: Fruits-360 by Horea Mureșan and Mihai Oltean (MIT licence).</p>
      </footer>
    </>
  );
}

function Mark() {
  return (
    <svg className="mark" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="5" width="8" height="14" rx="1.5" />
      <rect x="14" y="5" width="8" height="14" rx="1.5" />
      <path d="M7 12 H17" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg>
  );
}
