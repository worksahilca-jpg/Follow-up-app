/**
 * The follow-up strategy the founder approved on 2026-09-25, pinned one
 * behaviour at a time:
 *
 *   1. A new message is answered (auto-send accounts) or held on Today
 *      (the default, holding accounts) within five minutes, at any hour —
 *      the fresh-reply pass. Drafting and holding are never held back by
 *      the send window; only sending is.
 *   2. A quiet lead follows its plan (A-245, 2026-10-14, which replaced the
 *      four reminders of day 3, 7, 14, 30): Fast is day 1, 3, 7, 14, 30 from
 *      the message they went quiet on, Long adds a message a month, each
 *      with its own angle, and then nothing.
 *   3. Past the dead-lead threshold, one welcome back: no apology unless
 *      WE ignored THEM, and never a second one.
 *   4. Reminders only go out 8:00–20:00 local, stop the moment the
 *      customer writes, and a lead gets at most one automatic reminder a
 *      day (that last one is pinned in oneAutomatedMessagePerDay.test.ts).
 *
 * Grounding: research/product/2026-09-09-followup-cadence-best-practices.md
 * §2 and prioritized changes #1–#5, and research/product/2026-09-15-
 * reaching-back-out-to-ignored-leads.md (the recommendation, §1.2, §5, §7.1).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    automation: { findFirst: vi.fn() },
    lead: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    notification: { create: vi.fn() },
    business: { findUnique: vi.fn() },
    user: { findMany: vi.fn() },
    auditEvent: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/integrations/openai", () => ({
  generateFollowUpMessage: vi.fn(async () => ({ subject: "About the roof", body: "The roof question, answered." })),
  assessSendRisk: vi.fn(async () => ({ riskLevel: "low", reason: "" })),
}));
vi.mock("@/lib/sender", () => ({ latestInboundText: vi.fn(() => undefined), composeFollowUpEmail: vi.fn(async (_f: string, _b: string, body: string) => body) }));
vi.mock("@/lib/sending", () => ({
  sendFollowUpToLead: vi.fn(async () => ({ success: true })),
  detectAutomatedReplyChannel: vi.fn(async () => "email"),
}));
vi.mock("@/lib/sendChannels", () => ({ hasAnySendChannel: vi.fn(async () => true), canSendOn: vi.fn(async () => true) }));
vi.mock("@/lib/billing", () => ({ requireActiveBilling: vi.fn(async () => true), checkAiEligibility: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/voice", () => ({ getVoiceSamples: vi.fn(async () => []) }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/sendWindow", () => ({ isWithinSendWindow: vi.fn(() => true) }));

import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { generateFollowUpMessage, assessSendRisk } from "@/lib/integrations/openai";
import { sendFollowUpToLead, detectAutomatedReplyChannel } from "@/lib/sending";
import { isWithinSendWindow } from "@/lib/sendWindow";
import {
  runAutomationForBusiness,
  runFreshRepliesForAllBusinesses,
  deadLeadMessageHint,
  freshInboundToAnswer,
} from "@/lib/automation";
import { computeAutomationStatus, type BusinessAutomationRules } from "@/lib/automationStatus";
import type { Message } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const draft = generateFollowUpMessage as unknown as ReturnType<typeof vi.fn>;
const risk = assessSendRisk as unknown as ReturnType<typeof vi.fn>;
const send = sendFollowUpToLead as unknown as ReturnType<typeof vi.fn>;
const replyChannel = detectAutomatedReplyChannel as unknown as ReturnType<typeof vi.fn>;
const sendWindow = isWithinSendWindow as unknown as ReturnType<typeof vi.fn>;

const M = 60_000;
const H = 60 * M;
const D = 24 * H;
const ago = (ms: number) => new Date(Date.now() - ms);

type Row = { id: string; direction: "inbound" | "outbound"; body: string; sentAt: Date; opened: boolean; trigger: string | null; quickReplyPayload: string | null; source: string | null };
function row(direction: "inbound" | "outbound", msAgo: number, body = direction === "inbound" ? "Is the roof original?" : "It is, yes.", extra: Partial<Row> = {}): Row {
  return { id: `${direction}-${msAgo}`, direction, body, sentAt: ago(msAgo), opened: false, trigger: null, quickReplyPayload: null, source: null, ...extra };
}

function aLead(messages: Row[], overrides: Record<string, unknown> = {}, channel = "email") {
  const newest = messages.reduce<Date | null>((a, m) => (!a || m.sentAt > a ? m.sentAt : a), null);
  return {
    id: "q1",
    name: "Maya Patel",
    businessId: "biz1",
    assignedToId: "user1",
    email: "maya@example.com",
    phone: null,
    automationTier: "ASSISTED",
    createdAt: ago(200 * D),
    lastContacted: newest,
    lastAutomationCheckedAt: null,
    ackDueAt: null,
    suggestedMessage: null as string | null,
    suggestedSubject: null,
    suggestedDraftedFor: null as Date | null,
    suggestedDraftKind: null as string | null,
    suggestedQuickReplies: null,
    suggestedRiskLevel: null,
    suggestedRiskReason: null,
    conversations: [{ channel, messages }],
    ...overrides,
  };
}

function account(over: Record<string, unknown> = {}) {
  p.business.findUnique.mockResolvedValue({ timezone: "America/New_York", tier: "pro", holdAllForApproval: false, autonomousAllowed: false, autonomousAllowedAt: null, autoSendAllowedAt: null, ...over });
}

/** runAutomationForBusiness's lead queries fire in this order: silence, dead-lead, unanswered, then the DM handoff scan. */
function hourly(slots: { silence?: unknown[]; dead?: unknown[]; unanswered?: unknown[] }) {
  p.lead.findMany
    .mockResolvedValueOnce(slots.silence ?? [])
    .mockResolvedValueOnce(slots.dead ?? [])
    .mockResolvedValueOnce(slots.unanswered ?? [])
    .mockResolvedValue([]);
}

