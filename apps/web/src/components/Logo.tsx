/** The AugLeak mark: a training tile and a test tile, joined by the link that should not exist. */
export function Mark({ className = "h-7 w-7", night = false }: { className?: string; night?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="2.5" y="6" width="11" height="20" rx="2.5" fill={night ? "#1b2d4b" : "#e2ecf7"} stroke="#2a62a4" strokeWidth="2" />
      <rect x="18.5" y="6" width="11" height="20" rx="2.5" fill={night ? "#2b2414" : "#f8edd8"} stroke="#b4730b" strokeWidth="2" />
      <path d="M8 16 H24" stroke="#df2459" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="8" cy="16" r="2.4" fill="#df2459" />
      <circle cx="24" cy="16" r="2.4" fill="#df2459" />
    </svg>
  );
}

export function Wordmark({ night = false }: { night?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Mark night={night} />
      <span className="display-wide text-[21px] leading-none">AugLeak</span>
    </span>
  );
}
