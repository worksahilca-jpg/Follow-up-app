/**
 * At most one automatic message FollowUp starts on its own, per lead, per
 * calendar day in the business's time zone (founder's follow-up strategy,
 * 2026-09-25) — enforced in sendFollowUpToLead, the one funnel every
 * automated path goes through, so no path added later can forget it.
 *
 * Counted across every automated send; applied only to the unprompted kinds
 * (a quiet-lead reminder, a welcome back). A reply to something the
 * customer wrote is never refused by it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    lead: { findUnique: vi.fn(), update: vi.fn() },
    business: { findUnique: vi.fn() },
    conversation: { findFirst: vi.fn(), create: vi.fn() },
    sendClaim: { create: vi.fn(), updateMany: vi.fn(async () => ({ count: 0 })), deleteMany: vi.fn() },
    message: { create: vi.fn(), findFirst: vi.fn(), count: vi.fn(async () => 1) },
    followUp: { create: vi.fn(), findFirst: vi.fn() },
    outboundSend: { findFirst: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/integrations/gmail", () => ({
  getGmailStatus: vi.fn(async () => ({ connected: true })),
  getGmailReplyHeaders: vi.fn(async () => null),
  sendEmail: vi.fn(async () => ({ success: true, messageId: "m1" })),
}));
vi.mock("@/lib/integrations/outlook", () => ({
  getOutlookStatus: vi.fn(async () => ({ connected: false })),
  sendOutlookEmail: vi.fn(async () => ({ success: true })),
}));
vi.mock("@/lib/twilio", () => ({ sendSms: vi.fn(async () => ({ success: true, sid: "s1" })), sendWhatsApp: vi.fn(async () => ({ success: true, sid: "w1" })) }));
vi.mock("@/lib/instagram", () => ({ sendInstagramMessage: vi.fn(async () => ({ success: true })) }));
vi.mock("@/lib/facebook", () => ({ sendMessengerMessage: vi.fn(async () => ({ success: true })) }));
vi.mock("@/lib/crm", () => ({ CRM_PROVIDERS: {}, isCrmProvider: vi.fn(() => false) }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/sendCaps", () => ({ checkSendCap: vi.fn(async () => ({ allowed: true, used: 0, cap: 250 })) }));
vi.mock("@/lib/suppression", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/suppression")>()),
  isSuppressed: vi.fn(async () => false),
}));

import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/integrations/gmail";
import { sendFollowUpToLead } from "@/lib/sending";
import { localDateKey } from "@/lib/sendWindow";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const gmailSend = sendEmail as unknown as ReturnType<typeof vi.fn>;

const TZ = "America/Los_Angeles";

beforeEach(() => {
  vi.clearAllMocks();
  p.lead.findUnique.mockResolvedValue({ id: "lead1", businessId: "biz1", name: "Maya Patel", email: "maya@example.com", phone: null, optedOutAt: null, crmProvider: null, crmId: null });
  p.business.findUnique.mockResolvedValue({ timezone: TZ });
  p.conversation.findFirst.mockResolvedValue(null);
  p.conversation.create.mockResolvedValue({ id: "conv1" });
  p.message.create.mockResolvedValue({});
  p.message.findFirst.mockResolvedValue(null);
  p.followUp.create.mockResolvedValue({});
  p.followUp.findFirst.mockResolvedValue(null);
  p.lead.update.mockResolvedValue({});
  p.outboundSend.findFirst.mockResolvedValue(null);
});

/** An automated send this long ago — on today's local date, or not, depending on the clock. */
function sentAgo(ms: number) {
  p.followUp.findFirst.mockResolvedValue({ sentAt: new Date(Date.now() - ms) });
}

describe("one automatic message a day", () => {
  it("holds a reminder back when something automatic already went to this person today", async () => {
    sentAgo(0); // a moment ago: today, wherever the business is
    const r = await sendFollowUpToLead("lead1", "Reminder two.", { automated: true, trigger: "silence", channel: "email" });
    expect(r.success).toBe(false);
    expect(r.failure).toBe("refused");
    expect(r.message).toMatch(/already sent Maya an automatic message today/);
    expect(gmailSend).not.toHaveBeenCalled();
  });

  it("holds a welcome back the same way", async () => {
    sentAgo(0);
    const r = await sendFollowUpToLead("lead1", "Welcome back.", { automated: true, trigger: "dead_lead_reactivation", channel: "email" });
    expect(r.success).toBe(false);
  });

  it("lets it through once the business's own calendar day has turned", async () => {
    // 30 hours ago is never the same local date as now.
    sentAgo(30 * 3_600_000);
    const r = await sendFollowUpToLead("lead1", "Reminder two.", { automated: true, trigger: "silence", channel: "email" });
    expect(r.success).toBe(true);
  });

  it("judges 'today' in the business's time zone, not UTC's", async () => {
    // 05:00 UTC on the 25th is 10pm on the 24th in Los Angeles. A reminder
    // sent at 20:00 UTC on the 24th (1pm there) is the SAME local day —
    // though a different UTC one — so the second must wait.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-09-25T05:00:00Z") });
    try {
      p.followUp.findFirst.mockResolvedValue({ sentAt: new Date("2026-09-24T20:00:00Z") });
      expect(localDateKey(new Date("2026-09-24T20:00:00Z"), TZ)).toBe(localDateKey(new Date(), TZ));
      const r = await sendFollowUpToLead("lead1", "Reminder two.", { automated: true, trigger: "silence", channel: "email" });
      expect(r.success).toBe(false);
      expect(p.business.findUnique).toHaveBeenCalledWith({ where: { id: "biz1" }, select: { timezone: true } });
    } finally {
      vi.useRealTimers();
    }
  });

  it("never refuses a reply to something the customer wrote", async () => {
    sentAgo(0);
    const r = await sendFollowUpToLead("lead1", "Yes, Saturdays too.", { automated: true, trigger: "unanswered", channel: "email" });
    expect(r.success).toBe(true);
  });

  it("never gets in the way of the owner's own send", async () => {
    sentAgo(0);
    const r = await sendFollowUpToLead("lead1", "Typed by the owner.", { channel: "email" });
    expect(r.success).toBe(true);
  });

  it("waits a day rather than guess when it cannot tell", async () => {
    p.followUp.findFirst.mockRejectedValue(new Error("pool timeout"));
    const r = await sendFollowUpToLead("lead1", "Reminder two.", { automated: true, trigger: "silence", channel: "email" });
    expect(r.success).toBe(false);
  });
});