const hintGiven = () => draft.mock.calls[0]?.[2] as string | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  p.automation.findFirst.mockImplementation(async ({ where }: { where: { action: string } }) =>
    where.action === "auto_send" ? { enabled: true, triggerDays: 3 } : where.action === "unanswered_reply" ? { enabled: true, triggerHours: 24 } : null
  );
  p.lead.findMany.mockResolvedValue([]);
  p.lead.update.mockResolvedValue({});
  p.lead.updateMany.mockResolvedValue({ count: 1 });
  p.notification.create.mockResolvedValue({});
  p.user.findMany.mockResolvedValue([{ id: "admin1" }]);
  p.auditEvent.findMany.mockResolvedValue([]);
  account();
  risk.mockResolvedValue({ riskLevel: "low", reason: "" });
  draft.mockResolvedValue({ subject: "About the roof", body: "The roof question, answered." });
  send.mockResolvedValue({ success: true });
  replyChannel.mockResolvedValue("email");
  sendWindow.mockReturnValue(true);
});

/* ------------------------------------------------------------------ *
 * 2. Four reminders, each different, then stop.
 * ------------------------------------------------------------------ */

describe("the plans the engine runs (A-245)", () => {
  it("sends Fast's first message a day after the one they went quiet on, not before", async () => {
    hourly({ silence: [aLead([row("inbound", 1 * D), row("outbound", 12 * H)])] });
    expect((await runAutomationForBusiness("biz1")).checked).toBe(0);

    hourly({ silence: [aLead([row("inbound", 3 * D), row("outbound", 2 * D)])] });
    const r = await runAutomationForBusiness("biz1");
    expect(r.sent).toBe(1);
    expect(hintGiven()).toMatch(/follow-up 1 of 5/);
    expect(hintGiven()).toMatch(/answer anything left open/);
  });

  it("drafts the second message with its own angle for a lead that already got the first", async () => {
    hourly({ silence: [aLead([row("inbound", 20 * D), row("outbound", 12 * D), row("outbound", 11 * D)])] });
    const r = await runAutomationForBusiness("biz1");
    expect(r.sent).toBe(1);
    expect(hintGiven()).toMatch(/follow-up 2 of 5/);
    expect(hintGiven()).toMatch(/something new and useful/);
    expect(send).toHaveBeenCalledWith("q1", expect.any(String), expect.objectContaining({ trigger: "silence", extraAuditMeta: { reminderStep: 2 } }));
  });

  it("writes nothing for a lead whose plan has finished", async () => {
    hourly({
      silence: [aLead([row("inbound", 44 * D), row("outbound", 40 * D), row("outbound", 39 * D), row("outbound", 37 * D), row("outbound", 33 * D), row("outbound", 26 * D), row("outbound", 10 * D)])],
    });
    const r = await runAutomationForBusiness("biz1");
    expect(r.checked).toBe(0);
    expect(draft).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("keeps a Later customer going once a month after day 30, on Long", async () => {
    const later = { v: 2, template: "real_estate", items: [], tier: "later" };
    const messages = [row("inbound", 62 * D), row("outbound", 61 * D), ...[60, 58, 54, 47, 31].map((d) => row("outbound", d * D))];
    hourly({ silence: [aLead(messages, { qualification: later })] });
    const r = await runAutomationForBusiness("biz1");
    expect(r.sent).toBe(1);
    expect(hintGiven()).toMatch(/follow-up 6 of 10/);
  });

  it("uses the days the owner changed", async () => {
    account({ followUpPlans: { fast: [10, 20] } });
    hourly({ silence: [aLead([row("inbound", 8 * D), row("outbound", 6 * D)])] });
    expect((await runAutomationForBusiness("biz1")).checked).toBe(0);

    hourly({ silence: [aLead([row("inbound", 12 * D), row("outbound", 11 * D)])] });
    expect((await runAutomationForBusiness("biz1")).checked).toBe(1);
  });

  it("waits for the day the customer asked for, and stops once they book", async () => {
    hourly({ silence: [aLead([row("inbound", 3 * D), row("outbound", 2 * D)], { followUpNotBefore: new Date(Date.now() + 30 * D) })] });
    expect((await runAutomationForBusiness("biz1")).checked).toBe(0);

    hourly({ silence: [aLead([row("inbound", 3 * D), row("outbound", 2 * D)], { bookings: [{ createdAt: ago(1 * D), scheduledAt: ago(-2 * D) }] })] });
    expect((await runAutomationForBusiness("biz1")).checked).toBe(0);
  });

  it("never gives a lead in the owner's own workflow the default reminders as well", async () => {
    hourly({});
    await runAutomationForBusiness("biz1");
    const silenceQuery = p.lead.findMany.mock.calls[0][0];
    expect(silenceQuery.where.sequenceId).toBeNull();
  });

  it("rebuilds a cached draft that was written for a different message, and reuses the right one", async () => {
    const messages = [row("inbound", 20 * D), row("outbound", 12 * D), row("outbound", 9 * D)];
    const newest = messages[2].sentAt;
    hourly({ silence: [aLead(messages, { suggestedMessage: "Reminder one words.", suggestedDraftedFor: newest, suggestedDraftKind: "reminder_1" })] });
    await runAutomationForBusiness("biz1");
    expect(draft).toHaveBeenCalledTimes(1);

    draft.mockClear();
    hourly({ silence: [aLead(messages, { suggestedMessage: "Reminder two words.", suggestedDraftedFor: newest, suggestedDraftKind: "reminder_2", suggestedRiskLevel: "low" })] });
    await runAutomationForBusiness("biz1");
    expect(draft).not.toHaveBeenCalled();
    expect(send).toHaveBeenLastCalledWith("q1", "Reminder two words.", expect.anything());
  });
});

/* ------------------------------------------------------------------ *
 * 4. Reminders are time-gated; drafting and holding are not.
 * ------------------------------------------------------------------ */

describe("drafting and holding at any hour, sending in the window", () => {
  it("holds a reminder on a holding account at 3am instead of waiting for morning to draft it", async () => {
    account({ holdAllForApproval: true });
    sendWindow.mockReturnValue(false);
    hourly({ silence: [aLead([row("inbound", 10 * D), row("outbound", 5 * D)])] });
    const r = await runAutomationForBusiness("biz1");
    expect(r.held).toBe(1);
    expect(r.deferred).toBe(0);
  });

  it("defers a reminder that would SEND at night, until the window opens", async () => {
    sendWindow.mockReturnValue(false);
    hourly({ silence: [aLead([row("inbound", 10 * D), row("outbound", 5 * D)])] });
    const r = await runAutomationForBusiness("biz1");
    expect(r.deferred).toBe(1);
    expect(send).not.toHaveBeenCalled();
  });

  it("does not hold a late reply on WhatsApp for the morning — Meta's 24 hours decide that, not the clock", async () => {
    sendWindow.mockReturnValue(false);
    replyChannel.mockResolvedValue("whatsapp");
    hourly({ unanswered: [aLead([row("outbound", 40 * H), row("inbound", 25 * H)], { phone: "+15550001111", email: null }, "whatsapp")] });
    const r = await runAutomationForBusiness("biz1");
    expect(r.sent).toBe(1);
  });

  it("does hold a late reply by email for the morning", async () => {
    sendWindow.mockReturnValue(false);
    hourly({ unanswered: [aLead([row("outbound", 40 * H), row("inbound", 30 * H)])] });
    const r = await runAutomationForBusiness("biz1");
    expect(r.deferred).toBe(1);
  });

  it("never puts a drafted 'reply' to a STOP in front of the owner", async () => {
    hourly({ unanswered: [aLead([row("outbound", 40 * H), row("inbound", 30 * H, "STOP")], { phone: "+15550001111" }, "text")] });
    const r = await runAutomationForBusiness("biz1");
    expect(r.checked).toBe(0);
    expect(draft).not.toHaveBeenCalled();
  });

  it("sends nothing if the customer wrote while the reminder was being written, and hands the lead back", async () => {
    p.lead.updateMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => ({ count: where.conversations ? 0 : 1 }));
    hourly({ silence: [aLead([row("inbound", 10 * D), row("outbound", 5 * D)])] });
    const r = await runAutomationForBusiness("biz1");
    expect(send).not.toHaveBeenCalled();
    expect(r.skipped[0]).toMatch(/conversation moved/);
    expect(p.lead.updateMany).toHaveBeenLastCalledWith({ where: { id: "q1" }, data: { lastAutomationCheckedAt: null } });
  });
});

/* ------------------------------------------------------------------ *
 * 3. The welcome back.
 * ------------------------------------------------------------------ */

describe("the 45-day welcome back", () => {
  it("apologises only to someone WE ignored", () => {
    expect(deadLeadMessageHint(60, "lead")).toMatch(/sorry we never came back to you/);
    expect(deadLeadMessageHint(60, "business")).not.toMatch(/sorry we never came back/);
    expect(deadLeadMessageHint(60, "business")).toMatch(/Do not apologise/);
  });

  it("names the time and bans the empty check-in either way", () => {
    for (const who of ["lead", "business"] as const) {
      expect(deadLeadMessageHint(60, who)).toMatch(/about 60 days/);
      expect(deadLeadMessageHint(60, who)).toMatch(/Never fall back to a vague "just checking in"/);
    }
  });

  it("sends a lead who went quiet on US the welcome back without an apology, and records it as one", async () => {
    const messages = [row("inbound", 80 * D), row("outbound", 50 * D)];
    hourly({ dead: [aLead(messages, { lastContacted: ago(50 * D) })] });
    const r = await runAutomationForBusiness("biz1");
    expect(r.held).toBe(1); // a cold lead always waits for the owner
    expect(hintGiven()).toMatch(/Do not apologise/);
    expect(p.lead.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ suggestedDraftKind: "reactivation" }) }));
  });

  it("gives someone who wrote 45+ days ago and was never answered the belated answer, apology included", async () => {
    hourly({ unanswered: [aLead([row("inbound", 60 * D)], { lastContacted: ago(60 * D) })] });
    const r = await runAutomationForBusiness("biz1");
    expect(r.held).toBe(1);
    expect(hintGiven()).toMatch(/sorry we never came back to you/);
    expect(hintGiven()).toMatch(/actually answer what they asked/);
    expect(p.lead.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ suggestedDraftKind: "belated_reply" }) }));
  });

  it("does not reuse a reminder that sat unapproved as the welcome back", async () => {
    const messages = [row("inbound", 60 * D), row("outbound", 50 * D)];
    hourly({ dead: [aLead(messages, { lastContacted: ago(50 * D), suggestedMessage: "Reminder one.", suggestedDraftedFor: messages[1].sentAt, suggestedDraftKind: "reminder_1" })] });
    await runAutomationForBusiness("biz1");
    expect(draft).toHaveBeenCalledTimes(1);
  });

  it("sends one, not one every 45 days", async () => {
    hourly({ dead: [aLead([row("inbound", 200 * D), row("outbound", 190 * D), row("outbound", 60 * D)], { lastContacted: ago(60 * D) })] });
    const r = await runAutomationForBusiness("biz1");
    expect(r.checked).toBe(0);
    expect(draft).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ *
 * 1. A new message: ready within five minutes, any hour.
 * ------------------------------------------------------------------ */

describe("which new message the fresh pass answers", () => {
  const leadWith = (messages: Row[], channel = "email", over: Record<string, unknown> = {}) =>
    ({ suggestedDraftedFor: null, lastAutomationCheckedAt: null, conversations: [{ channel, messages }], ...over }) as Parameters<typeof freshInboundToAnswer>[0];

  it("answers an email after a minute when the draft is ready", () => {
    const m = row("inbound", 70_000);
    expect(freshInboundToAnswer(leadWith([m], "email", { suggestedDraftedFor: m.sentAt }), Date.now())).toEqual(m.sentAt);
  });

  it("gives the webhook its minute to finish first", () => {
    const m = row("inbound", 30_000);
    expect(freshInboundToAnswer(leadWith([m], "email", { suggestedDraftedFor: m.sentAt }), Date.now())).toBeNull();
  });

  it("keeps the two-minute DM grace period, so three quick DMs get one reply and the owner can answer first", () => {
    const early = row("inbound", 70_000);
    expect(freshInboundToAnswer(leadWith([early], "instagram", { suggestedDraftedFor: early.sentAt }), Date.now())).toBeNull();
    const later = row("inbound", 2.5 * M);
    expect(freshInboundToAnswer(leadWith([later], "instagram", { suggestedDraftedFor: later.sentAt }), Date.now())).toEqual(later.sentAt);
  });

  // Founder's Instagram test, 2026-10-11: "too slow". On a holding
  // account nothing goes out, so there is no head start to give the owner.
  it("on an account that holds every reply, puts a DM on Today as soon as its draft is written", () => {
    const m = row("inbound", 10_000);
    expect(freshInboundToAnswer(leadWith([m], "instagram", { suggestedDraftedFor: m.sentAt }), Date.now(), true)).toEqual(m.sentAt);
    expect(freshInboundToAnswer(leadWith([m], "instagram", { suggestedDraftedFor: m.sentAt }), Date.now(), false)).toBeNull();
    // No draft yet: the capture request still gets its minute.
    const early = row("inbound", 30_000);
    expect(freshInboundToAnswer(leadWith([early], "instagram"), Date.now(), true)).toBeNull();
  });

  // Founder, 2026-10-11: a Reel or sticker with no words is not a question.
  it("never treats a Reel with no words as something to answer, but still answers the question before it", () => {
    const answered = [row("inbound", 10 * M, "how much?"), row("outbound", 8 * M), row("inbound", 3 * M, "[Sent ig_reel with no message text]")];
    expect(freshInboundToAnswer(leadWith(answered, "instagram", { suggestedDraftedFor: new Date() }), Date.now())).toBeNull();
    const asked = row("inbound", 4 * M, "is this one still available?");
    const reel = row("inbound", 3 * M, "[Sent ig_reel with no message text]");
    expect(freshInboundToAnswer(leadWith([asked, reel], "instagram", { suggestedDraftedFor: new Date() }), Date.now())).toEqual(asked.sentAt);
  });

  it("waits for scoring's draft, but not past two minutes", () => {
    const m = row("inbound", 90_000);
    expect(freshInboundToAnswer(leadWith([m]), Date.now())).toBeNull();
    const m2 = row("inbound", 2.5 * M);
    expect(freshInboundToAnswer(leadWith([m2]), Date.now())).toEqual(m2.sentAt);
  });

  it("stands aside when the instant acknowledgement already answered that message", () => {
    const m = row("inbound", 3 * M);
    const ack = row("outbound", 2 * M, "Thanks, on it.", { trigger: "instant_ack" });
    expect(freshInboundToAnswer(leadWith([m, ack], "email", { suggestedDraftedFor: m.sentAt }), Date.now())).toBeNull();
  });

  it("never drafts a reply to STOP, to a voicemail, to something already answered or already handled, or to an hour-old message", () => {
    const stop = row("inbound", 3 * M, "STOP");
    expect(freshInboundToAnswer(leadWith([stop], "text", { suggestedDraftedFor: stop.sentAt }), Date.now())).toBeNull();
    const vm = row("inbound", 3 * M, "Call me back");
    expect(freshInboundToAnswer(leadWith([vm], "call", { suggestedDraftedFor: vm.sentAt }), Date.now())).toBeNull();
    const answered = [row("inbound", 5 * M), row("outbound", 1 * M)];
    expect(freshInboundToAnswer(leadWith(answered), Date.now())).toBeNull();
    const handled = row("inbound", 3 * M);
    expect(freshInboundToAnswer(leadWith([handled], "email", { suggestedDraftedFor: handled.sentAt, lastAutomationCheckedAt: ago(1 * M) }), Date.now())).toBeNull();
    const old = row("inbound", 61 * M);
    expect(freshInboundToAnswer(leadWith([old], "email", { suggestedDraftedFor: old.sentAt }), Date.now())).toBeNull();
  });
});

describe("the fresh pass", () => {
  /** A returning customer: we answered them yesterday, they wrote again three minutes ago. */
  function justWrote(over: Record<string, unknown> = {}, channel = "email") {
    const messages = [row("inbound", 30 * H, "First question"), row("outbound", 29 * H, "First answer"), row("inbound", 3 * M, "And do you do Saturdays?")];
    return aLead(messages, { suggestedMessage: "Yes, Saturdays too.", suggestedDraftedFor: messages[2].sentAt, ...over }, channel);
  }

  it("holds the reply on Today within minutes on a holding account — at 3am too — and says how long they have waited", async () => {
    account({ holdAllForApproval: true });
    sendWindow.mockReturnValue(false);
    p.lead.findMany.mockResolvedValueOnce([justWrote()]);
    const r = await runAutomationForBusiness("biz1", { freshLeadIds: ["q1"] });
    expect(r.held).toBe(1);
    expect(send).not.toHaveBeenCalled();
    expect(p.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ message: expect.stringMatching(/wrote 3 minutes ago and hasn't heard back — a reply is drafted/) }) })
    );
  });

  it("sends a low-risk reply at 3am on an account that sends without asking", async () => {
    sendWindow.mockReturnValue(false);
    p.lead.findMany.mockResolvedValueOnce([justWrote()]);
    const r = await runAutomationForBusiness("biz1", { freshLeadIds: ["q1"] });
    expect(r.sent).toBe(1);
    expect(send).toHaveBeenCalledWith("q1", "Yes, Saturdays too.", expect.objectContaining({ trigger: "unanswered", extraAuditMeta: { fresh: true } }));
  });

  it("still holds anything the risk check flags, exactly as Settings promises", async () => {
    risk.mockResolvedValue({ riskLevel: "medium", reason: "the reply talks about price" });
    p.lead.findMany.mockResolvedValueOnce([justWrote()]);
    const r = await runAutomationForBusiness("biz1", { freshLeadIds: ["q1"] });
    expect(r.held).toBe(1);
    expect(send).not.toHaveBeenCalled();
  });

  it("claims against the message, so a lead held this morning is still answerable this afternoon", async () => {
    const l = justWrote({ lastAutomationCheckedAt: ago(5 * H) });
    p.lead.findMany.mockResolvedValueOnce([l]);
    await runAutomationForBusiness("biz1", { freshLeadIds: ["q1"] });
    const claim = p.lead.updateMany.mock.calls[0][0];
    const inboundAt = l.conversations[0].messages[2].sentAt;
    expect(claim.where.OR).toEqual([{ lastAutomationCheckedAt: null }, { lastAutomationCheckedAt: { lt: inboundAt } }]);
  });

  it("does not hold a second time a first reply the instant acknowledgement already put on Today", async () => {
    const l = justWrote();
    p.lead.findMany.mockResolvedValueOnce([l]);
    p.auditEvent.findMany.mockResolvedValue([{ targetId: "q1", createdAt: ago(1 * M) }]);
    const r = await runAutomationForBusiness("biz1", { freshLeadIds: ["q1"] });
    expect(r.checked).toBe(0);
    expect(risk).not.toHaveBeenCalled();
  });

  it("does nothing where the owner switched off 'Reply for me when I haven't'", async () => {
    p.automation.findFirst.mockImplementation(async ({ where }: { where: { action: string } }) =>
      where.action === "auto_send" ? { enabled: true, triggerDays: 3 } : where.action === "unanswered_reply" ? { enabled: false, triggerHours: 24 } : null
    );
    const r = await runAutomationForBusiness("biz1", { freshLeadIds: ["q1"] });
    expect(r.checked).toBe(0);
    expect(p.lead.findMany).not.toHaveBeenCalled();
  });

  it("reads the newest messages first, so a busy hour cannot starve the latest one", async () => {
    // Daily-path sweep 2026-09-25 #7: oldest-first with a cap re-read the
    // same already-answered leads every minute once the window was full.
    p.lead.findMany.mockResolvedValue([]);
    await runFreshRepliesForAllBusinesses();
    expect(p.lead.findMany.mock.calls[0][0].orderBy).toEqual({ lastContacted: "desc" });
  });

  it("finds recent leads across every business and hands each business only its own", async () => {
    p.lead.findMany
      .mockResolvedValueOnce([
        { id: "a1", businessId: "bizA" },
        { id: "b1", businessId: "bizB" },
      ])
      .mockResolvedValue([]);
    await runFreshRepliesForAllBusinesses();
    const scans = p.lead.findMany.mock.calls.slice(1).map((c: [{ where: { businessId: string; id: { in: string[] } } }]) => c[0].where);
    expect(scans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ businessId: "bizA", id: { in: ["a1"] } }),
        expect.objectContaining({ businessId: "bizB", id: { in: ["b1"] } }),
      ])
    );
  });
});

