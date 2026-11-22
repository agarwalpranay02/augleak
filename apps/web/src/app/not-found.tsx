import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap py-28 text-center">
      <p className="display text-[120px] leading-none text-[var(--color-leak)]">404</p>
      <p className="mt-4 text-[19px]">No copy of this page in training or test.</p>
      <Link className="btn btn-primary mt-8" href="/">Go to AugLeak</Link>
    </div>
  );
}
