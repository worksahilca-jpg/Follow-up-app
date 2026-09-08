/**
 * Guarantee: whatever this app accidentally lets leak toward Sentry —
 * a console.error that interpolated a real email or phone number, an
 * auto-captured request's cookies or body — gets scrubbed before it
 * would ever actually be sent.
 */
import { describe, it, expect } from "vitest";
import { scrubPii, beforeSend } from "@/lib/sentryScrub";
import type { ErrorEvent } from "@sentry/core";

describe("scrubPii", () => {
  it("redacts an email address", () => {
    expect(scrubPii("failed to email priya.sharma@example.com about the roof")).toBe(
      "failed to email [redacted-email] about the roof"
    );
  });

  it("redacts a phone number in a few common formats", () => {
    expect(scrubPii("called +1 (860) 935-8202 and it rang out")).toBe("called [redacted-phone] and it rang out");
    expect(scrubPii("sms to 5551234567 failed")).toBe("sms to [redacted-phone] failed");
  });

  it("leaves ordinary text untouched", () => {
    expect(scrubPii("Gmail sync failed for business biz_123: rate limited")).toBe(
      "Gmail sync failed for business biz_123: rate limited"
    );
  });
});

function fakeEvent(overrides: Partial<ErrorEvent> = {}): ErrorEvent {
  return { ...overrides } as ErrorEvent;
}

describe("beforeSend", () => {
  it("scrubs PII out of the top-level message and exception values", () => {
    const event = fakeEvent({
      message: "Failed for lead@example.com",
      exception: { values: [{ value: "Twilio send to +15551234567 failed" }] },
    });
    const result = beforeSend(event)!;
    expect(result.message).toBe("Failed for [redacted-email]");
    expect(result.exception!.values![0].value).toBe("Twilio send to [redacted-phone] failed");
  });

  it("scrubs breadcrumb messages and string breadcrumb data", () => {
    const event = fakeEvent({
      breadcrumbs: [{ message: "Acknowledged lead at owner@business.com", data: { note: "call +15551234567" } }],
    });
    const result = beforeSend(event)!;
    expect(result.breadcrumbs![0].message).toBe("Acknowledged lead at [redacted-email]");
    expect(result.breadcrumbs![0].data!.note).toBe("call [redacted-phone]");
  });

  it("strips request body, cookies, and query string entirely, and keeps only allowlisted headers", () => {
    const event = fakeEvent({
      request: {
        data: { email: "lead@example.com", message: "call me" },
        cookies: { session: "abc123" },
        query_string: "secret=shh",
        headers: { "user-agent": "curl/8.0", authorization: "Bearer secret-token", cookie: "session=abc123" },
      },
    });
    const result = beforeSend(event)!;
    expect(result.request!.data).toBeUndefined();
    expect(result.request!.cookies).toBeUndefined();
    expect(result.request!.query_string).toBeUndefined();
    expect(result.request!.headers).toEqual({ "user-agent": "curl/8.0" });
  });

  it("strips user email/ip/username even if something upstream set them", () => {
    const event = fakeEvent({ user: { email: "owner@business.com", ip_address: "1.2.3.4", username: "owner" } });
    const result = beforeSend(event)!;
    expect(result.user!.email).toBeUndefined();
    expect(result.user!.ip_address).toBeUndefined();
    expect(result.user!.username).toBeUndefined();
  });
});
