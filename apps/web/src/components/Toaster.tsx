"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { subscribe, type Toast } from "@/lib/toast";

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => subscribe(setItems), []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div key={t.id} role="status" className="pointer-events-auto flex items-center gap-4 rounded-xl bg-[var(--color-night)] px-4 py-3 text-[15px] text-white shadow-[0_12px_32px_-12px_rgb(11_21_36/0.5)]" style={{ animation: "fade-in .2s" }}>
          <span>{t.text}</span>
          {t.href && <Link href={t.href} className="font-semibold text-[#ff8fb0] underline-offset-4 hover:underline">{t.action ?? "Open"}</Link>}
        </div>
      ))}
    </div>
  );
}
