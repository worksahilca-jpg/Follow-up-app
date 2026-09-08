import type { Instrumentation } from "next";

/**
 * Next's server-instrumentation hook (stable since 15.0 — see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md,
 * checked before writing this rather than assumed). `register()` runs
 * once per server instance, before it serves any request; it loads
 * whichever Sentry config matches the runtime, since the Node and Edge
 * SDK builds aren't interchangeable.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  } else {
    await import("./sentry.server.config");
  }
}

/**
 * Forwards every server-side error Next itself catches (a Server
 * Component render, a Route Handler, a Server Action) to Sentry —
 * without this, only errors this codebase explicitly wraps in a
 * try/catch would ever reach Sentry.captureException, and an
 * unhandled one would just be a Next.js log line no one is watching.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { captureRequestError } = await import("@sentry/nextjs");
  captureRequestError(err, request, context);
};
