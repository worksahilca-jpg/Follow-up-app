/**
 * Guarantee: a workflow stops the instant the lead replies — nothing is
 * sent on top of a live conversation, and the owner is told.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    lead: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    notification: { create: vi.fn() },
  },
}));
vi.mock("@/lib/integrations/openai", () => ({ generateFollowUpMessage: vi.fn(async () => ({ subject: "Following up", body: "draft" })) }));
vi.mock("@/lib/sender", () => ({ composeFollowUpEmail: vi.fn(async (_f: string, _b: string, body: string) => body) }));
vi.mock("@/lib/sending", () => ({ sendFollowUpToLead: vi.fn(async () => ({ success: true })) }));
vi.mock("@/lib/billing", () => ({ requireActiveBilling: vi.fn(async () => true) }));
vi.mock("@/lib/voice", () => ({ getVoiceSamples: vi.fn(async () => []) }));

import { prisma } from "@/lib/db";
import { sendFollowUpToLead } from "@/lib/sending";
import { runSequencesForBusiness } from "@/lib/sequences";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const send = sendFollowUpToLead as unknown as ReturnType<typeof vi.fn>;

const step = { id: "s1", order: 0, delayDays: 0, action: "SEND_EMAIL", messageHint: null };
function enrolled(lastDirection: "inbound" | "outbound") {
  return {
    id: "lead1",
    name: "Young Son",
    businessId: "biz1",
    assignedToId: "user1",
    sequenceStepIndex: 0,
    sequence: { id: "seq1", name: "New lead cadence", active: true, steps: [step] },
    conversations: [
      {
        channel: "email",
        messages: [
          { id: "m1", direction: "outbound", body: "Hi", sentAt: new Date(Date.now() - 2 * 86400_000), opened: false },
          { id: "m2", direction: lastDirection, body: "Reply", sentAt: new Date(Date.now() - 60_000), opened: false },
        ],
      },
    ],
  };
}

beforeEach(() => {
  p.lead.update.mockResolvedValue({});
  p.lead.updateMany.mockResolvedValue({ count: 1 }); // claim succeeds by default
  p.notification.create.mockResolvedValue({});
});

describe("workflow stop-on-reply", () => {
  it("unenrolls the lead and notifies the owner when the last message is from the lead", async () => {
    p.lead.findMany.mockResolvedValue([enrolled("inbound")]);
    const r = await runSequencesForBusiness("biz1");
    expect(r.pausedForReply).toBe(1);
    expect(send).not.toHaveBeenCalled();
    expect(p.lead.update).toHaveBeenCalledWith({
      where: { id: "lead1" },
      data: { sequenceId: null, sequenceStepIndex: 0, sequenceStepDueAt: null },
    });
    expect(p.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "user1", leadId: "lead1" }) })
    );
  });

  it("does not stop when the last message was ours (no reply yet)", async () => {
    p.lead.findMany.mockResolvedValue([enrolled("outbound")]);
    const r = await runSequencesForBusiness("biz1");
    expect(r.pausedForReply).toBe(0);
  });

  it("never runs an inactive workflow", async () => {
    const l = enrolled("outbound");
    l.sequence.active = false;
    p.lead.findMany.mockResolvedValue([l]);
    const r = await runSequencesForBusiness("biz1");
    expect(send).not.toHaveBeenCalled();
    expect(r.checked).toBe(1);
  });
});

// task #84 (second-pass audit): a manual "run now" click racing the hourly
// cron, or two overlapping cron ticks, both see the same due lead from the
// plain SELECT above — only the run that wins the atomic claim may act.
describe("concurrent-run claim (task #84)", () => {
  function enrolledOnEmailStep() {
    const l = enrolled("outbound");
    l.sequence = { ...l.sequence, steps: [{ ...step, action: "EMAIL" }] };
    return l;
  }

  it("skips a lead another concurrent run already claimed, instead of sending its step twice", async () => {
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep()]);
    p.lead.updateMany.mockResolvedValueOnce({ count: 0 }); // lost the race
    const r = await runSequencesForBusiness("biz1");
    expect(send).not.toHaveBeenCalled();
    expect(r.advanced).toBe(0);
    expect(r.skipped).toEqual([]); // claimed-away is not a failure
  });

  it("still advances the step when this run wins the claim", async () => {
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep()]);
    p.lead.updateMany.mockResolvedValueOnce({ count: 1 }); // won the race
    const r = await runSequencesForBusiness("biz1");
    expect(send).toHaveBeenCalledTimes(1);
  });
});
