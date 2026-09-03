import Link from "next/link";
import { Compass, ArrowRight } from "lucide-react";

// Root app/not-found.tsx handles any unmatched URL app-wide (not just a
// notFound() call within a route) — without this, a typo'd link or an old
// bookmark hits Next's generic unstyled 404 instead of the real product.
export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <Compass className="h-9 w-9" style={{ color: "var(--rust)" }} />
      <h1 className="font-display text-3xl mt-5">Can&apos;t find that page</h1>
      <p className="mt-2 text-ink-soft max-w-sm">
        The link might be old, or the address was typo&apos;d. Nothing&apos;s wrong on our end.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 mt-7 rounded-full px-5 py-3 text-sm font-medium transition-transform hover:scale-[1.03]"
        style={{
          backgroundColor: "var(--rust)",
          color: "var(--on-accent)",
          boxShadow: "0 12px 28px -10px color-mix(in srgb, var(--rust) 55%, transparent)",
        }}
      >
        Back to FollowUp <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
