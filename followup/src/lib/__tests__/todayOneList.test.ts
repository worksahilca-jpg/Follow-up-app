/**
 * Round 1 of the 2026-10-05 check-up (A-087): Today is one list, and the reason a reply waits is said in
 * the owner's words.
 */
import { describe, it, expect } from "vitest";
import { oneQueue, WHOLE_QUEUE } from "@/lib/approvalGroups";
import type { PendingApproval } from "@/lib/pendingApprovals";
import {
  HOLD_ALL_AUTOMATION_REASON,
  HOLD_ALL_FIRST_REPLY_REASON,
  HOLD_ALL_SEQUENCE_REASON,
  BACKLOG_BEFORE_PERMISSION_REASON,
  UNGROUNDED_DRAFT_REASONS,
  UNTOUCHED_LEAD_REASON,
  plainHoldReason,
} from "@/lib/holdReasons";
import { PRICE_SLOT_REASON } from "@/lib/priceSlot";

let seq = 0;
function approval(over: Partial<PendingApproval> = {}): PendingApproval {
  seq += 1;
  return {
    leadId: `lead${seq}`,
    leadName: `Lead ${seq}`,
    source: "Gmail",
    score: 50,
    draftRiskLevel: "low",
    riskLevel: "low",
    reason: HOLD_ALL_AUTOMATION_REASON,
    trigger: "unanswered",
    heldAt: new Date("2026-10-05T01:00:00Z"),
    draftSubject: null,
    draftMessage: "Hi, which days suit you for a showing?",
    leadLastMessage: "Is it still available?",
    leadLastMessageChannel: "email",
    leadLastMessageAt: null,
    laterUntil: null,
    customerToldAt: null,
    ...over,
  };
}

describe("oneQueue", () => {
  it("puts every channel in one list, longest waiting first", () => {
    const at = (h: number) => new Date(Date.UTC(2026, 9, 5, 12 - h)).toISOString();
    const items = [
      approval({ leadName: "Gmail, 1h", source: "Gmail", reason: UNTOUCHED_LEAD_REASON, leadLastMessageAt: at(1) }),
      approval({ leadName: "Form, 5h", source: "Website form", reason: UNTOUCHED_LEAD_REASON, leadLastMessageAt: at(5) }),
      approval({ leadName: "CSV, 3h", source: "CSV import", reason: UNTOUCHED_LEAD_REASON, leadLastMessageAt: at(3) }),
    ];
    const groups = oneQueue(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].source).toBe(WHOLE_QUEUE);
    expect(groups[0].needsYou.map((a) => a.leadName)).toEqual(["Form, 5h", "CSV, 3h", "Gmail, 1h"]);
  });

  it("keeps the routine pile apart, across every channel", () => {
    const groups = oneQueue([
      approval({ source: "Gmail" }),
      approval({ source: "WhatsApp" }),
      approval({ source: "Gmail", draftRiskLevel: null }),
    ]);
    expect(groups[0].safeToSend).toHaveLength(2);
    expect(groups[0].needsYou).toHaveLength(1);
  });

  it("is empty when nothing waits", () => {
    expect(oneQueue([])).toEqual([]);
  });
});

describe("plainHoldReason", () => {
  const say = (reason: string, topic?: string | null) => plainHoldReason(reason, { firstName: "Ivy", topic });

  it("says nothing when the every-reply-waits setting is the only reason", () => {
    expect(say(HOLD_ALL_AUTOMATION_REASON)).toBeNull();
    expect(say(HOLD_ALL_SEQUENCE_REASON)).toBeNull();
    expect(say(HOLD_ALL_FIRST_REPLY_REASON)).toBeNull();
    expect(say("")).toBeNull();
  });

  it("says what to check, in short sentences", () => {
    expect(say(UNTOUCHED_LEAD_REASON)).toBe("You added Ivy yourself, so this is written from your notes only.");
    expect(say(UNGROUNDED_DRAFT_REASONS.availability)).toBe("Check: it says what's available. Only you know that.");
    expect(say(UNGROUNDED_DRAFT_REASONS.digits)).toBe("Check the number. Nobody wrote it in this conversation.");
    expect(say(PRICE_SLOT_REASON)).toBe("Add the price, then send.");
    expect(say(BACKLOG_BEFORE_PERMISSION_REASON)).toBe("This was waiting before you turned sending on.");
    expect(say("FollowUp is switched off for Ivy, so this reply only goes when you send it")).toBe(
      "FollowUp is off for Ivy, so this only goes when you send it."
    );
  });

  it("has a plain line for every reason that names something the draft invented", () => {
    for (const [rule, reason] of Object.entries(UNGROUNDED_DRAFT_REASONS)) {
      const line = say(reason);
      expect(line, rule).toMatch(/^[A-Z]/);
      expect(line, rule).not.toMatch(/held because|check it before it goes/i);
    }
  });

  it("turns the risk judge's essays into what kind of check it is", () => {
    expect(say("The draft includes a specific cost that was not confirmed in prior communications.", "price")).toBe("Check the price before it goes.");
    expect(say("the lead wants to move the showing", "date")).toBe("Check the day or time before it goes.");
    expect(say("the lead sounds frustrated", "tense")).toBe("Ivy sounds unhappy. Read it before it goes.");
    // Older holds carry no topic; the words decide.
    expect(
      say("The draft references previous communication and offers tailored information, which could imply commitments that need to be verified.")
    ).toBe("Read it before it goes: it promises something.");
    expect(say("The draft claims to have sent information that hasn't been confirmed as sent.")).toBe(
      "Check: it says you already sent something. This conversation doesn't show that."
    );
  });

  it("falls back to the reason's own words as a sentence", () => {
    expect(say("they asked to be called instead")).toBe("They asked to be called instead.");
  });
});
