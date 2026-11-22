"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="wrap py-28 text-center">
      <p className="display text-[64px]">Something went wrong.</p>
      <p className="mt-4 text-[17px] text-[var(--color-ink-2)]">The page hit an error. Your images were not sent anywhere.</p>
      <button className="btn btn-primary mt-8" onClick={reset}>Try again</button>
    </div>
  );
}
