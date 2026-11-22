// Turning folders chosen or dropped by the user into labelled images (one sub-folder per class).
import type { InputImage } from "./engine";

const EXT = /\.(jpe?g|png|bmp|webp|gif|tiff?)$/i;

function make(path: string, file: Blob): InputImage | null {
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2 || !EXT.test(parts[parts.length - 1])) return null;
  // root/class/.../file  -> class = first folder under the chosen folder
  const label = parts.length >= 3 ? parts[1] : parts[0];
  return { name: parts.slice(1).join("/") || parts[0], label, blob: file, url: "" };
}

export function fromFileList(list: FileList | File[]): InputImage[] {
  const out: InputImage[] = [];
  for (const f of Array.from(list)) {
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
    const im = make(rel, f);
    if (im) out.push(im);
  }
  return sortImages(out);
}

async function readEntry(entry: FileSystemEntry, out: { path: string; file: File }[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
    out.push({ path: entry.fullPath, file });
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
      if (!batch.length) break;
      for (const e of batch) await readEntry(e, out);
    }
  }
}

/** Items dropped on a drop zone. A single dropped folder is the dataset root; several dropped
 *  folders are taken as the class folders themselves. */
export async function fromDrop(items: DataTransferItemList): Promise<InputImage[]> {
  const entries = Array.from(items).map((i) => i.webkitGetAsEntry()).filter((e): e is FileSystemEntry => !!e);
  const files: { path: string; file: File }[] = [];
  for (const e of entries) await readEntry(e, files);
  const severalFolders = entries.filter((e) => e.isDirectory).length > 1;
  const out: InputImage[] = [];
  for (const { path, file } of files) {
    const im = make(severalFolders ? "dropped" + path : path, file);
    if (im) out.push(im);
  }
  return sortImages(out);
}

function sortImages(a: InputImage[]): InputImage[] {
  return a.sort((p, q) => (p.label === q.label ? (p.name < q.name ? -1 : 1) : p.label < q.label ? -1 : 1));
}

export function classCounts(imgs: InputImage[]): [string, number][] {
  const m = new Map<string, number>();
  for (const i of imgs) m.set(i.label, (m.get(i.label) ?? 0) + 1);
  return Array.from(m.entries());
}

export async function loadDemo(onProgress?: (done: number, total: number) => void): Promise<{ train: InputImage[]; test: InputImage[] }> {
  const base = `${import.meta.env.BASE_URL}demo/fruits360/`;
  const list: string[] = await (await fetch(base + "manifest.json")).json();
  const train: InputImage[] = [], test: InputImage[] = [];
  let done = 0;
  const conc = 16;
  let k = 0;
  await Promise.all(Array.from({ length: conc }, async () => {
    while (k < list.length) {
      const p = list[k++];
      const url = base + p.split("/").map(encodeURIComponent).join("/");
      const blob = await (await fetch(url)).blob();
      const [split, label, file] = p.split("/");
      (split === "train" ? train : test).push({ name: `${label}/${file}`, label, blob, url });
      onProgress?.(++done, list.length);
    }
  }));
  return { train: sortImages(train), test: sortImages(test) };
}

export function urlOf(im: InputImage): string {
  if (!im.url) im.url = URL.createObjectURL(im.blob);
  return im.url;
}
