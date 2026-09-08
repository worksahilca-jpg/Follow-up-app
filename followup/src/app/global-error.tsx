"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Catches an error in the ROOT layout itself — the one place app/error.tsx
 * can't reach (it wraps everything below the root layout, not the layout
 * or its own providers). Must render its own <html>/<body> and can't use
 * the app's shared styles/fonts (Next's own constraint — see
 * node_modules/next/dist/docs/.../error.md, checked before writing this
 * rather than assumed), so this stays deliberately plain.
 */
export default function GlobalError({
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

  return (
    <html>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fafafa", color: "#18181b" }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", textAlign: "center" }}>
          <h1 style={{ fontSize: "28px", margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ color: "#71717a", maxWidth: "360px", margin: "0 0 24px" }}>
            That&apos;s on us, not you. Reloading usually fixes it.
          </p>
          <button
            onClick={() => retry()}
            style={{ borderRadius: "999px", padding: "12px 20px", fontSize: "14px", fontWeight: 500, background: "#18181b", color: "#fafafa", border: "none", cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
