/**
 * Guarantee: every auth-failure report is fingerprinted consistently
 * (so repeats group into one Sentry Issue an alert rule can count) and
 * never throws, even if Sentry itself does.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { captureMessage } = vi.hoisted(() => ({ captureMessage: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureMessage }));

import { recordAuthFailure } from "@/lib/monitoring";

beforeEach(() => {
  captureMessage.mockReset();
});

describe("recordAuthFailure", () => {
  it("reports with a stable fingerprint and the security_alert tag", () => {
    recordAuthFailure("twilio_signature", { path: "/api/twilio/sms/secret1" });
    expect(captureMessage).toHaveBeenCalledWith(
      "Auth failure: twilio_signature",
      expect.objectContaining({
        level: "warning",
        tags: { security_alert: "true", auth_failure_kind: "twilio_signature" },
        fingerprint: ["auth-failure", "twilio_signature"],
        extra: { path: "/api/twilio/sms/secret1" },
      })
    );
  });

  it("never includes a raw secret or credential — only what the caller explicitly passed as context", () => {
    recordAuthFailure("webhook_secret", { route: "webhooks/lead" });
    const [, options] = captureMessage.mock.calls[0];
    expect(JSON.stringify(options)).not.toMatch(/secret1|Bearer/);
  });

  it("swallows a Sentry-side failure instead of throwing", () => {
    captureMessage.mockImplementation(() => {
      throw new Error("Sentry down");
    });
    expect(() => recordAuthFailure("cron_secret", { route: "automation" })).not.toThrow();
  });
});
