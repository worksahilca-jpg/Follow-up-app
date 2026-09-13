/**
 * Sentry — Node.js runtime (every API route, cron job, and server
 * component). Imported once from src/instrumentation.ts's register().
 *
 * Inert without SENTRY_DSN set — Sentry.init() with an undefined dsn is a
 * documented no-op (the SDK still installs its hooks but never actually
 * sends anything), so this is safe to ship even before a Sentry project
 * exists. See docs/error-monitoring-setup.md.
 */
import * as Sentry from "@sentry/nextjs";
import { beforeSend } from "@/lib/sentryScrub";
import { notifySlack } from "@/lib/slack";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  // Traces are for performance investigation, not the point of this
  // integration (that's error + auth-failure alerting) — kept low so a
  // free/small Sentry plan's event quota goes to errors, not spans.
  tracesSampleRate: 0.05,
  // Off everywhere Sentry is initialized: never attach IP address, user
  // email, or request cookies/headers by default. beforeSend below is
  // the backstop for what this app might still interpolate into a
  // message or breadcrumb on its own.
  sendDefaultPii: false,
  // Wraps sentryScrub's beforeSend (kept pure and shared with the edge/
  // client configs, unchanged) with a server-only side effect: echo the
  // already-scrubbed event to Slack. Server-only deliberately — this
  // file is never bundled into the client, so SLACK_WEBHOOK_URL never
  // ships to a browser the way importing this from sentryScrub.ts itself
  // (shared by client/edge/server) would risk. Fire-and-forget: a slow or
  // failing Slack call must never delay or drop the actual Sentry report.
  beforeSend(event) {
    const scrubbed = beforeSend(event);
    if (scrubbed) {
      const message = scrubbed.exception?.values?.[0]?.value ?? scrubbed.message ?? "Unknown error";
      void notifySlack(`🚨 *Server error* (${scrubbed.environment ?? "unknown env"}): ${message}`);
    }
    return scrubbed;
  },
});
