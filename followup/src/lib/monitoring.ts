import * as Sentry from "@sentry/nextjs";

export type AuthFailureKind =
  | "twilio_signature"
  | "voice_agent_callback"
  | "webhook_secret"
  | "gmail_push_secret"
  | "cron_secret"
  | "meta_webhook_verify";

/**
 * Reports one authentication/signature check failing — a forged Twilio
 * signature, a wrong webhook secret, a bad cron bearer token — as a
 * distinctly fingerprinted Sentry event. Never the credential that was
 * tried, only which check failed and coarse, non-identifying context
 * (a business id, a route name — never a raw secret, token, or lead
 * detail).
 *
 * Deliberately doesn't keep its own count-and-threshold logic: every
 * failure of the same kind reports with the same fingerprint, so Sentry's
 * own issue grouping already tracks "how many times has this happened,
 * how recently" — that's what a Sentry Alert Rule (see
 * docs/error-monitoring-setup.md) fires on: "this issue occurred N times
 * in M minutes," a fair working definition of a spike. Reinventing that
 * counting here would just be a second, worse copy of a job Sentry
 * already does well.
 *
 * Inert without SENTRY_DSN configured, same as the rest of the Sentry
 * wiring — captureMessage() on an uninitialized/DSN-less client is a
 * documented no-op, never a throw, so this is always safe to call.
 */
/**
 * One report per kind per window, with the suppressed ones counted.
 *
 * 2026-09-19, the founder: "a server error message popping up every
 * minute in the Slack alert". The two Meta webhook URLs are public and
 * named in Meta's console, so they take ordinary internet background
 * traffic — scanners, crawlers, a stale retry — and EVERY one of those
 * used to post its own red siren. An alert channel that cries wolf is
 * worse than no alert channel: the real one arrives and nobody looks.
 *
 * Deliberately a floor under the noise, not a counter to rely on.
 * Serverless means this map lives per warm instance, so a burst spread
 * across instances still reports more than once — which is the right
 * failure direction for a security signal (under-report never, slightly
 * over-report sometimes). Sentry's own grouping still does the real
 * counting; this only stops the same fingerprint being *posted* every
 * few seconds.
 */
const ALERT_WINDOW_MS = 10 * 60_000;
const lastReported = new Map<AuthFailureKind, { at: number; suppressed: number }>();

function throttle(kind: AuthFailureKind): { report: boolean; suppressed: number } {
  const now = Date.now();
  const prev = lastReported.get(kind);
  if (prev && now - prev.at < ALERT_WINDOW_MS) {
    prev.suppressed += 1;
    return { report: false, suppressed: prev.suppressed };
  }
  const suppressed = prev?.suppressed ?? 0;
  lastReported.set(kind, { at: now, suppressed: 0 });
  return { report: true, suppressed };
}

export function recordAuthFailure(kind: AuthFailureKind, context: Record<string, string | undefined> = {}): void {
  const { report, suppressed } = throttle(kind);
  if (!report) return;
  try {
    Sentry.captureMessage(`Auth failure: ${kind}`, {
      level: "warning",
      tags: { security_alert: "true", auth_failure_kind: kind },
      fingerprint: ["auth-failure", kind],
      // The count of the ones this instance swallowed since it last
      // reported, so throttling never hides a spike — it just stops the
      // spike arriving one message at a time.
      extra: suppressed > 0 ? { ...context, suppressedSinceLastReport: String(suppressed) } : context,
    });
  } catch (err) {
    console.error("Failed to report auth failure to Sentry:", err);
  }
}