/* ------------------------------------------------------------------ *
 * The badge agrees with all of it.
 * ------------------------------------------------------------------ */

describe("what the lead's badge says", () => {
  const RULES: BusinessAutomationRules = {
    canSend: true,
    holdAllForApproval: true,
    masterEnabled: true,
    followUpPlans: {},
    unansweredEnabled: true,
    unansweredHours: 24,
    deadLeadEnabled: true,
    deadLeadDays: 45,
  };
  const msg = (direction: "inbound" | "outbound", msAgo: number, extra: Partial<Message> = {}): Message => ({
    id: `${direction}${msAgo}`,
    direction,
    channel: "email",
    body: "x",
    date: ago(msAgo).toISOString(),
    ...extra,
  });
  const badgeLead = (conversation: Message[]) => ({
    stage: "contacted" as const,
    automationTier: "assisted" as const,
    lastContacted: conversation.reduce((a, m) => (m.date > a ? m.date : a), ago(365 * D).toISOString()),
    conversation,
    sequence: null,
    aiPausedReason: null,
  });

  it("says a reply is being written the moment they write, not in three hours", () => {
    expect(computeAutomationStatus(badgeLead([msg("outbound", 30 * H), msg("inbound", 2 * M)]), RULES)).toEqual({ kind: "due_soon", reason: "unanswered", heldForApproval: true });
  });

  it("says the plan's first message is due on day 1, and that nothing is coming once the plan has finished", () => {
    expect(computeAutomationStatus(badgeLead([msg("inbound", 3 * D), msg("outbound", 2 * D)]), RULES)).toEqual({
      kind: "due_soon",
      reason: "silence",
      heldForApproval: true,
    });
    // Before day 1 it reads as waiting on them, as it always has.
    expect(computeAutomationStatus(badgeLead([msg("inbound", 1 * D), msg("outbound", 12 * H)]), RULES)).toEqual({ kind: "sent" });
    const done = computeAutomationStatus(
      badgeLead([msg("inbound", 44 * D), msg("outbound", 40 * D), msg("outbound", 39 * D), msg("outbound", 37 * D), msg("outbound", 33 * D), msg("outbound", 26 * D), msg("outbound", 10 * D)]),
      RULES
    );
    expect(done).toEqual({ kind: "sent" });
  });
});

