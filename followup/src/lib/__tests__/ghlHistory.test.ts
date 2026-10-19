/**
 * Wake up old customers on GoHighLevel (src/lib/ghlHistory.ts): old conversations brought in as history, a few a
 * day, never drafted or sent from here.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    lead: { update: vi.fn(async () => ({})) },
    message: { count: vi.fn(async () => 0), create: vi.fn(async () => ({})) },
    crmConnection: { findUnique: vi.fn(), findMany: vi.fn() },
    business: { findUnique: vi.fn(async () => ({ subscriptionStatus: "active" })) },
    automation: { findFirst: vi.fn(async () => null) },
    auditEvent: { findFirst: vi.fn(async () => null), count: vi.fn(async () => 0) },
  },
}));
vi.mock("@/lib/billing", () => ({ hasActiveAccess: vi.fn(() => true) }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn(async () => true) }));
vi.mock("@/lib/automation", () => ({ DEAD_LEAD_ACTION: "dead_lead_reactivation", DEAD_LEAD_DEFAULT_DAYS: 45 }));
vi.mock("@/lib/ghlPoll", () => ({ leadForContact: vi.fn() }));
vi.mock("@/lib/crm/ghlThreads", () => ({ findOrCreateGhlConversation: vi.fn(async (_l: string, _c: string, channel: string) => ({ id: `conv-${channel}` })) }));
vi.mock("@/lib/crm/gohighlevel", () => ({ ghlConversationMessages: vi.fn(), ghlConversationsBefore: vi.fn(), ghlDoNotDisturb: vi.fn(async () => false) }));

import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { leadForContact } from "@/lib/ghlPoll";
import { ghlConversationMessages, ghlConversationsBefore, ghlDoNotDisturb, type GhlMessage } from "@/lib/crm/gohighlevel";
import { GHL_HISTORY_SOURCE, WAKE_PER_DAY, optedOutIn, wakeConversation, wakeGhlHistoryForBusiness } from "@/lib/ghlHistory";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const mock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const KEY = "loc123ABC|pit-0000-1111-2222";
const NOW = Date.parse("2026-10-19T20:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const LEAD = { id: "lead1", optedOutAt: null, saidNoAt: null, stage: "NEW", automationTier: "ASSISTED" };
const msg = (over: Partial<GhlMessage> = {}): GhlMessage => ({
  id: "m1",
  conversationId: "gc1",
  contactId: "ct1",
  channel: "text",
  direction: "inbound",
  body: "Is the Elm St house still for sale?",
  at: new Date(NOW - 90 * DAY),
  ...over,
});
const THREAD = [msg(), msg({ id: "m2", direction: "outbound", body: "Yes, want to see it?", at: new Date(NOW - 89 * DAY) })];
const row = (days: number, id = `gc-${days}`) => ({ id, contactId: `ct-${days}`, lastMessageAt: new Date(NOW - days * DAY) });

beforeEach(() => {
  vi.clearAllMocks();
  p.crmConnection.findUnique.mockResolvedValue({ provider: "gohighlevel", apiKey: KEY });
  p.auditEvent.findFirst.mockResolvedValue(null);
  p.auditEvent.count.mockResolvedValue(0);
  p.automation.findFirst.mockResolvedValue(null);
  p.message.count.mockResolvedValue(0);
  mock(leadForContact).mockResolvedValue(LEAD);
  mock(ghlConversationMessages).mockResolvedValue(THREAD);
  mock(ghlDoNotDisturb).mockResolvedValue(false);
});

describe("one old conversation", () => {
  it("is stored as history, oldest first, and the customer dated by their last message", async () => {
    expect(await wakeConversation("biz1", KEY, row(89))).toBe("woken");
    const created = p.message.create.mock.calls.map((c: [{ data: { externalId: string; source: string } }]) => c[0].data);
    expect(created.map((d: { externalId: string }) => d.externalId)).toEqual(["m1", "m2"]);
    expect(created.every((d: { source: string }) => d.source === GHL_HISTORY_SOURCE)).toBe(true);
    expect(p.lead.update).toHaveBeenCalledWith({ where: { id: "lead1" }, data: { lastContacted: THREAD[1].at } });
    expect(recordAudit).toHaveBeenCalledWith({ businessId: "biz1", userId: null }, "ghl.history_woken", expect.objectContaining({ targetId: "lead1" }));
  });

  it("leaves alone a customer who said no, opted out, is closed, has FollowUp off, or is already talking here", async () => {
    for (const over of [{ saidNoAt: new Date() }, { optedOutAt: new Date() }, { stage: "WON" }, { stage: "LOST" }, { automationTier: "OFF" }]) {
      mock(leadForContact).mockResolvedValueOnce({ ...LEAD, ...over });
      expect(await wakeConversation("biz1", KEY, row(89))).toBe("skipped");
    }
    p.message.count.mockResolvedValueOnce(3);
    expect(await wakeConversation("biz1", KEY, row(89))).toBe("skipped");
    expect(p.message.create).not.toHaveBeenCalled();
  });

  it("leaves alone a conversation the customer never wrote in, and anyone Do Not Disturb", async () => {
    mock(ghlConversationMessages).mockResolvedValueOnce([msg({ direction: "outbound", body: "New listing on Elm!" })]);
    expect(await wakeConversation("biz1", KEY, row(89))).toBe("skipped");
    mock(ghlDoNotDisturb).mockResolvedValueOnce(true);
    expect(await wakeConversation("biz1", KEY, row(89))).toBe("skipped");
    expect(p.message.create).not.toHaveBeenCalled();
  });

  it("keeps a STOP: stored, marked opted out, not woken", async () => {
    const stopped = [...THREAD, msg({ id: "m3", body: "STOP", at: new Date(NOW - 88 * DAY) })];
    mock(ghlConversationMessages).mockResolvedValueOnce(stopped);
    expect(await wakeConversation("biz1", KEY, row(88))).toBe("opted_out");
    expect(p.lead.update).toHaveBeenCalledWith({ where: { id: "lead1" }, data: { lastContacted: stopped[2].at, optedOutAt: stopped[2].at } });
    expect(recordAudit).not.toHaveBeenCalledWith(expect.anything(), "ghl.history_woken", expect.anything());
  });

  it("reads STOP then START as back in", () => {
    expect(optedOutIn([msg({ body: "STOP" }), msg({ body: "START" })])).toBeNull();
    expect(optedOutIn([msg({ body: "STOP", channel: "instagram" })])).toBeNull();
    expect(optedOutIn([msg({ body: "stop" })])).toEqual(msg().at);
  });
});

describe("each run", () => {
  it("asks only for conversations quiet past the welcome-back wait", async () => {
    mock(ghlConversationsBefore).mockResolvedValue({ rows: [], full: false });
    await wakeGhlHistoryForBusiness("biz1", NOW);
    expect(ghlConversationsBefore).toHaveBeenCalledWith(KEY, new Date(NOW - 45 * DAY), 50);
    expect(recordAudit).toHaveBeenCalledWith({ businessId: "biz1", userId: null }, "ghl.history_done", expect.anything());
  });

  it("follows the owner's own wait, and does nothing when they turned the welcome back off", async () => {
    mock(ghlConversationsBefore).mockResolvedValue({ rows: [], full: false });
    p.automation.findFirst.mockResolvedValueOnce({ enabled: true, triggerDays: 90 });
    await wakeGhlHistoryForBusiness("biz1", NOW);
    expect(ghlConversationsBefore).toHaveBeenCalledWith(KEY, new Date(NOW - 90 * DAY), 50);
    mock(ghlConversationsBefore).mockClear();
    p.automation.findFirst.mockResolvedValueOnce({ enabled: false, triggerDays: 45 });
    expect(await wakeGhlHistoryForBusiness("biz1", NOW)).toEqual({ woken: 0, done: false });
    expect(ghlConversationsBefore).not.toHaveBeenCalled();
  });

  it(`brings back at most ${WAKE_PER_DAY} a day, and nothing once today's are in`, async () => {
    p.auditEvent.count.mockResolvedValueOnce(WAKE_PER_DAY - 2);
    mock(ghlConversationsBefore).mockResolvedValue({ rows: [row(50), row(51), row(52), row(53)], full: true });
    expect((await wakeGhlHistoryForBusiness("biz1", NOW)).woken).toBe(2);
    mock(ghlConversationsBefore).mockClear();
    p.auditEvent.count.mockResolvedValueOnce(WAKE_PER_DAY);
    expect(await wakeGhlHistoryForBusiness("biz1", NOW)).toEqual({ woken: 0, done: false });
    expect(ghlConversationsBefore).not.toHaveBeenCalled();
  });

  it("picks up where the last run stopped, and stops for good past six months", async () => {
    p.auditEvent.findFirst.mockImplementation(async ({ where }: { where: { action: string } }) =>
      where.action === "ghl.history_slice" ? { meta: { cursor: new Date(NOW - 120 * DAY).toISOString() } } : null
    );
    mock(ghlConversationsBefore).mockResolvedValue({ rows: [row(150), row(200)], full: true });
    const r = await wakeGhlHistoryForBusiness("biz1", NOW);
    expect(ghlConversationsBefore).toHaveBeenCalledWith(KEY, new Date(NOW - 120 * DAY), 50);
    expect(r).toEqual({ woken: 1, done: true });
    expect(recordAudit).toHaveBeenCalledWith({ businessId: "biz1", userId: null }, "ghl.history_slice", { meta: { cursor: new Date(NOW - 150 * DAY).toISOString(), woken: 1 } });
  });

  it("does nothing once finished, or without a GoHighLevel key", async () => {
    p.auditEvent.findFirst.mockResolvedValueOnce({ id: "done" });
    expect(await wakeGhlHistoryForBusiness("biz1", NOW)).toEqual({ woken: 0, done: true });
    p.crmConnection.findUnique.mockResolvedValueOnce({ provider: "hubspot", apiKey: "k" });
    expect(await wakeGhlHistoryForBusiness("biz1", NOW)).toEqual({ woken: 0, done: false });
    expect(ghlConversationsBefore).not.toHaveBeenCalled();
  });

  it("stops rather than asking forever when GoHighLevel doesn't page by date", async () => {
    mock(ghlConversationsBefore).mockResolvedValue({ rows: [], full: true });
    expect(await wakeGhlHistoryForBusiness("biz1", NOW)).toEqual({ woken: 0, done: true });
  });
});
