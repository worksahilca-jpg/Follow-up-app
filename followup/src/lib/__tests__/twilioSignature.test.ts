/**
 * Guarantee: an inbound "from Twilio" request is only trusted when its
 * signature verifies — including across the apex/www redirect.
 */
import { describe, it, expect, vi } from "vitest";
import { createHmac } from "crypto";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn() }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://followupbase.io" }));

import { validateTwilioSignature, validateTwilioRequestSignature } from "@/lib/twilio";

const TOKEN = "auth-token-123";
function sign(url: string, params: Record<string, string>) {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  return createHmac("sha1", TOKEN).update(data, "utf8").digest("base64");
}

describe("Twilio signature validation", () => {
  const params = { From: "+15551234567", Body: "hello" };

  it("accepts a correctly signed request", () => {
    const url = "https://followupbase.io/api/twilio/sms/secret1";
    expect(validateTwilioSignature(TOKEN, url, params, sign(url, params))).toBe(true);
  });

  it("rejects a missing, wrong-token, or tampered signature", () => {
    const url = "https://followupbase.io/api/twilio/sms/secret1";
    expect(validateTwilioSignature(TOKEN, url, params, null)).toBe(false);
    expect(validateTwilioSignature("other-token", url, params, sign(url, params))).toBe(false);
    expect(validateTwilioSignature(TOKEN, url, { ...params, Body: "changed" }, sign(url, params))).toBe(false);
  });

  it("accepts a signature computed for the www host when the request arrived on the apex (308 redirect)", () => {
    const signedUrl = "https://www.followupbase.io/api/twilio/sms/secret1";
    const request = new Request("https://followupbase.io/api/twilio/sms/secret1", { method: "POST" });
    expect(validateTwilioRequestSignature(TOKEN, request, params, sign(signedUrl, params))).toBe(true);
  });

  it("rejects a signature for a different path even on a known host", () => {
    const signedUrl = "https://followupbase.io/api/twilio/voice/secret1";
    const request = new Request("https://followupbase.io/api/twilio/sms/secret1", { method: "POST" });
    expect(validateTwilioRequestSignature(TOKEN, request, params, sign(signedUrl, params))).toBe(false);
  });
});
