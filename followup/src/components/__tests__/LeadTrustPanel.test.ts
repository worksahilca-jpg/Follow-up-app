/**
 * describeAckOutcome (src/components/LeadTrustPanel.tsx) — the one
 * sentence a business owner sees when the instant ack's audit event
 * shows up in the AI activity log. Task #63's live Spanish test showed
 * a generic acknowledgement with nothing on the page explaining why the
 * AI's specific reply didn't go out; this turns the decision merged
 * into the "ai.send" event (source/reason, see sendFollowUpToLead's
 * extraAuditMeta) into that explanation.
 */
import { describe, it, expect } from "vitest";
import { describeAckOutcome } from "@/components/LeadTrustPanel";

describe("describeAckOutcome", () => {
  it("says nothing when a specific reply went out — the expected case doesn't need explaining", () => {
    expect(describeAckOutcome({ trigger: "instant_ack", source: "generated", reason: "risk low" })).toBeUndefined();
  });

  it("says nothing for a non-instant_ack ai.send event, even with a source field somehow present", () => {
    expect(describeAckOutcome({ trigger: "silence", source: "fallback", reason: "risk low" })).toBeUndefined();
  });

  it("says nothing when there's no meta at all", () => {
    expect(describeAckOutcome(null)).toBeUndefined();
  });

  it("explains a risk-gated fallback in plain language, including the risk check's own reason", () => {
    expect(
      describeAckOutcome({
        trigger: "instant_ack",
        source: "fallback",
        reason: "risk medium: states availability the business never confirmed",
      })
    ).toBe("Held back the specific reply as not safe enough to send unreviewed — states availability the business never confirmed.");
  });

  it("explains a risk-gated fallback even with no explanation text from the risk check", () => {
    expect(describeAckOutcome({ trigger: "instant_ack", source: "fallback", reason: "risk high:" })).toBe(
      "Held back the specific reply as not safe enough to send unreviewed."
    );
  });

  it("explains a generation failure in plain language", () => {
    expect(describeAckOutcome({ trigger: "instant_ack", source: "fallback", reason: "generation failed" })).toBe(
      "Used the safe default reply — the specific one failed to generate."
    );
  });

  it("explains the no-inbound-text case in plain language", () => {
    expect(describeAckOutcome({ trigger: "instant_ack", source: "fallback", reason: "no inbound text" })).toBe(
      "Used the safe default reply — nothing specific to respond to yet."
    );
  });

  it("falls back to a generic line for a reason string it doesn't recognize, never a blank", () => {
    expect(describeAckOutcome({ trigger: "instant_ack", source: "fallback", reason: "something unexpected" })).toBe(
      "Used the safe default reply."
    );
  });
});
