/**
 * Keyword matching for the SMS/WhatsApp opt-out (see Lead.optedOutAt and
 * every send path's check against it in src/lib/sending.ts). Tested
 * against the real implementation, unmocked — the enforcement behavior
 * itself (sendFollowUpToLead refusing an opted-out lead, and the AI audit
 * trail) lives in sendingAudit.test.ts, where @/lib/twilio's network-
 * calling sendSms/sendWhatsApp need mocking but these pure functions
 * don't.
 */
import { describe, it, expect } from "vitest";
import { isOptInMessage, isOptOutMessage } from "@/lib/twilio";

describe("isOptOutMessage / isOptInMessage", () => {
  it("matches the standard STOP-family keywords, any case, trimmed", () => {
    for (const word of ["stop", "STOP", "  Stop  ", "StopAll", "unsubscribe", "cancel", "end", "quit"]) {
      expect(isOptOutMessage(word)).toBe(true);
    }
  });

  it("does not match STOP as a substring of a real sentence", () => {
    expect(isOptOutMessage("please stop texting me")).toBe(false);
    expect(isOptOutMessage("can you stop by the office?")).toBe(false);
  });

  it("matches START/UNSTOP for opt-in but not a bare YES", () => {
    expect(isOptInMessage("start")).toBe(true);
    expect(isOptInMessage("UNSTOP")).toBe(true);
    expect(isOptInMessage("yes")).toBe(false);
  });
});