/* ------------------------------------------------------------------ *
 * "We talked" (design brain A-039, src/lib/talked.ts): the owner answered
 * them somewhere FollowUp can't see, so nothing automatic goes out until
 * they write again.
 * ------------------------------------------------------------------ */

describe("after the owner says 'We talked'", () => {
  it("sends no check-in to a quiet customer the owner has spoken to", async () => {
    hourly({ silence: [aLead([row("inbound", 20 * D), row("outbound", 12 * D), row("outbound", 9 * D)], { talkedAt: ago(1 * D) })] });
    const r = await runAutomationForBusiness("biz1");
    expect(r.sent).toBe(0);
    expect(draft).not.toHaveBeenCalled();
  });

  it("does not reply to a message the owner already answered in person", async () => {
    hourly({ unanswered: [aLead([row("outbound", 40 * H), row("inbound", 25 * H)], { talkedAt: ago(2 * H) })] });
    const r = await runAutomationForBusiness("biz1");
    expect(r.sent).toBe(0);
    expect(draft).not.toHaveBeenCalled();
  });

  it("answers them again as soon as they write after the talk", async () => {
    hourly({ unanswered: [aLead([row("outbound", 40 * H), row("inbound", 25 * H)], { talkedAt: ago(30 * H) })] });
    const r = await runAutomationForBusiness("biz1");
    expect(r.sent).toBe(1);
  });

  it("leaves a fresh message alone only when the talk came after it", () => {
    const m = row("inbound", 70_000);
    const base = { suggestedDraftedFor: m.sentAt, lastAutomationCheckedAt: null, conversations: [{ channel: "email", messages: [m] }] };
    expect(freshInboundToAnswer({ ...base, talkedAt: new Date() } as Parameters<typeof freshInboundToAnswer>[0], Date.now())).toBeNull();
    expect(freshInboundToAnswer({ ...base, talkedAt: ago(D) } as Parameters<typeof freshInboundToAnswer>[0], Date.now())).toEqual(m.sentAt);
  });
});

