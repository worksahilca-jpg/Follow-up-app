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

// Every URL path in this app that carries a live credential as a path
// segment — a Twilio/generic-webhook/voice-agent secret, the one thing
// findBusinessByTwilioSecret()/findBusinessBySecret() et al. use to route
// an inbound webhook to the right tenant. Enumerated explicitly (not a
// generic "looks like a secret" heuristic, which would either miss a real
// one or over-redact a harmless resource id) because this is the exact
// finite set of routes shaped that way in this codebase. Both Sentry's
// own automatic request-context capture (event.contexts.nextjs.
// request_path) and this app's own recordAuthFailure() calls can put one
// of these paths in front of beforeSend unredacted unless caught here —
// see research/audit/2026-09-09-seventh-pass-audit.md findings #1 and #2.
const SECRET_PATH_RE = /\/api\/(twilio\/(sms|whatsapp|voice-agent-callback|voice-agent-auth|voice(?:\/transcription)?)|webhooks\/lead)\/[^/?\s]+/g;

function redactSecretPaths(text: string): string {
  return text.replace(SECRET_PATH_RE, (match) => match.replace(/\/[^/]+$/, "/[redacted]"));
}

// The other shape a live secret leaks through this path: a query
// parameter, not a path segment (GMAIL_PUSH_SECRET, passed as
// `?secret=...` on the Gmail push webhook). Only applied to fields known
// to actually be a request path/URL (event.contexts.nextjs.request_path)
// — unlike scrubIfString below, this isn't safe to run over arbitrary
// breadcrumb/extra strings, since truncating at the first "?" would
// corrupt any unrelated text that happens to contain one. The request
// body/query string are already dropped entirely from event.request for
// the same underlying reason (see below); this applies the same judgment
// to the one other field known to carry a full URL.
function stripQueryString(text: string): string {
  const i = text.indexOf("?");
  return i === -1 ? text : text.slice(0, i);
}

// The one full text-scrub pass — PII plus any live secret-bearing path —
// applied everywhere free-form text could end up: the top-level message,
// an exception's own message, breadcrumbs, and (below) extra/contexts.
function scrubText(text: string): string {
  return redactSecretPaths(scrubPii(text));
}

function scrubIfString(value: unknown): unknown {
  return typeof value === "string" ? scrubText(value) : value;
}

export function beforeSend(event: ErrorEvent): ErrorEvent | null {
  if (event.message) event.message = scrubText(event.message);

  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = scrubText(exception.value);
  }

  for (const crumb of event.breadcrumbs ?? []) {
    if (crumb.message) crumb.message = scrubText(crumb.message);
    if (crumb.data) {
      for (const key of Object.keys(crumb.data)) {
        crumb.data[key] = scrubIfString(crumb.data[key]);
      }
    }
  }

  // `extra` is the free-form bag recordAuthFailure() (src/lib/monitoring.ts)
  // and any other caller attaches ad hoc context to — the exact field a
  // live Twilio secret reached Sentry through unredacted before this fix
  // (research/audit/2026-09-09-seventh-pass-audit.md finding #1). Scrubbed
  // the same way breadcrumb data already is, as defense-in-depth alongside
  // fixing that call site to stop passing the raw secret path at all.
  if (event.extra) {
    for (const key of Object.keys(event.extra)) {
      event.extra[key] = scrubIfString(event.extra[key]);
    }
  }

  // Sentry's OWN automatic instrumentation, not application code calling
  // captureMessage/captureException — so there's no call site to fix here
  // the way finding #1's was. Next.js's `onRequestError` hook
  // (src/instrumentation.ts) reports `contexts.nextjs.request_path` as
  // the raw, un-normalized request URL (path + full query string) on ANY
  // uncaught exception in ANY route — including every [secret]-path
  // Twilio/webhook route and the query-string-authenticated Gmail push
  // webhook (research/audit/2026-09-09-seventh-pass-audit.md finding #2).
  // Targeted at this one known field specifically, the same way
  // event.request.query_string above is deleted outright rather than
  // pattern-matched — a blanket sweep over every string in `contexts`
  // risks mangling unrelated diagnostic text (Sentry also attaches
  // runtime/os/app/trace context here) that was never a URL to begin with.
  const nextjsContext = event.contexts?.nextjs as Record<string, unknown> | undefined;
  if (typeof nextjsContext?.request_path === "string") {
    nextjsContext.request_path = scrubText(stripQueryString(nextjsContext.request_path));
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
