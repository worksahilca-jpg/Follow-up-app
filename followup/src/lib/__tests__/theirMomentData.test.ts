/**
 * "Their moment" (A-262), the hourly job: a note is written only for a
 * customer FollowUp may still write to, held for the owner and never sent;
 * a moment that may not be used passes quietly; a customer with something
 * already waiting keeps their moment for the next tick.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { lead } = vi.hoisted(() => ({ lead: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() } }));
vi.mock("@/lib/db", () => ({ prisma: { lead } }));
const { recordAudit } = vi.hoisted(() => ({ recordAudit: vi.fn(async () => true) }));
vi.mock("@/lib/audit", () => ({ recordAudit }));
const { tooManyRecentActions } = vi.hoisted(() => ({ tooManyRecentActions: vi.fn(async () => false) }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions }));
const { heldSince } = vi.hoisted(() => ({ heldSince: vi.fn<(businessId: string, leadId: string, since: Date) => Promise<boolean>>(async () => false) }));
vi.mock("@/lib/pendingApprovals", () => ({ heldSince }));
const { writeMomentNote } = vi.hoisted(() => ({ writeMomentNote: vi.fn() }));
vi.mock("@/lib/integrations/openai", () => ({ writeMomentNote }));
vi.mock("@/lib/scoring", () => ({ AI_RUNS_PER_LEAD_PER_DAY: { windowMinutes: 1440, max: 30 }, AI_RUNS_PER_BUSINESS_PER_DAY: { windowMinutes: 1440, max: 500 } }));

import { ownerSetsMoment, writeMomentNotesForAllBusinesses } from "@/lib/theirMomentData";

const D = 86_400_000;
const OCT13 = new Date(Date.UTC(2026, 9, 13, 23, 52));
const NOW = new Date(Date.UTC(2027, 0, 4, 14));

function due(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead1",
    businessId: "biz1",
    name: "Priya Nair",
    email: "priya@example.com",
    dmEmail: null,
    language: null,
    languageScript: null,
    languageRegister: null,
    stayInTouchAt: OCT13,
    optedOutAt: null,
    saidNoAt: null,
    momentAt: new Date(Date.UTC(2027, 0, 1, 12)),
    momentQuote: "Not yet, we'll talk to the bank in January.",
    momentSaidAt: OCT13,
    momentNoteAt: null,
    business: { id: "biz1", name: "Priya Sharma Realty", industry: "Real estate", timezone: "America/Toronto" },
    conversations: [
      {
        channel: "email",
        messages: [
          { id: "m1", direction: "inbound", body: "Hi, we're thinking of moving to Oakville next spring.", sentAt: new Date(OCT13.getTime() - D), trigger: null, quickReplyPayload: null },
          { id: "m2", direction: "inbound", body: "Not yet, we'll talk to the bank in January. Around 1.2M", sentAt: OCT13, trigger: null, quickReplyPayload: null },
        ],
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  heldSince.mockResolvedValue(false);
  tooManyRecentActions.mockResolvedValue(false);
  lead.update.mockResolvedValue({});
  lead.updateMany.mockResolvedValue({ count: 1 });
  writeMomentNote.mockResolvedValue({ why: "it's January, when Priya said she'd talk to the bank", note: "Hi Priya, you mentioned talking to the bank in January. Want me to send you the Oakville homes in your range the day they list?" });
});

describe("when the moment comes", () => {
  it("writes one note from their words and holds it for the owner, never sent", async () => {
    lead.findMany.mockResolvedValue([due()]);
    const result = await writeMomentNotesForAllBusinesses(NOW);
    expect(result).toEqual({ written: 1, waiting: 0, skipped: 0, failed: 0 });
    expect(writeMomentNote.mock.calls[0][0]).toMatchObject({ firstName: "Priya", quote: "Not yet, we'll talk to the bank in January.", saidWhen: "in October 2026", month: "January", dm: false });
    const write = lead.update.mock.calls[0][0];
    expect(write.where).toEqual({ id: "lead1" });
    expect(write.data.suggestedDraftKind).toBe("their_moment");
    expect(write.data.suggestedMessage).toMatch(/stop these notes/);
    expect(write.data.momentNoteAt).toEqual(NOW);
    expect(recordAudit).toHaveBeenCalledWith(
      { businessId: "biz1", userId: null },
      "ai.hold",
      expect.objectContaining({ targetId: "lead1", meta: expect.objectContaining({ trigger: "their_moment", riskLevel: "owner", quote: "Not yet, we'll talk to the bank in January.", reason: expect.stringMatching(/^Why now: /) }) })
    );
    expect(lead.findMany.mock.calls[0][0].where).toMatchObject({ momentAt: { lte: NOW }, momentNoteAt: null, optedOutAt: null });
  });

  it("lets a moment pass, and says so, when they didn't say yes and their enquiry is old", async () => {
    lead.findMany.mockResolvedValue([
      due({ stayInTouchAt: null, conversations: [{ channel: "email", messages: [{ id: "m1", direction: "inbound", body: "…", sentAt: new Date(NOW.getTime() - 200 * D), trigger: null, quickReplyPayload: null }] }] }),
    ]);
    const result = await writeMomentNotesForAllBusinesses(NOW);
    expect(result).toEqual({ written: 0, waiting: 0, skipped: 1, failed: 0 });
    expect(writeMomentNote).not.toHaveBeenCalled();
    expect(lead.update).toHaveBeenCalledWith({ where: { id: "lead1" }, data: { momentNoteAt: NOW } });
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), "lead.moment.passed", expect.objectContaining({ meta: { reason: "no_consent" } }));
  });

  it("keeps the moment for the next tick while something already waits for the owner", async () => {
    lead.findMany.mockResolvedValue([due()]);
    heldSince.mockResolvedValue(true);
    const result = await writeMomentNotesForAllBusinesses(NOW);
    expect(result).toEqual({ written: 0, waiting: 1, skipped: 0, failed: 0 });
    expect(writeMomentNote).not.toHaveBeenCalled();
    expect(lead.update).not.toHaveBeenCalled();
  });

  it("a failed note is tried again, never marked done", async () => {
    lead.findMany.mockResolvedValue([due()]);
    writeMomentNote.mockRejectedValue(new Error("down"));
    const result = await writeMomentNotesForAllBusinesses(NOW);
    expect(result).toEqual({ written: 0, waiting: 0, skipped: 0, failed: 1 });
    expect(lead.update).not.toHaveBeenCalled();
  });
});

describe("the owner changes the moment", () => {
  it("another day keeps their words and lets a note be written again", async () => {
    const at = new Date(Date.UTC(2027, 1, 1, 12));
    expect(await ownerSetsMoment("biz1", "lead1", "u1", at)).toBe(true);
    expect(lead.updateMany).toHaveBeenCalledWith({ where: { id: "lead1", businessId: "biz1" }, data: { momentAt: at, momentNoteAt: null } });
  });

  it("none clears everything", async () => {
    await ownerSetsMoment("biz1", "lead1", "u1", null);
    expect(lead.updateMany.mock.calls[0][0].data).toEqual({ momentAt: null, momentQuote: null, momentSaidAt: null, momentNoteAt: null });
  });
});