/* ------------------------------------------------------------------ *
 * "Don't send" (founder, 2026-09-30): the owner declined the reply
 * FollowUp held. Nothing automatic follows until the conversation moves:
 * they write again, or the owner writes to them.
 * ------------------------------------------------------------------ */

describe("after the owner says 'Don't send'", () => {
  it("does not hold the same check-in again the next day", async () => {
    hourly({ silence: [aLead([row("inbound", 20 * D), row("outbound", 12 * D), row("outbound", 9 * D)], { holdDismissedAt: ago(1 * D) })] });
    const r = await runAutomationForBusiness("biz1");
    expect(r.sent).toBe(0);
    expect(draft).not.toHaveBeenCalled();
  });

  it("does not hold a reply to the message the owner already declined", async () => {
    hourly({ unanswered: [aLead([row("outbound", 40 * H), row("inbound", 25 * H)], { holdDismissedAt: ago(2 * H) })] });
    const r = await runAutomationForBusiness("biz1");
    expect(r.sent).toBe(0);
    expect(draft).not.toHaveBeenCalled();
  });

  it("picks up again once the customer writes after it", async () => {
    hourly({ unanswered: [aLead([row("outbound", 40 * H), row("inbound", 25 * H)], { holdDismissedAt: ago(30 * H) })] });
    const r = await runAutomationForBusiness("biz1");
    expect(r.sent).toBe(1);
  });

  it("picks up again once the owner writes to them after it", async () => {
    hourly({ silence: [aLead([row("inbound", 20 * D), row("outbound", 12 * D), row("outbound", 9 * D)], { holdDismissedAt: ago(10 * D) })] });
    const r = await runAutomationForBusiness("biz1");
    expect(draft).toHaveBeenCalled();
    expect(r.sent + r.held).toBeGreaterThan(0);
  });

  it("leaves a fresh message alone only when the decline came after it", () => {
    const m = row("inbound", 70_000);
    const base = { suggestedDraftedFor: m.sentAt, lastAutomationCheckedAt: null, conversations: [{ channel: "email", messages: [m] }] };
    expect(freshInboundToAnswer({ ...base, holdDismissedAt: new Date() } as Parameters<typeof freshInboundToAnswer>[0], Date.now())).toBeNull();
    expect(freshInboundToAnswer({ ...base, holdDismissedAt: ago(D) } as Parameters<typeof freshInboundToAnswer>[0], Date.now())).toEqual(m.sentAt);
  });
});

