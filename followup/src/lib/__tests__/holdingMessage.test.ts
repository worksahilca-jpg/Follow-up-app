/**
 * The "we got you" message (src/lib/holdingMessage.ts, founder 2026-09-26).
 *
 * Trust guarantees, each pinned here: it goes only on an account that sends
 * by itself, only for a price or date the owner hasn't answered in 30
 * minutes, never for a tense conversation, never twice, never after
 * anything else already went to the customer, and it says only the fixed
 * line — never a number, a day or a time.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    automation: { findMany: vi.fn() },
    lead: { findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    message: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/billing", () => ({ requireActiveBilling: vi.fn(async () => true) }));
vi.mock("@/lib/pendingApprovals", () => ({ getPendingApprovals: vi.fn() }));
vi.mock("@/lib/sending", () => ({
  sendFollowUpToLead: vi.fn(async () => ({ success: true })),
  detectAutomatedReplyChannel: vi.fn(async () => "instagram"),
}));
vi.mock("@/lib/integrations/openai", () => ({ localizeFixedText: vi.fn(async (t: string) => t) }));
vi.mock("@/lib/sender", () => ({ composeFollowUpEmail: vi.fn(async (_n: string, _b: string, body: string) => `Hi,\n\n${body}\n\nSahil`) }));

import { prisma } from "@/lib/db";
import { getPendingApprovals } from "@/lib/pendingApprovals";
import { sendFollowUpToLead, detectAutomatedReplyChannel } from "@/lib/sending";
import { requireActiveBilling } from "@/lib/billing";
import { runHoldingMessagesForBusiness, HOLDING_LINES, HOLDING_DELAY_MS } from "@/lib/holdingMessage";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const send = sendFollowUpToLead as unknown as ReturnType<typeof vi.fn>;
const pending = getPendingApprovals as unknown as ReturnType<typeof vi.fn>;

const NOW = new Date("2026-09-27T12:00:00Z");
const minsAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

function lead(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead1",
    name: "Sarah Johnson",
    email: null,
    phone: "ig:123",
    suggestedRiskTopic: "price",
    holdingSentFor: null,
    language: null,
    languageScript: null,
    languageRegister: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  p.business.findUnique.mockResolvedValue({ holdAllForApproval: false, sendingPausedAt: null, autoSendAllowedAt: minsAgo(24 * 60 * 3) });
  p.automation.findMany.mockResolvedValue([
    { action: "auto_send", enabled: true },
    { action: "unanswered_reply", enabled: true },
  ]);
  p.lead.findMany.mockResolvedValue([lead()]);
  p.lead.findUnique.mockResolvedValue({ businessId: "biz1" });
  p.lead.updateMany.mockResolvedValue({ count: 1 });
  p.message.findFirst.mockResolvedValue({ direction: "inbound", sentAt: minsAgo(40), body: "What does the 3-month package cost?" });
  pending.mockResolvedValue([{ leadId: "lead1" }]);
  send.mockResolvedValue({ success: true });
});

describe("the holding message goes out", () => {
  it("once, for a held price question the owner hasn't answered in 30 minutes", async () => {
    const r = await runHoldingMessagesForBusiness("biz1", NOW);
    expect(r.sent).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    const [leadId, body, options] = send.mock.calls[0];
    expect(leadId).toBe("lead1");
    expect(body).toBe(HOLDING_LINES.price);
    expect(options).toMatchObject({ automated: true, trigger: "holding", channel: "instagram" });
  });

  it("claims the customer's message before sending, so two ticks cannot both send", async () => {
    await runHoldingMessagesForBusiness("biz1", NOW);
    const claim = p.lead.updateMany.mock.calls[0][0];
    expect(claim.data).toEqual({ holdingSentFor: minsAgo(40) });
    expect(claim.where.OR).toEqual([{ holdingSentFor: null }, { holdingSentFor: { lt: minsAgo(40) } }]);
  });

  it("uses the date line for a date question", async () => {
    p.lead.findMany.mockResolvedValue([lead({ suggestedRiskTopic: "date" })]);
    await runHoldingMessagesForBusiness("biz1", NOW);
    expect(send.mock.calls[0][1]).toBe(HOLDING_LINES.date);
  });

  it("wraps the line as an email reply on email", async () => {
    (detectAutomatedReplyChannel as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce("email");
    await runHoldingMessagesForBusiness("biz1", NOW);
    expect(send.mock.calls[0][1]).toContain(HOLDING_LINES.price);
    expect(send.mock.calls[0][2].channel).toBe("email");
  });
});

describe("the fixed lines promise nothing", () => {
  it("contain no number, weekday or clock time", () => {
    for (const line of Object.values(HOLDING_LINES)) {
      expect(line).not.toMatch(/\d/);
      expect(line).not.toMatch(/monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|tonight|this week/i);
    }
  });
});

describe("the holding message does NOT go out", () => {
  it("on an account that holds everything for approval (Assisted)", async () => {
    p.business.findUnique.mockResolvedValue({ holdAllForApproval: true, sendingPausedAt: null, autoSendAllowedAt: null });
    expect((await runHoldingMessagesForBusiness("biz1", NOW)).sent).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("while sending is paused", async () => {
    p.business.findUnique.mockResolvedValue({ holdAllForApproval: false, sendingPausedAt: minsAgo(5), autoSendAllowedAt: minsAgo(9999) });
    await runHoldingMessagesForBusiness("biz1", NOW);
    expect(send).not.toHaveBeenCalled();
  });

  // Settings' "turn off every automated follow-up" says nothing goes out on
  // its own afterwards. A price draft held minutes before the switch was
  // still sent "let me check" 30 minutes later.
  it("once the owner has turned automatic follow-up off", async () => {
    p.automation.findMany.mockResolvedValue([
      { action: "auto_send", enabled: false },
      { action: "unanswered_reply", enabled: true },
    ]);
    await runHoldingMessagesForBusiness("biz1", NOW);
    expect(send).not.toHaveBeenCalled();
    expect(p.lead.updateMany).not.toHaveBeenCalled();
  });

  it("once the owner has turned \"Reply for me when I haven't\" off", async () => {
    p.automation.findMany.mockResolvedValue([
      { action: "auto_send", enabled: true },
      { action: "unanswered_reply", enabled: false },
    ]);
    await runHoldingMessagesForBusiness("biz1", NOW);
    expect(send).not.toHaveBeenCalled();
  });

  it("when the account has no automatic follow-up rule at all (the same default as the automation)", async () => {
    p.automation.findMany.mockResolvedValue([]);
    await runHoldingMessagesForBusiness("biz1", NOW);
    expect(send).not.toHaveBeenCalled();
  });

  it("without active billing", async () => {
    (requireActiveBilling as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    await runHoldingMessagesForBusiness("biz1", NOW);
    expect(send).not.toHaveBeenCalled();
  });

  it("for a tense conversation, or any topic that isn't price or date", async () => {
    for (const topic of ["tense", "other", "none", null]) {
      p.lead.findMany.mockResolvedValue([lead({ suggestedRiskTopic: topic })]);
      await runHoldingMessagesForBusiness("biz1", NOW);
    }
    expect(send).not.toHaveBeenCalled();
    // And the query itself only ever asks for price and date.
    expect(p.lead.findMany.mock.calls[0][0].where.suggestedRiskTopic).toEqual({ in: ["price", "date"] });
  });

  it("before the owner has had 30 minutes", async () => {
    p.message.findFirst.mockResolvedValue({ direction: "inbound", sentAt: new Date(NOW.getTime() - HOLDING_DELAY_MS + 60_000), body: "How much?" });
    await runHoldingMessagesForBusiness("biz1", NOW);
    expect(send).not.toHaveBeenCalled();
  });

  it("when anything was already sent after the customer's message (the instant ack included)", async () => {
    p.message.findFirst.mockResolvedValue({ direction: "outbound", sentAt: minsAgo(38), body: "Got your message" });
    await runHoldingMessagesForBusiness("biz1", NOW);
    expect(send).not.toHaveBeenCalled();
  });

  it("twice for the same customer message", async () => {
    p.lead.findMany.mockResolvedValue([lead({ holdingSentFor: minsAgo(40) })]);
    await runHoldingMessagesForBusiness("biz1", NOW);
    expect(send).not.toHaveBeenCalled();
  });

  it("when another tick won the claim", async () => {
    p.lead.updateMany.mockResolvedValue({ count: 0 });
    await runHoldingMessagesForBusiness("biz1", NOW);
    expect(send).not.toHaveBeenCalled();
  });

  it("when the draft is no longer waiting for the owner", async () => {
    pending.mockResolvedValue([]);
    await runHoldingMessagesForBusiness("biz1", NOW);
    expect(send).not.toHaveBeenCalled();
  });

  it("to a message from before sending was turned on", async () => {
    p.business.findUnique.mockResolvedValue({ holdAllForApproval: false, sendingPausedAt: null, autoSendAllowedAt: minsAgo(35) });
    await runHoldingMessagesForBusiness("biz1", NOW);
    expect(send).not.toHaveBeenCalled();
  });

  it("to a message more than 20 hours old", async () => {
    p.message.findFirst.mockResolvedValue({ direction: "inbound", sentAt: minsAgo(21 * 60), body: "How much?" });
    await runHoldingMessagesForBusiness("biz1", NOW);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("a failed send", () => {
  it("hands the claim back so a later tick can try again", async () => {
    send.mockResolvedValue({ success: false, message: "Instagram window closed" });
    const r = await runHoldingMessagesForBusiness("biz1", NOW);
    expect(r.sent).toBe(0);
    expect(p.lead.updateMany).toHaveBeenCalledTimes(2);
    expect(p.lead.updateMany.mock.calls[1][0].data).toEqual({ holdingSentFor: null });
  });

  it("keeps the claim when the send can never succeed, so it isn't retried", async () => {
    // Opted out, no inbox, a refused channel: each retry would only spend
    // another paid translation call (founder, 2026-09-27).
    send.mockResolvedValue({ success: false, message: "They opted out.", failure: "refused" });
    await runHoldingMessagesForBusiness("biz1", NOW);
    expect(p.lead.updateMany).toHaveBeenCalledTimes(1);
    send.mockClear();
    p.lead.updateMany.mockClear();
    send.mockResolvedValue({ success: false, message: "Invalid number", failure: "permanent" });
    await runHoldingMessagesForBusiness("biz1", NOW);
    expect(p.lead.updateMany).toHaveBeenCalledTimes(1);
  });

  it("keeps the claim when the send was parked for a retry", async () => {
    send.mockResolvedValue({ success: false, message: "blip", queuedRetryAt: new Date() });
    await runHoldingMessagesForBusiness("biz1", NOW);
    expect(p.lead.updateMany).toHaveBeenCalledTimes(1);
  });

  // A database blip after the claim (the channel lookup, the lead read in
  // the funnel) used to throw out of the whole business's loop: the claim
  // stayed stamped on this customer's message, so they never got their
  // "let me check", and every customer after them in the list was skipped.
  it("releases the claim and carries on with the next customer when one throws", async () => {
    p.lead.findMany.mockResolvedValue([lead(), lead({ id: "lead2", name: "Priya Shah" })]);
    pending.mockResolvedValue([{ leadId: "lead1" }, { leadId: "lead2" }]);
    send.mockRejectedValueOnce(new Error("Timed out fetching a new connection from the connection pool"));

    const r = await runHoldingMessagesForBusiness("biz1", NOW);

    expect(r.sent).toBe(1);
    expect(send.mock.calls.map((c) => c[0])).toEqual(["lead1", "lead2"]);
    const release = p.lead.updateMany.mock.calls.find((c: [{ where: { id: string }; data: unknown }]) => c[0].where.id === "lead1" && c[0].data && (c[0].data as { holdingSentFor: unknown }).holdingSentFor === null);
    expect(release).toBeDefined();
    expect(r.skipped.some((s) => s.startsWith("Sarah Johnson"))).toBe(true);
  });
});
