/**
 * Sentry — browser runtime. Next's own client-instrumentation convention
 * (stable since 15.3 — checked node_modules/next/dist/docs before writing;
 * this file needs no exported function, just top-level side-effecting
 * code, and runs after the HTML loads but before hydration).
 *
 * Uses NEXT_PUBLIC_SENTRY_DSN, not SENTRY_DSN — only NEXT_PUBLIC_-prefixed
 * env vars are ever inlined into the browser bundle; the two normally
 * hold the same DSN value (a Sentry DSN is meant to be public, it only
 * grants "submit events," never read access). Inert without it set, same
 * as the server/edge config.
 */
import * as Sentry from "@sentry/nextjs";
import { beforeSend } from "@/lib/sentryScrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.05,
  sendDefaultPii: false,
  beforeSend,
});

// Lets Sentry's performance monitoring see App Router navigations as
// their own spans, the same way it already sees page loads — the SDK's
// own build-time check otherwise warns this is missing.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