/* ------------------------------------------------------------------ *
 * Leads found in the spam folder (founder, 2026-10-01): nothing goes out
 * on its own until the owner has written to them once.
 * ------------------------------------------------------------------ */

describe("a lead found in the spam folder", () => {
  it("is held for the owner, never sent automatically, with the reason", async () => {
    hourly({ unanswered: [aLead([row("inbound", 25 * H)], { source: "Gmail (spam)" })] });
    const r = await runAutomationForBusiness("biz1");
    expect(r.sent).toBe(0);
    expect(send).not.toHaveBeenCalled();
    expect(r.held).toBe(1);
    expect(JSON.stringify(vi.mocked(recordAudit).mock.calls)).toContain("spam folder");
  });

  it("holds a website form whose spam check was filled, saying it might be spam (2026-10-11)", async () => {
    hourly({ unanswered: [aLead([row("inbound", 25 * H)], { source: "Website form (spam check)" })] });
    const r = await runAutomationForBusiness("biz1");
    expect(r.sent).toBe(0);
    expect(send).not.toHaveBeenCalled();
    expect(r.held).toBe(1);
    expect(JSON.stringify(vi.mocked(recordAudit).mock.calls)).toContain("hidden spam check on your website form");
  });

  it("is followed up normally once the owner has written to them", async () => {
    hourly({ unanswered: [aLead([row("inbound", 40 * H), row("outbound", 39 * H), row("inbound", 25 * H)], { source: "Gmail (spam)" })] });
    const r = await runAutomationForBusiness("biz1");
    expect(r.sent).toBe(1);
  });
});
