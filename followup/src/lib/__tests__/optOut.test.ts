/**
 * Keyword matching for the opt-out — now shared by all four channels that
 * honour it: SMS and WhatsApp (Lead.optedOutAt), Instagram and Messenger
 * DMs (the Suppression table). Moved out of @/lib/twilio into its own
 * zero-dependency module when it stopped being a Twilio concept; one
 * matcher is the point, so this file guards its behaviour for everyone.
 *
 * Tested against the real implementation, unmocked. Enforcement lives
 * elsewhere: sendingAudit.test.ts for sendFollowUpToLead's refusals, and
 * dmOptOut.test.ts for the DM inbound path end to end.
 */
import { describe, it, expect } from "vitest";
import { isOptInMessage, isOptOutMessage } from "@/lib/optOutKeywords";

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
