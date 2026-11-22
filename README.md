# AugLeak

**Find the test images your model has already seen.**

Many image datasets are released already augmented: every photograph comes with flipped, rotated,
recoloured and filtered copies, and nothing records which files belong together. Split such a dataset at
random and copies of the same photograph land in both training and test, so the reported test accuracy
measures memory as much as generalisation.

AugLeak finds those copies from the pixels alone, with a false-link rate you choose. This repository holds
the web app, which runs the whole audit in your browser (your images are never uploaded), and the reference
command-line tool.

## What it does

| Tool | Input | Output |
|---|---|---|
| Check a train/test split | a training folder and a test folder, one sub-folder per class | every test image with a copy in training, the closest copy, a p-value, and a clean test list |
| Find copies in one folder | one dataset folder, one sub-folder per class | groups of images that are copies of one photograph, and a group-aware train/test split |
| Exposure calculator | number of photographs, copies per photograph, test share | the share of test images that have a copy in training under a random split |

## How it decides that two images are copies

1. **Structure, not colour.** Each image becomes a blurred 32 × 32 grayscale thumbnail inside a circle. Photometric filters change intensities but keep where things are, so the correlation survives them.
2. **Transform search.** The query image is also tried flipped, turned by quarter turns, rotated by up to 45° and re-cropped (28 versions). A 64-bit perceptual hash, searched over flips and quarter turns, is a second view.
3. **Hubness correction.** Every score is standardised against each image's own score distribution, and a pair counts only if both images single each other out.
4. **A null calibrated on the class labels.** Augmentation never changes the label, so an image's best match in another class is never its copy. A Gumbel (extreme-value) fit to those best matches turns every score into a p-value. The two views are combined with a Bonferroni correction, and pairs with p < α are linked. Byte-identical files of the same class are always linked.

Limits: detected groups are a lower bound, because heavily edited copies can be missed. α is estimated from
other classes, so it is approximate when there are only two or three classes. At least two classes are needed.

## The web app

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
```

Built with Vite, React and TypeScript. Images are decoded and compared in Web Workers (one per CPU core),
so nothing is sent to a server. The browser version handles up to 4,000 images per run.

## The command-line tool

```bash
pip install -r cli/requirements.txt
python cli/augleak_cli.py test  path/to/train path/to/test --alpha 1e-3
python cli/augleak_cli.py scan  path/to/data --alpha 1e-3
python cli/augleak_cli.py split path/to/data --test-frac 0.2
```

## The browser and the Python tool give the same answers

`src/core` is a line-by-line port of `cli/`, including Pillow's bilinear resampler and SciPy's Gaussian filter
and rotation, so the features are identical. `src/core/parity.test.ts` checks this on the bundled demo split
(three classes of Fruits-360):

- structure scores differ by at most one float16 rounding step, and hash scores are identical;
- p-values agree to within 1.3%;
- both flag the same 29 of 75 test images, and in scan mode both find the same 8,149 links.

```bash
python scripts/make_fixtures.py   # reference outputs from the Python tool
npx vitest run
```

Browsers decode some JPEG files slightly differently from Pillow, which can move a borderline p-value.

## Demo data

The demo uses images from [Fruits-360](https://github.com/Horea94/Fruit-Images-Dataset) by Horea Mureșan and
Mihai Oltean (MIT licence, see `public/demo/fruits360/LICENSE`): every second training frame and 25 random
test images for the banana, cherry and peach classes of the official split.

## Licence

MIT. See `LICENSE`.
