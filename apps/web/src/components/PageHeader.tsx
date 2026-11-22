import type { ReactNode } from "react";

export function PageHeader({ kicker, title, children }: { kicker: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="pb-10 pt-12 sm:pt-16">
      <p className="text-[15px] font-semibold text-[var(--color-leak)]">{kicker}</p>
      <h1 className="display mt-3 max-w-4xl text-[clamp(48px,7vw,88px)]">{title}</h1>
      {children && <div className="mt-6 max-w-3xl text-[18px] leading-relaxed text-[var(--color-ink-2)]">{children}</div>}
    </header>
  );
}
