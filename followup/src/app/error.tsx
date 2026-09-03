"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";

// Root app/error.tsx — the fallback for an unexpected runtime error
// anywhere in the app, instead of Next's generic unstyled error screen.
// `retry` (not the older `reset`) is the stabilized recovery prop as of
// this Next version — checked node_modules/next/dist/docs before writing,
// since training data would default to `reset`.
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <AlertTriangle className="h-9 w-9" style={{ color: "var(--coral)" }} />
      <h1 className="font-display text-3xl mt-5">Something went wrong</h1>
      <p className="mt-2 text-ink-soft max-w-sm">
        That&apos;s on us, not you. Try again — if it keeps happening, the dashboard is still there.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => retry()}
          className="inline-flex items-center gap-1.5 rounded-full px-5 py-3 text-sm font-medium transition-transform hover:scale-[1.03]"
          style={{ backgroundColor: "var(--rust)", color: "var(--on-accent)" }}
        >
          <RotateCw className="h-3.5 w-3.5" /> Try again
        </button>
        <Link href="/dashboard" className="rounded-full border border-line px-5 py-3 text-sm font-medium transition-colors hover:bg-card">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
