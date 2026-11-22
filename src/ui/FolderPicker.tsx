import { useRef, useState } from "react";
import type { InputImage } from "../engine/engine";
import { classCounts, fromDrop, fromFileList } from "../engine/files";

interface Props {
  side: "train" | "test" | "all";
  title: string;
  hint: string;
  images: InputImage[] | null;
  onChange: (imgs: InputImage[]) => void;
  disabled?: boolean;
}

export function FolderPicker({ side, title, hint, images, onChange, disabled }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [reading, setReading] = useState(false);
  const classes = images ? classCounts(images) : [];

  return (
    <div
      className={`drop drop-${side}${over ? " over" : ""}${images ? " filled" : ""}`}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={async (e) => {
        e.preventDefault(); setOver(false);
        if (disabled) return;
        setReading(true);
        try { onChange(await fromDrop(e.dataTransfer.items)); } finally { setReading(false); }
      }}
    >
      <div className="drop-head">
        <span className="drop-title">{title}</span>
        {images && <span className="drop-count">{images.length.toLocaleString()} images</span>}
      </div>
      {images ? (
        <ul className="classes">
          {classes.slice(0, 8).map(([c, n]) => (
            <li key={c}><span>{c}</span><span className="num">{n}</span></li>
          ))}
          {classes.length > 8 && <li className="more">and {classes.length - 8} more classes</li>}
        </ul>
      ) : (
        <p className="drop-hint">{reading ? "Reading the folder…" : hint}</p>
      )}
      <div className="drop-actions">
        <button type="button" className="btn ghost" disabled={disabled} onClick={() => input.current?.click()}>
          {images ? "Choose another folder" : "Choose folder"}
        </button>
        {images && <button type="button" className="btn link" disabled={disabled} onClick={() => onChange([])}>Clear</button>}
      </div>
      <input
        ref={input}
        type="file"
        hidden
        multiple
        // @ts-expect-error non-standard but supported by all major browsers
        webkitdirectory=""
        onChange={(e) => { if (e.target.files) onChange(fromFileList(e.target.files)); e.target.value = ""; }}
      />
    </div>
  );
}
