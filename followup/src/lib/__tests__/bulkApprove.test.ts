/**
 * Releasing the routine half of the approval queue in one press.
 *
 * Founder, 2026-09-23: "we can follow up in one click only if they want
 * and they are safe to send… but we need to take care about the
 * restriction of sending mails and messages of each source."
 *
 * ## What is actually being guarded
 *
 * A button that sends 90 messages is easy. A button that sends 90
 * messages without getting the owner's mailbox suspended, without
 * breaking the rules of the channels it sends through, and without lying
 * about what it did, is the job. Three of those are pinned here.
 *
 * **The list is not the caller's to choose.** The screen posts a source
 * at most. Everything else is re-derived from the queue and re-checked,
 * because a list of lead ids posted from a page is a list of leads
 * somebody could edit.
 *
 * **Meta's window is not bypassed.** `sendFollowUpToLead` accepts a
 * `humanSend` option that lets an Instagram or Messenger reply go out
 * between 24 hours and 7 days, under Meta's allowance for a human agent
 * handling a conversation. It exists for the one screen where a person
 * has a whole message in front of them and taps Send. Nobody has read
 * these messages — that is the entire feature — so passing it here would
 * be a false claim made to the one party that can take the channel away.
 * The refusal that follows is not a bug to work around; it is the
 * per-source restriction the founder asked for, and those conversations
 * stay for him to answer personally.
 *
 * **A partial send says so.** Doing less than it appeared to, quietly, is
 * how a bulk action loses trust — the same rule the bulk automation
 * action already follows.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HOLD_ALL_AUTOMATION_REASON, UNGROUNDED_DRAFT_REASONS } from "@/lib/holdReasons";

const { pending, send, prismaMock } = vi.hoisted(() => ({
  pending: vi.fn(),
  send: vi.fn(),
  prismaMock: { lead: { findUnique: vi.fn() }, message: { findFirst: vi.fn() } },
}));
vi.mock("@/lib/pendingApprovals", () => ({ getPendingApprovals: pending }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/sending", () => ({ sendFollowUpToLead: send }));

import { sendSafeApprovals } from "@/lib/bulkApprove";

let seq = 0;
function approval(over: Record<string, unknown> = {}) {
  seq += 1;
  return {
    leadId: `lead${seq}`,
    leadName: `Lead ${seq}`,
    source: "Gmail",
    score: 50,
    draftRiskLevel: "low",
    riskLevel: "low",
    reason: HOLD_ALL_AUTOMATION_REASON,
    trigger: "silence",
    heldAt: new Date("2026-09-23T01:00:00Z"),
    draftSubject: null,
    draftMessage: "Just checking in.",
    leadLastMessage: null,
    leadLastMessageChannel: null,
    leadLastMessageAt: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  send.mockResolvedValue({ success: true });
  // By default each lead still holds the draft the queue showed, and nobody
  // has written since.
  prismaMock.lead.findUnique.mockImplementation(async () => ({
    suggestedMessage: currentDraft,
    suggestedDraftedFor: new Date("2026-09-23T00:30:00Z"),
  }));
  prismaMock.message.findFirst.mockResolvedValue(null);
});

let currentDraft = "Just checking in.";

describe("what gets sent", () => {
  it("sends the drafts that are safe", async () => {
    pending.mockResolvedValue([approval(), approval()]);
    const out = await sendSafeApprovals({ businessId: "biz1" });
    expect(out.sent).toBe(2);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("never sends a draft that needs a human, even when asked for everything", async () => {
    // The guard that matters. These are in the queue and would be in any
    // naive "send the queue" implementation.
    pending.mockResolvedValue([
      approval({ reason: UNGROUNDED_DRAFT_REASONS.currency }),
      approval({ draftRiskLevel: null }),
      approval({ draftRiskLevel: "high" }),
    ]);
    const out = await sendSafeApprovals({ businessId: "biz1" });
    expect(out.sent).toBe(0);
    expect(send, "a draft needing review was sent in bulk").not.toHaveBeenCalled();
  });

  it("re-derives the list from the queue rather than taking it from the caller", async () => {
    // sendSafeApprovals takes a businessId and an optional source — there
    // is no parameter through which a caller could name the leads. This
    // pins that, because adding one later would be the change that turns
    // an edited page into an arbitrary send.
    pending.mockResolvedValue([approval()]);
    await sendSafeApprovals({ businessId: "biz1" });
    expect(pending).toHaveBeenCalledWith("biz1");
  });

  it("narrows to one source when asked", async () => {
    pending.mockResolvedValue([
      approval({ source: "Gmail", leadId: "gmailLead" }),
      approval({ source: "WhatsApp", leadId: "whatsappLead" }),
    ]);
    const out = await sendSafeApprovals({ businessId: "biz1", source: "WhatsApp" });
    expect(out.sent).toBe(1);
    expect(send.mock.calls[0][0]).toBe("whatsappLead");
  });

  it("sends the owner's own draft, with its subject, unchanged", async () => {
    currentDraft = "Exact words.";
    pending.mockResolvedValue([approval({ draftMessage: "Exact words.", draftSubject: "Re: your quote" })]);
    await sendSafeApprovals({ businessId: "biz1" });
    expect(send.mock.calls[0][1]).toBe("Exact words.");
    expect(send.mock.calls[0][2]).toMatchObject({ subject: "Re: your quote", trigger: "manual" });
    currentDraft = "Just checking in.";
  });
});

describe("a draft that went out of date", () => {
  it("is not sent when the customer wrote after it was drafted", async () => {
    // Daily-path sweep 2026-09-25 #4: the pile was built from the draft as
    // it was; a message since means the draft answers an older conversation.
    prismaMock.message.findFirst.mockResolvedValueOnce({ id: "newer" });
    pending.mockResolvedValue([approval({ leadName: "Priya Shah" }), approval()]);
    const out = await sendSafeApprovals({ businessId: "biz1" });
    expect(out.sent).toBe(1);
    expect(out.skipped).toHaveLength(1);
    expect(out.skipped[0].reason).toMatch(/Priya wrote again/);
    expect(prismaMock.message.findFirst.mock.calls[0][0].where).toMatchObject({
      direction: "inbound",
      sentAt: { gt: new Date("2026-09-23T00:30:00Z") },
    });
  });

  it("is not sent when the draft was rewritten after the queue was built", async () => {
    prismaMock.lead.findUnique.mockResolvedValueOnce({ suggestedMessage: "A newer draft.", suggestedDraftedFor: null });
    pending.mockResolvedValue([approval({ leadName: "Omar" })]);
    const out = await sendSafeApprovals({ businessId: "biz1" });
    expect(out.sent).toBe(0);
    expect(send).not.toHaveBeenCalled();
    expect(out.skipped[0].reason).toMatch(/Omar's draft changed/);
  });

  it("falls back to the hold time for a draft with no drafted-for date", async () => {
    prismaMock.lead.findUnique.mockResolvedValueOnce({ suggestedMessage: "Just checking in.", suggestedDraftedFor: null });
    pending.mockResolvedValue([approval()]);
    await sendSafeApprovals({ businessId: "biz1" });
    expect(prismaMock.message.findFirst.mock.calls[0][0].where.sentAt).toEqual({ gt: new Date("2026-09-23T01:00:00Z") });
  });
});

describe("the channel rules this must not go around", () => {
  it("never claims a person read each message", async () => {
    // `humanSend` is what unlocks Meta's 24h–7day human-agent window.
    // Passing it here would tell Meta a human is handling each of these
    // conversations, which is false by construction.
    pending.mockResolvedValue([approval(), approval()]);
    await sendSafeApprovals({ businessId: "biz1" });
    for (const call of send.mock.calls) {
      expect(call[2].humanSend, "bulk send claimed the human-agent allowance").toBeUndefined();
    }
  });

  it("reports a refusal in the send path's own words, and keeps going", async () => {
    // A closed DM window is the common case, and the sentence the send
    // path writes for it tells the owner what they can do about it —
    // reply to that person themselves. Replacing it with "skipped" would
    // throw away the only actionable part.
    const windowClosed = "Meta's 24-hour window on Instagram has closed for Sarah — an automatic reply can't go out now.";
    send.mockResolvedValueOnce({ success: false, message: windowClosed }).mockResolvedValue({ success: true });
    pending.mockResolvedValue([approval({ leadName: "Sarah" }), approval(), approval()]);

    const out = await sendSafeApprovals({ businessId: "biz1" });

    expect(out.sent, "one refusal stopped the rest of the batch").toBe(2);
    expect(out.skipped).toHaveLength(1);
    expect(out.skipped[0]).toMatchObject({ leadName: "Sarah", reason: windowClosed });
  });

  it("still names a refusal that arrived without a sentence", async () => {
    send.mockResolvedValue({ success: false });
    pending.mockResolvedValue([approval({ leadName: "Devon" })]);
    const out = await sendSafeApprovals({ businessId: "biz1" });
    expect(out.skipped[0].leadName).toBe("Devon");
    expect(out.skipped[0].reason.length).toBeGreaterThan(0);
  });
});

describe("how much one press may do", () => {
  it("stops at the ceiling and says how many are left", async () => {
    // Quietly doing less than it appeared to is how a bulk action loses
    // trust — the same rule the bulk automation action follows.
    pending.mockResolvedValue(Array.from({ length: 10 }, () => approval()));
    const out = await sendSafeApprovals({ businessId: "biz1", limit: 4 });
    expect(out.sent).toBe(4);
    expect(out.remaining).toBe(6);
    expect(send).toHaveBeenCalledTimes(4);
  });

  it("spends a truncated press on the highest-scoring leads", async () => {
    // Which four get sent is not arbitrary when only four may go.
    pending.mockResolvedValue([
      approval({ leadId: "low", score: 10 }),
      approval({ leadId: "top", score: 95 }),
      approval({ leadId: "mid", score: 60 }),
    ]);
    await sendSafeApprovals({ businessId: "biz1", limit: 1 });
    expect(send).toHaveBeenCalledTimes(1);
    // The one that went is the top-scoring lead, not the first row back
    // from the database.
    expect(send.mock.calls[0][0]).toBe("top");
  });

  it("reports nothing remaining when the whole safe pile fits", async () => {
    pending.mockResolvedValue([approval(), approval()]);
    const out = await sendSafeApprovals({ businessId: "biz1", limit: 50 });
    expect(out.remaining).toBe(0);
  });

  it("sends nothing, and does not throw, on an empty queue", async () => {
    pending.mockResolvedValue([]);
    const out = await sendSafeApprovals({ businessId: "biz1" });
    expect(out).toEqual({ sent: 0, skipped: [], remaining: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it("treats a zero limit as send nothing, not as send everything", async () => {
    // An off-by-one that reads the ceiling as falsy would turn "hold on"
    // into "send the lot".
    pending.mockResolvedValue([approval(), approval()]);
    const out = await sendSafeApprovals({ businessId: "biz1", limit: 0 });
    expect(out.sent).toBe(0);
    expect(out.remaining).toBe(2);
    expect(send).not.toHaveBeenCalled();
  });
});
