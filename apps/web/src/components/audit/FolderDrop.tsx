"use client";
import { useRef, useState } from "react";
import type { InputImage } from "@/lib/engine/engine";
import { classCounts, fromDrop, fromFileList, fromZip } from "@/lib/engine/files";

const TONE = {
  train: { ring: "border-[var(--color-train)] bg-[var(--color-train-soft)]", title: "text-[var(--color-train)]" },
  test: { ring: "border-[var(--color-test)] bg-[var(--color-test-soft)]", title: "text-[var(--color-test)]" },
  all: { ring: "border-[var(--color-ink-2)] bg-[var(--color-paper-2)]", title: "text-[var(--color-ink)]" },
} as const;

interface Props {
  tone: keyof typeof TONE;
  title: string;
  hint: string;
  images: InputImage[] | null;
  onChange: (imgs: InputImage[] | null) => void;
  disabled?: boolean;
}

/** Choose a folder, drop one, or open a ZIP. One sub-folder per class. */
export function FolderDrop({ tone, title, hint, images, onChange, disabled }: Props) {
  const folder = useRef<HTMLInputElement>(null);
  const zip = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [reading, setReading] = useState<string | null>(null);
  const t = TONE[tone];
  const classes = images ? classCounts(images) : [];

  async function load(fn: () => Promise<InputImage[]>) {
    setReading("Reading…");
    try {
      const imgs = await fn();
      onChange(imgs.length ? imgs : null);
      if (!imgs.length) setReading("No images found. Use one sub-folder per class (JPG, PNG, BMP, WebP, GIF or TIFF).");
      else setReading(null);
    } catch (e) {
      setReading(e instanceof Error ? e.message : "Could not read those files.");
    }
  }

  return (
    <div
      className={`flex min-h-[200px] flex-col gap-3 rounded-2xl border-2 border-dashed p-5 transition-colors ${images || over ? t.ring + " border-solid" : "border-[var(--color-rule)] bg-[var(--color-card)]"}`}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setOver(false);
        if (disabled) return;
        const f = e.dataTransfer.files;
        if (f.length === 1 && /\.zip$/i.test(f[0].name)) load(() => fromZip(f[0], (d, n) => setReading(`Unzipping ${d} of ${n}…`)));
        else load(() => fromDrop(e.dataTransfer.items));
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className={`text-[16px] font-semibold ${t.title}`}>{title}</h3>
        {images && <span className="mono text-[13.5px] text-[var(--color-ink-2)]">{images.length.toLocaleString()} images · {classes.length} classes</span>}
      </div>
      {images ? (
        <ul className="grid flex-1 grid-cols-1 content-start gap-x-6 text-[14px] sm:grid-cols-2">
          {classes.slice(0, 10).map(([c, n]) => (
            <li key={c} className="flex justify-between gap-3 border-b border-black/5 py-1">
              <span className="truncate">{c}</span><span className="mono text-[var(--color-ink-2)]">{n}</span>
            </li>
          ))}
          {classes.length > 10 && <li className="py-1 text-[var(--color-ink-3)]">and {classes.length - 10} more classes</li>}
        </ul>
      ) : (
        <p className="flex-1 text-[14.5px] text-[var(--color-ink-3)]">{reading ?? hint}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-sm btn-ghost" disabled={disabled} onClick={() => folder.current?.click()}>{images ? "Choose another folder" : "Choose folder"}</button>
        <button type="button" className="btn btn-sm btn-ghost" disabled={disabled} onClick={() => zip.current?.click()}>Open a ZIP</button>
        {images && <button type="button" className="ml-auto text-[14px] text-[var(--color-ink-2)] underline" disabled={disabled} onClick={() => { onChange(null); setReading(null); }}>Clear</button>}
      </div>
      <input
        ref={folder}
        type="file"
        hidden
        multiple
        // @ts-expect-error non-standard but supported by every major browser
        webkitdirectory=""
        onChange={(e) => { const f = e.target.files; if (f) load(async () => fromFileList(f)); e.target.value = ""; }}
      />
      <input ref={zip} type="file" hidden accept=".zip,application/zip" onChange={(e) => { const f = e.target.files?.[0]; if (f) load(() => fromZip(f, (d, n) => setReading(`Unzipping ${d} of ${n}…`))); e.target.value = ""; }} />
    </div>
  );
}
