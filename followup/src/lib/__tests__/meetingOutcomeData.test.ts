/**
 * "How did it go?" (A-263), what one tap does: Won or Lost through the same
 * door as the Details switch, nothing more for someone still deciding, one
 * held note with the booking link after a call that didn't happen, and an
 * Undo that puts it all back. Nothing is sent from here.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { recordAudit } = vi.hoisted(() => ({ recordAudit: vi.fn(async () => true) }));
vi.mock("@/lib/audit", () => ({ recordAudit }));
const { canSendOn } = vi.hoisted(() => ({ canSendOn: vi.fn<(businessId: string, channel: string) => Promise<boolean>>(async () => true) }));
vi.mock("@/lib/sendChannels", () => ({ canSendOn }));
const { heldSince } = vi.hoisted(() => ({ heldSince: vi.fn(async () => false) }));
vi.mock("@/lib/pendingApprovals", () => ({ heldSince }));
const { moveLeadStage } = vi.hoisted(() => ({ moveLeadStage: vi.fn(async (_b: string, _l: string, stage: string) => ({ stage })) }));
vi.mock("@/lib/leadStage", () => ({ moveLeadStage }));
vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://followupbase.io" }));
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    booking: { findFirst: vi.fn(), update: vi.fn(async () => ({})) },
    lead: { findFirst: vi.fn(), update: vi.fn<(args: { where: unknown; data: Record<string, unknown> }) => Promise<unknown>>(async () => ({})) },
    user: { findUnique: vi.fn(async () => ({ name: "Priya Sharma" })) },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { recordMeetingOutcome, undoMeetingOutcome } from "@/lib/meetingOutcomeData";
import { MEETING_MISSED_REASON } from "@/lib/holdReasons";

const NOW = new Date("2026-10-15T15:00:00Z");
const lead = { id: "lead1", name: "Raj Malhotra", stage: "QUALIFIED", email: "raj@example.com", phone: null, optedOutAt: null, suggestedDraftKind: null };
const booking = { id: "bk1", outcome: null, scheduledAt: new Date("2026-10-14T18:00:00Z") };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.booking.findFirst.mockResolvedValue(booking);
  prismaMock.lead.findFirst.mockResolvedValue(lead);
  heldSince.mockResolvedValue(false);
  canSendOn.mockResolvedValue(true);
});

describe("one tap", () => {
  it("Working with me: Won, through the same door as Details, and the answer kept with the stage before it", async () => {
    const out = await recordMeetingOutcome("lead1", "biz1", "u1", "bk1", "working", NOW);
    expect(out).toEqual({ success: true, note: null });
    expect(prismaMock.booking.update).toHaveBeenCalledWith({ where: { id: "bk1" }, data: { outcome: "working", outcomeAt: NOW, outcomeFromStage: "QUALIFIED" } });
    expect(moveLeadStage).toHaveBeenCalledWith("biz1", "lead1", "WON");
    expect(recordAudit).toHaveBeenCalledWith({ businessId: "biz1", userId: "u1" }, "lead.meeting.outcome", expect.objectContaining({ targetId: "lead1", meta: { bookingId: "bk1", outcome: "working" } }));
  });

  it("Not going ahead: Lost", async () => {
    await recordMeetingOutcome("lead1", "biz1", "u1", "bk1", "not_going", NOW);
    expect(moveLeadStage).toHaveBeenCalledWith("biz1", "lead1", "LOST");
  });

  it("Still deciding: the answer only; the plan reads it", async () => {
    await recordMeetingOutcome("lead1", "biz1", "u1", "bk1", "deciding", NOW);
    expect(moveLeadStage).not.toHaveBeenCalled();
    expect(prismaMock.lead.update).not.toHaveBeenCalled();
  });

  it("Didn't happen: one note with the booking link, held for the owner, never sent", async () => {
    const out = await recordMeetingOutcome("lead1", "biz1", "u1", "bk1", "didnt_happen", NOW);
    expect(out).toEqual({ success: true, note: "An email offering Raj a new time is waiting for your OK." });
    const write = prismaMock.lead.update.mock.calls[0][0];
    expect(write.data.suggestedMessage).toContain("https://followupbase.io/book/lead1");
    expect(write.data.suggestedMessage).toMatch(/^Priya here, Raj\./);
    expect(write.data.suggestedDraftKind).toBe("meeting_missed");
    expect(recordAudit).toHaveBeenCalledWith({ businessId: "biz1", userId: "u1" }, "ai.hold", expect.objectContaining({ targetId: "lead1", meta: { riskLevel: "owner", reason: MEETING_MISSED_REASON, trigger: "meeting_missed" } }));
  });

  it("writes no second note beside a reply already waiting, and none to someone who opted out", async () => {
    heldSince.mockResolvedValue(true);
    expect((await recordMeetingOutcome("lead1", "biz1", "u1", "bk1", "didnt_happen", NOW)) as { note: string }).toMatchObject({ note: "A reply to Raj is already waiting for your OK, so FollowUp didn't write another." });
    expect(prismaMock.lead.update).not.toHaveBeenCalled();
    heldSince.mockResolvedValue(false);
    prismaMock.lead.findFirst.mockResolvedValue({ ...lead, optedOutAt: NOW });
    expect((await recordMeetingOutcome("lead1", "biz1", "u1", "bk1", "didnt_happen", NOW)) as { note: string }).toMatchObject({ note: "Raj asked not to be written to, so FollowUp writes nothing." });
  });

  it("refuses a call of another business, and a second answer without Undo", async () => {
    prismaMock.booking.findFirst.mockResolvedValue(null);
    expect(await recordMeetingOutcome("lead1", "biz2", "u1", "bk1", "working", NOW)).toEqual({ success: false, message: "Lead not found." });
    prismaMock.booking.findFirst.mockResolvedValue({ ...booking, outcome: "working" });
    expect(await recordMeetingOutcome("lead1", "biz1", "u1", "bk1", "deciding", NOW)).toEqual({ success: false, message: "Already answered. Undo first to change it." });
  });
});

describe("Undo", () => {
  it("puts a Won back on the stage before it and clears the answer", async () => {
    prismaMock.booking.findFirst.mockResolvedValue({ id: "bk1", outcome: "working", outcomeAt: NOW, outcomeFromStage: "QUALIFIED" });
    prismaMock.lead.findFirst.mockResolvedValue({ id: "lead1", stage: "WON", suggestedDraftKind: null, suggestedDraftedFor: null });
    expect(await undoMeetingOutcome("lead1", "biz1", "u1", "bk1")).toEqual({ success: true });
    expect(moveLeadStage).toHaveBeenCalledWith("biz1", "lead1", "QUALIFIED");
    expect(prismaMock.booking.update).toHaveBeenCalledWith({ where: { id: "bk1" }, data: { outcome: null, outcomeAt: null, outcomeFromStage: null } });
  });

  it("withdraws the held note after a missed call, but never a note that already went", async () => {
    prismaMock.booking.findFirst.mockResolvedValue({ id: "bk1", outcome: "didnt_happen", outcomeAt: NOW, outcomeFromStage: "QUALIFIED" });
    prismaMock.lead.findFirst.mockResolvedValue({ id: "lead1", stage: "QUALIFIED", suggestedDraftKind: "meeting_missed", suggestedDraftedFor: NOW });
    heldSince.mockResolvedValue(true);
    await undoMeetingOutcome("lead1", "biz1", "u1", "bk1");
    expect(prismaMock.lead.update).toHaveBeenCalledWith({ where: { id: "lead1" }, data: { suggestedMessage: null, suggestedSubject: null, suggestedDraftKind: null, suggestedRiskLevel: null } });
    expect(recordAudit).toHaveBeenCalledWith({ businessId: "biz1", userId: "u1" }, "ai.hold_dismissed", expect.objectContaining({ targetId: "lead1" }));
    expect(moveLeadStage).not.toHaveBeenCalled();

    vi.clearAllMocks();
    prismaMock.booking.findFirst.mockResolvedValue({ id: "bk1", outcome: "didnt_happen", outcomeAt: NOW, outcomeFromStage: "QUALIFIED" });
    prismaMock.lead.findFirst.mockResolvedValue({ id: "lead1", stage: "QUALIFIED", suggestedDraftKind: "meeting_missed", suggestedDraftedFor: NOW });
    heldSince.mockResolvedValue(false);
    await undoMeetingOutcome("lead1", "biz1", "u1", "bk1");
    expect(prismaMock.lead.update).not.toHaveBeenCalled();
  });

  it("has nothing to undo on an unanswered call", async () => {
    prismaMock.booking.findFirst.mockResolvedValue({ id: "bk1", outcome: null, outcomeAt: null, outcomeFromStage: null });
    expect(await undoMeetingOutcome("lead1", "biz1", "u1", "bk1")).toEqual({ success: false, message: "There's nothing to undo." });
  });
});
