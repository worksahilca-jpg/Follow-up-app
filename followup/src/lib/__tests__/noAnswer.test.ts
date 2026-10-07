/**
 * "No answer" (A-103, the realtor team pilot). One tap records the call and
 * plans the next one; the first unanswered call of a run writes ONE short
 * message asking for a good time, which is held for a person to send
 * (founder, 2026-10-07: during the trial it always waits for an OK).
 * Nothing is ever sent from here, and nothing happens on a business that
 * hasn't turned calls on.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { recordAudit } = vi.hoisted(() => ({ recordAudit: vi.fn(async () => true) }));
vi.mock("@/lib/audit", () => ({ recordAudit }));
const { canSendOn } = vi.hoisted(() => ({ canSendOn: vi.fn<(businessId: string, channel: string) => Promise<boolean>>(async () => true) }));
vi.mock("@/lib/sendChannels", () => ({ canSendOn }));
const { heldSince } = vi.hoisted(() => ({ heldSince: vi.fn(async () => false) }));
vi.mock("@/lib/pendingApprovals", () => ({ heldSince }));
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    business: { findUnique: vi.fn() },
    lead: { findFirst: vi.fn(), update: vi.fn(async () => ({})) },
    user: { findUnique: vi.fn() },
    message: { findFirst: vi.fn(async () => null) },
    callAttempt: { create: vi.fn(async () => ({})), count: vi.fn(), findFirst: vi.fn<(args: { where: Record<string, unknown> }) => Promise<{ id: string; createdAt: Date } | null>>(async () => null), findMany: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { recordNoAnswer, undoNoAnswer } from "@/lib/calls";
import { NO_ANSWER_REASON } from "@/lib/holdReasons";

const NOW = new Date("2026-10-07T18:14:00Z");
const lead = { id: "lead1", name: "Priya Nair", phone: "(905) 555-0143", email: "priya@example.com", optedOutAt: null, talkedAt: null, suggestedDraftKind: null };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.business.findUnique.mockResolvedValue({ teamCalls: true, name: "Maple Realty" });
  prismaMock.lead.findFirst.mockResolvedValue(lead);
  prismaMock.user.findUnique.mockResolvedValue({ name: "Sam Patel" });
  prismaMock.callAttempt.count.mockResolvedValue(1);
  canSendOn.mockResolvedValue(true);
  heldSince.mockResolvedValue(false);
  recordAudit.mockResolvedValue(true);
});

const leadUpdates = () => prismaMock.lead.update.mock.calls.map((c) => (c as unknown as [{ data: Record<string, unknown> }])[0].data);
const actions = () => recordAudit.mock.calls.map((c) => (c as unknown as [unknown, string])[1]);

describe("the first No answer", () => {
  it("records the call by the person who tapped it, in their business", async () => {
    await recordNoAnswer("lead1", "biz1", "u1", NOW);
    expect(prismaMock.lead.findFirst.mock.calls[0][0].where).toEqual({ id: "lead1", businessId: "biz1" });
    expect(prismaMock.callAttempt.create).toHaveBeenCalledWith({ data: { businessId: "biz1", leadId: "lead1", userId: "u1", outcome: "no_answer", createdAt: NOW } });
  });

  it("plans the next call a day later", async () => {
    const r = await recordNoAnswer("lead1", "biz1", "u1", NOW);
    expect(r.success && r.nextCallAt).toBe("2026-10-08T18:14:00.000Z");
  });

  it("writes one text asking for a good time, and holds it for an OK", async () => {
    const r = await recordNoAnswer("lead1", "biz1", "u1", NOW);
    expect(r.success && r.drafted).toBe("text");
    const draft = leadUpdates().find((d) => "suggestedMessage" in d)!;
    expect(draft.suggestedMessage).toBe("Hi Priya, it's Sam from Maple Realty. I just tried to call you. When's a good time to talk?");
    expect(draft.suggestedDraftKind).toBe("no_answer_text");
    expect(draft.suggestedSubject).toBeNull();
    const hold = recordAudit.mock.calls.find((c) => (c as unknown as [unknown, string])[1] === "ai.hold") as unknown as [unknown, string, { meta: Record<string, unknown> }];
    expect(hold[2].meta).toEqual({ riskLevel: "owner", reason: NO_ANSWER_REASON, trigger: "no_answer" });
  });

  it("never sends anything itself", async () => {
    await recordNoAnswer("lead1", "biz1", "u1", NOW);
    expect(actions()).not.toContain("ai.send");
    expect(actions()).not.toContain("lead.send");
  });

  it("writes an email instead when no text number is connected", async () => {
    canSendOn.mockImplementation(async (_b: string, ch: string) => ch === "email");
    const r = await recordNoAnswer("lead1", "biz1", "u1", NOW);
    expect(r.success && r.drafted).toBe("email");
    const draft = leadUpdates().find((d) => "suggestedMessage" in d)!;
    expect(draft.suggestedDraftKind).toBe("no_answer_email");
    expect(draft.suggestedSubject).toBe("I tried to call you");
  });

  it("never texts someone who texted STOP", async () => {
    prismaMock.lead.findFirst.mockResolvedValue({ ...lead, optedOutAt: new Date("2026-10-01") });
    const r = await recordNoAnswer("lead1", "biz1", "u1", NOW);
    expect(r.success && r.drafted).toBe("email");
  });

  it("writes nothing when there's no way to reach them, and says why", async () => {
    canSendOn.mockResolvedValue(false);
    const r = await recordNoAnswer("lead1", "biz1", "u1", NOW);
    expect(r.success && r.drafted).toBeNull();
    expect(r.success && r.note).toMatch(/can't text Priya/);
    expect(actions()).not.toContain("ai.hold");
  });

  it("doesn't put a second message beside a reply already waiting for an OK", async () => {
    heldSince.mockResolvedValue(true);
    const r = await recordNoAnswer("lead1", "biz1", "u1", NOW);
    expect(r.success && r.drafted).toBeNull();
    expect(r.success && r.note).toMatch(/already waiting for your OK/);
    expect(leadUpdates().some((d) => "suggestedMessage" in d)).toBe(false);
  });
});

describe("later calls with no answer", () => {
  it("the second writes no new text", async () => {
    prismaMock.callAttempt.count.mockResolvedValue(2);
    const r = await recordNoAnswer("lead1", "biz1", "u1", NOW);
    expect(r.success && r.drafted).toBeNull();
    expect(r.success && r.nextCallAt).toBe("2026-10-08T18:14:00.000Z");
    expect(actions()).not.toContain("ai.hold");
  });

  it("the third stops planning calls", async () => {
    prismaMock.callAttempt.count.mockResolvedValue(3);
    const r = await recordNoAnswer("lead1", "biz1", "u1", NOW);
    expect(r.success && r.nextCallAt).toBeNull();
    expect(r.success && r.note).toMatch(/stops planning calls/);
  });
});

describe("who and where", () => {
  it("does nothing on a business that hasn't turned calls on", async () => {
    prismaMock.business.findUnique.mockResolvedValue({ teamCalls: false, name: "Maple Realty" });
    const r = await recordNoAnswer("lead1", "biz1", "u1", NOW);
    expect(r.success).toBe(false);
    expect(prismaMock.callAttempt.create).not.toHaveBeenCalled();
  });

  it("refuses a customer from another business", async () => {
    prismaMock.lead.findFirst.mockResolvedValue(null);
    const r = await recordNoAnswer("other", "biz1", "u1", NOW);
    expect(r).toEqual({ success: false, message: "Lead not found." });
    expect(prismaMock.callAttempt.create).not.toHaveBeenCalled();
  });
});

describe("Undo", () => {
  it("removes the call and the unsent text it wrote, and the plan goes with it", async () => {
    const at = new Date(NOW.getTime() - 60_000);
    prismaMock.lead.findFirst.mockResolvedValue({ id: "lead1", talkedAt: null, suggestedDraftKind: "no_answer_text", suggestedDraftedFor: at });
    prismaMock.callAttempt.findFirst.mockResolvedValueOnce({ id: "call1", createdAt: at });
    prismaMock.callAttempt.findMany.mockResolvedValue([]);
    heldSince.mockResolvedValue(true);
    const r = await undoNoAnswer("lead1", "biz1", "u1", NOW);
    expect(r.success).toBe(true);
    expect(prismaMock.callAttempt.delete).toHaveBeenCalledWith({ where: { id: "call1" } });
    expect(leadUpdates()).toContainEqual({ suggestedMessage: null, suggestedSubject: null, suggestedDraftKind: null, suggestedRiskLevel: null });
    expect(leadUpdates()).toContainEqual({ nextCallAt: null });
  });

  it("keeps a text that has already gone", async () => {
    const at = new Date(NOW.getTime() - 60_000);
    prismaMock.lead.findFirst.mockResolvedValue({ id: "lead1", talkedAt: null, suggestedDraftKind: "no_answer_text", suggestedDraftedFor: at });
    prismaMock.callAttempt.findFirst.mockResolvedValueOnce({ id: "call1", createdAt: at });
    prismaMock.callAttempt.findMany.mockResolvedValue([]);
    heldSince.mockResolvedValue(false);
    await undoNoAnswer("lead1", "biz1", "u1", NOW);
    expect(leadUpdates().some((d) => "suggestedMessage" in d)).toBe(false);
  });

  it("only reaches back two hours", async () => {
    prismaMock.lead.findFirst.mockResolvedValue({ id: "lead1", talkedAt: null, suggestedDraftKind: null, suggestedDraftedFor: null });
    const r = await undoNoAnswer("lead1", "biz1", "u1", NOW);
    expect(r.success).toBe(false);
    const where = prismaMock.callAttempt.findFirst.mock.calls[0][0].where as { createdAt: { gte: Date }; businessId: string };
    expect(where.createdAt.gte.toISOString()).toBe("2026-10-07T16:14:00.000Z");
    expect(where.businessId).toBe("biz1");
  });
});
