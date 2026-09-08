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
export function recordAuthFailure(kind: AuthFailureKind, context: Record<string, string | undefined> = {}): void {
  try {
    Sentry.captureMessage(`Auth failure: ${kind}`, {
      level: "warning",
      tags: { security_alert: "true", auth_failure_kind: kind },
      fingerprint: ["auth-failure", kind],
      extra: context,
    });
  } catch (err) {
    console.error("Failed to report auth failure to Sentry:", err);
  }
}
