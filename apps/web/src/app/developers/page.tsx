import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Playground } from "@/components/Playground";
import { share } from "@/lib/seo";
import { SITE } from "@/lib/site";

export const metadata: Metadata = share({
  title: "API",
  description: "Compare two images, fetch AugLeak features, or compute exposure from your own pipeline. Free keys after you sign in.",
  alternates: { canonical: "/developers" },
});

const BASE = SITE.url;

export default function DevelopersPage() {
  return (
    <div className="wrap">
      <PageHeader kicker="API" title="AugLeak from your own pipeline.">
        <p>
          The same engine as the website, over HTTPS. Use it to compare two images, to fetch AugLeak features for a pipeline of your own, or to compute exposure.
          For a full audit with p-values, run the browser audit or the command-line tool: p-values need the whole dataset.
        </p>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <Endpoint method="POST" path="/api/v1/compare" auth>Two images in, structure correlation under 28 transforms, hash agreement and byte identity out.</Endpoint>
        <Endpoint method="POST" path="/api/v1/features" auth>One image in, its 732-d structure vector (and optionally its 28 transformed views) and its 64-bit hash out.</Endpoint>
        <Endpoint method="GET" path="/api/v1/exposure">Share of test images with a copy in training under a random split. No key needed.</Endpoint>
      </div>

      <section className="pt-14">
        <h2 className="display text-[clamp(34px,4vw,48px)]">Try it</h2>
        <p className="mt-2 text-[var(--color-ink-2)]">Create a key on your <Link className="text-[var(--color-train)] underline" href="/account">account page</Link>, then call the live API from here.</p>
        <div className="mt-6"><Playground /></div>
      </section>

      <section className="pt-14">
        <h2 className="display text-[clamp(34px,4vw,48px)]">Compare two images</h2>
        <pre className="code mt-5">{`curl -X POST ${BASE}/api/v1/compare \\
  -H "Authorization: Bearer al_live_…" \\
  -F a=@test/cat/0012.jpg \\
  -F b=@train/cat/0388.jpg`}</pre>
        <pre className="code mt-3">{`{
  "byte_identical": false,
  "structure": { "score": 0.974, "transform": "flipped", "direction": "a_to_b" },
  "hash": { "agreeing_bits": 64, "transform": "flipped", "a": "bbaca491b5855695", "b": "eef9f1c4e0d103c4" },
  "per_transform": { "a_to_b": [28 numbers], "b_to_a": [28 numbers] },
  "images": { "a": { "width": 192, "height": 192, "sha256": "9309b7d8…" }, "b": { … } },
  "note": "Scores are not p-values. A p-value needs the other images of the dataset; run an audit for that.",
  "latency_ms": 41.2
}`}</pre>
        <p className="mt-3 text-[15px] text-[var(--color-ink-2)]">Images up to 2 MB each, as multipart form fields <span className="kbd">a</span> and <span className="kbd">b</span>. The structure score is the best correlation over the 28 transforms of either image, in [−1, 1].</p>
      </section>

      <section className="pt-14">
        <h2 className="display text-[clamp(34px,4vw,48px)]">Features for your own pipeline</h2>
        <pre className="code mt-5">{`import base64, numpy as np, requests

r = requests.post("${BASE}/api/v1/features?views=1",
                  headers={"Authorization": "Bearer al_live_…"},
                  files={"image": open("leaf_001.jpg", "rb")}).json()
base  = np.frombuffer(base64.b64decode(r["structure"]["data"]), np.float32)          # (732,)
views = np.frombuffer(base64.b64decode(r["views"]["data"]), np.float32).reshape(28, 732)
score = (views @ other_base).max()      # AugLeak's structure score against another image`}</pre>
      </section>

      <section className="pt-14">
        <h2 className="display text-[clamp(34px,4vw,48px)]">Exposure</h2>
        <pre className="code mt-5">{`curl "${BASE}/api/v1/exposure?photos=1000&copies=16&test_share=0.2"

{ "images": 16000, "train_images": 12800, "test_images": 3200, "exposure": 1, "approximation": 1 }`}</pre>
      </section>

      <section className="grid gap-6 pt-14 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="text-[19px] font-semibold">Limits</h2>
          <ul className="mt-3 grid gap-2 text-[15px] text-[var(--color-ink-2)]">
            <li>Free. 20 calls a minute and 3,000 a month per key; up to 10 keys.</li>
            <li>Images up to 2 MB and 25 megapixels. JPEG, PNG, WebP, GIF, TIFF and AVIF.</li>
            <li>Responses carry <span className="kbd">X-RateLimit-*</span> and <span className="kbd">X-Quota-*</span> headers.</li>
          </ul>
        </div>
        <div className="card p-6">
          <h2 className="text-[19px] font-semibold">Errors</h2>
          <ul className="mt-3 grid gap-1.5 text-[15px] text-[var(--color-ink-2)]">
            <li><span className="kbd">401 invalid_api_key</span> missing or revoked key</li>
            <li><span className="kbd">413 too_large</span> an image over 2 MB</li>
            <li><span className="kbd">415 unsupported_media_type</span> not multipart/form-data</li>
            <li><span className="kbd">422 unreadable_image</span> the file is not an image</li>
            <li><span className="kbd">429 rate_limited / quota_exceeded</span> slow down or wait</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

function Endpoint({ method, path, auth, children }: { method: string; path: string; auth?: boolean; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <p className="mono text-[14px]"><span className={`mr-2 rounded px-1.5 py-0.5 text-[12px] font-semibold ${method === "GET" ? "bg-[var(--color-ok-soft)] text-[var(--color-ok)]" : "bg-[var(--color-train-soft)] text-[var(--color-train)]"}`}>{method}</span>{path}</p>
      <p className="mt-3 text-[15px] text-[var(--color-ink-2)]">{children}</p>
      <p className="mt-3 text-[13px] text-[var(--color-ink-3)]">{auth ? "API key required" : "No key needed"}</p>
    </div>
  );
}
