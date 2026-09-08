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
  beforeSend,
});
