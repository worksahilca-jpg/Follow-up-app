"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

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
    Sentry.captureException(error);
  }, [error]);

  // Calm, in the app's own type: no alarm icon, one black button, the way
  // back beside it (brand-principles: calm, never alarming).
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-center">
      <h1 className="max-w-[520px] text-[34px] leading-[1.12]">Something went wrong</h1>
      <p className="mt-3 max-w-[400px] text-[15.5px] leading-relaxed text-ink-soft">
        That&apos;s on us, not you. Try again — if it keeps happening, the dashboard is still there.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => retry()}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-full px-6 text-[15px] font-medium"
          style={{ backgroundColor: "var(--ink)", color: "var(--on-accent)" }}
        >
          <RotateCw className="h-4 w-4" /> Try again
        </button>
        <Link href="/dashboard" className="inline-flex min-h-[48px] items-center rounded-full border border-line bg-card px-6 text-[15px] font-medium hover:bg-card-2">
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
