"use client";
// A short history of audits run on this device (summaries only, never images), in IndexedDB.
import { get, set } from "idb-keyval";

export interface AuditSummary {
  id: string;
  at: number;
  mode: "split" | "groups";
  name: string;
  images: number;
  classes: number;
  alpha: number;
  headline: string;   // e.g. "29 of 75 test images have a copy in training"
  share: number;      // flagged share (split) or linked share (groups)
  seconds: number;
}

const KEY = "augleak:history:v1";

export async function loadHistory(): Promise<AuditSummary[]> {
  try { return ((await get(KEY)) as AuditSummary[] | undefined) ?? []; } catch { return []; }
}

export async function addHistory(s: AuditSummary) {
  try { await set(KEY, [s, ...(await loadHistory())].slice(0, 20)); } catch { /* private mode: no history */ }
}

export async function clearHistory() {
  try { await set(KEY, []); } catch { /* ignore */ }
}
