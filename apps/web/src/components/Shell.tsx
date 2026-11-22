"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV, SITE } from "@/lib/site";
import { Wordmark } from "./Logo";

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
}

export function Header() {
  const path = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const night = path === "/";
  const [menuPath, setMenuPath] = useState(path);
  if (menuPath !== path) { setMenuPath(path); setOpen(false); }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className={`sticky top-0 z-50 border-b backdrop-blur-md ${night ? "border-white/10 bg-[var(--color-night)]/90 text-white" : "border-[var(--color-rule)] bg-[var(--color-paper)]/85"}`}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-black">Skip to content</a>
      <div className="wrap flex h-16 items-center gap-6">
        <Link href="/" aria-label="AugLeak home" className="shrink-0"><Wordmark night={night} /></Link>
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV.slice(1).map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(path, n.href) ? "page" : undefined}
              className={`rounded-lg px-3 py-2 text-[15px] font-medium transition-colors ${
                isActive(path, n.href)
                  ? night ? "bg-white/10 text-white" : "bg-[var(--color-card)] text-[var(--color-ink)] shadow-[0_0_0_1px_var(--color-rule)]"
                  : night ? "text-white/75 hover:text-white" : "text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <a href={SITE.github} target="_blank" rel="noreferrer" className={`hidden rounded-lg p-2 sm:inline-flex ${night ? "text-white/75 hover:text-white" : "text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"}`} aria-label="Source code on GitHub">
            <GitHubIcon />
          </a>
          <Link href="/account" className={`btn btn-sm hidden sm:inline-flex ${night ? "btn-on-night" : "btn-ghost"}`}>Account</Link>
          <Link href="/audit" className="btn btn-sm btn-leak hidden sm:inline-flex">Audit a dataset</Link>
          <button
            type="button"
            className={`inline-flex h-10 w-10 items-center justify-center rounded-lg lg:hidden ${night ? "text-white" : "text-[var(--color-ink)]"}`}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className={`border-t lg:hidden ${night ? "border-white/10 bg-[var(--color-night)]" : "border-[var(--color-rule)] bg-[var(--color-paper)]"}`}>
          <ul className="wrap grid gap-1 py-3">
            {[...NAV, { href: "/account", label: "Account and API keys" }].map((n) => (
              <li key={n.href}>
                <Link href={n.href} aria-current={isActive(path, n.href) ? "page" : undefined} className={`block rounded-lg px-3 py-2.5 text-[16px] font-medium ${isActive(path, n.href) ? (night ? "bg-white/10" : "bg-[var(--color-card)]") : ""}`}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}

export function GitHubIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="mt-24 border-t border-[var(--color-rule)] bg-[var(--color-paper-2)]">
      <div className="wrap grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Wordmark />
          <p className="mt-4 max-w-sm text-[15px] text-[var(--color-ink-2)]">
            Finds augmented copies that leak across a train/test split, from the pixels alone. The audit runs in your browser; your images are never uploaded.
          </p>
        </div>
        <FooterCol title="Tools" links={[["/audit", "Audit a split"], ["/audit?mode=groups", "Find copy groups"], ["/inspect", "Inspect a pair"], ["/research#exposure", "Exposure calculator"]]} />
        <FooterCol title="Evidence" links={[["/registry", "Dataset registry"], ["/research", "Research"], ["/developers", "API"], [SITE.github, "Source code"]]} />
        <FooterCol title="AugLeak" links={[["/about", "About"], ["/account", "Account and API keys"], ["/legal/privacy", "Privacy"], ["/legal/terms", "Terms"]]} />
      </div>
      <div className="border-t border-[var(--color-rule)]">
        <div className="wrap flex flex-col gap-2 py-5 text-[14px] text-[var(--color-ink-3)] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 {SITE.founder}. Built by <a className="underline" href={SITE.founderUrl} target="_blank" rel="noreferrer">{SITE.founder}</a>.</p>
          <p>Version {SITE.version}. Results match the reference Python implementation.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h2 className="text-[14px] font-semibold text-[var(--color-ink)]">{title}</h2>
      <ul className="mt-3 grid gap-2 text-[15px]">
        {links.map(([href, label]) => (
          <li key={href}>
            {href.startsWith("http") ? (
              <a className="text-[var(--color-ink-2)] hover:text-[var(--color-ink)]" href={href} target="_blank" rel="noreferrer">{label}</a>
            ) : (
              <Link className="text-[var(--color-ink-2)] hover:text-[var(--color-ink)]" href={href}>{label}</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
