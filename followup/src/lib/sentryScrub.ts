import type { ErrorEvent } from "@sentry/core";

/**
 * Shared `beforeSend` for every Sentry entry point (server, edge, client —
 * see sentry.server.config.ts, sentry.edge.config.ts,
 * instrumentation-client.ts). This app's whole reason to exist is other
 * people's lead conversations — emails, phone numbers, message bodies —
 * and none of that belongs in a third-party error tracker. This is a
 * defense-in-depth backstop, not the only line of defense: `sendDefaultPii`
 * is off everywhere Sentry is initialized, and nothing in this codebase
 * intentionally attaches lead content to an exception's `extra`. What
 * this actually catches is the realistic leak path — a `console.error`
 * (auto-captured as a breadcrumb) that interpolated a real email or
 * phone number, or Sentry's own automatic request-context capture.
 */

// Exported: src/lib/deidentify.ts reuses these as its generic backstop
// layer, so the two PII scrubbers this app has can't quietly drift apart.
export const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// A loose "looks like a phone number" match: 7+ digits, optionally
// grouped with spaces/dashes/dots/parens and a leading +. Deliberately
// broad — a false-positive redaction (an order number, a zip+plus4) costs
// nothing here; a missed real phone number is the failure mode that matters.
export const PHONE_RE = /(\+?\d[\d\s().-]{6,}\d)/g;

export function scrubPii(text: string): string {
  return text.replace(EMAIL_RE, "[redacted-email]").replace(PHONE_RE, "[redacted-phone]");
}

function scrubIfString(value: unknown): unknown {
  return typeof value === "string" ? scrubPii(value) : value;
}

export function beforeSend(event: ErrorEvent): ErrorEvent | null {
  if (event.message) event.message = scrubPii(event.message);

  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = scrubPii(exception.value);
  }

  for (const crumb of event.breadcrumbs ?? []) {
    if (crumb.message) crumb.message = scrubPii(crumb.message);
    if (crumb.data) {
      for (const key of Object.keys(crumb.data)) {
        crumb.data[key] = scrubIfString(crumb.data[key]);
      }
    }
  }

  // Never send request bodies, query strings, or cookies — a webhook
  // payload or a form submission is exactly where real lead PII (or a
  // live secret, for the signed-webhook routes) would otherwise end up
  // verbatim in Sentry. Headers are kept but stripped to a short
  // allowlist; everything else (Authorization, Cookie, X-Twilio-Signature,
  // custom secrets) is dropped.
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.query_string;
    if (event.request.headers) {
      const allowed = new Set(["user-agent", "content-type", "accept-language"]);
      const kept: Record<string, string> = {};
      for (const [key, value] of Object.entries(event.request.headers)) {
        if (allowed.has(key.toLowerCase())) kept[key] = value;
      }
      event.request.headers = kept;
    }
  }

  // Defensive even though sendDefaultPii is off everywhere: never let a
  // user object (email, ip_address) reach Sentry.
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
    delete event.user.username;
  }

  return event;
}
