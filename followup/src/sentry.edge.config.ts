/**
 * Sentry — Edge runtime (middleware, and any route explicitly opted into
 * `export const runtime = "edge"` — none currently, but Next may still
 * load this file). Same settings as sentry.server.config.ts; kept as a
 * separate file because the edge runtime can't use every Node API the
 * Node SDK build relies on.
 */
import * as Sentry from "@sentry/nextjs";
import { beforeSend } from "@/lib/sentryScrub";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.05,
  sendDefaultPii: false,
  beforeSend,
});
