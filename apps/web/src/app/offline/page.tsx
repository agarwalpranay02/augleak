import Link from "next/link";

export const metadata = { title: "Offline", robots: { index: false } };

export default function Offline() {
  return (
    <div className="wrap py-24 text-center">
      <p className="display text-[72px]">You&apos;re offline.</p>
      <p className="mx-auto mt-4 max-w-md text-[17px] text-[var(--color-ink-2)]">The audit works offline once the page has loaded: it never needed the network. Pages you haven&apos;t opened yet need a connection.</p>
      <Link href="/audit" className="btn btn-leak mt-8">Open the audit</Link>
    </div>
  );
}
