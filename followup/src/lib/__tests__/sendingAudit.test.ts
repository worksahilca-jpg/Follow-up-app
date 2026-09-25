/**
 * Guarantees for task #67 (consent record + AI audit trail) inside the
 * one funnel every send path (manual, automated, sequence, the instant
 * acknowledgement) goes through — sendFollowUpToLead(), src/lib/sending.ts:
 *  - Refuses to text/WhatsApp a lead once Lead.optedOutAt is set,
 *    regardless of who's asking — but still allows email to the same
 *    lead, since STOP is the SMS-specific legal mechanism, not a blanket
 *    "never contact."
 *  - Every automated send writes an "ai.send" AuditEvent; a manual send
 *    does not (the route layer already logs "lead.send" for those).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    lead: { findUnique: vi.fn(), update: vi.fn() },
    conversation: { findFirst: vi.fn(), create: vi.fn() },
    // findFirst is the Meta window pre-flight (metaWindowFor): the lead's
    // last inbound on the DM channel. Defaulted to "just now" in beforeEach
    // so every existing DM test stays inside the 24-hour window.
    // The duplicate-send claim (src/lib/sendClaim.ts): a successful
    // `create` means "nothing identical is already going out", which is
    // the normal state for every test in this file — they are about other
    // guards entirely. `deleteMany` is the release on a failed send.
    sendClaim: { create: vi.fn(), updateMany: vi.fn(async () => ({ count: 0 })), deleteMany: vi.fn() },
    // count = inbound messages: this lead has written (sending.ts refuses an automatic text to one who never has).
    message: { create: vi.fn(), findFirst: vi.fn(), count: vi.fn(async () => 1) },
    followUp: { create: vi.fn(), findFirst: vi.fn() },
    // The retry queue (src/lib/sendQueue.ts). sendFollowUpToLead asks it
    // whether a message to this lead is already waiting to go out before it
    // starts a second one — see the in-flight guard.
    outboundSend: { findFirst: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/integrations/gmail", () => ({
  getGmailStatus: vi.fn(async () => ({ connected: true })),
  sendEmail: vi.fn(async () => ({ success: true, messageId: "m1" })),
}));
vi.mock("@/lib/integrations/outlook", () => ({
  getOutlookStatus: vi.fn(async () => ({ connected: false })),
  sendOutlookEmail: vi.fn(async () => ({ success: true })),
}));
vi.mock("@/lib/twilio", () => ({
  sendSms: vi.fn(async () => ({ success: true, sid: "s1" })),
  sendWhatsApp: vi.fn(async () => ({ success: true, sid: "w1" })),
}));
vi.mock("@/lib/instagram", () => ({ sendInstagramMessage: vi.fn(async () => ({ success: true })) }));
vi.mock("@/lib/facebook", () => ({ sendMessengerMessage: vi.fn(async () => ({ success: true })) }));
vi.mock("@/lib/crm", () => ({ CRM_PROVIDERS: {}, isCrmProvider: vi.fn(() => false) }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/sendCaps", () => ({ checkSendCap: vi.fn(async () => ({ allowed: true, used: 0, cap: 50 })) }));
// Only isSuppressed is stubbed — dmSuppressionKey stays REAL, so these
// tests exercise the actual derivation of an IGSID/PSID from Lead.phone
// that the send path depends on. A hand-written fake of it would prove
// nothing about the value the guard looks up.
vi.mock("@/lib/suppression", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/suppression")>()),
  isSuppressed: vi.fn(async () => false),
  unsubscribeFooter: () => "\n\n—\nDon't want automated follow-ups like this? https://app/api/unsubscribe?t=tok",
  unsubscribeHeaders: () => ["List-Unsubscribe: <https://app/api/unsubscribe?t=tok>", "List-Unsubscribe-Post: List-Unsubscribe=One-Click"],
}));

import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { sendSms, sendWhatsApp } from "@/lib/twilio";
import { sendInstagramMessage } from "@/lib/instagram";
import { sendMessengerMessage } from "@/lib/facebook";
import { isSuppressed } from "@/lib/suppression";
import { sendEmail } from "@/lib/integrations/gmail";
import { sendFollowUpToLead } from "@/lib/sending";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const audit = recordAudit as unknown as ReturnType<typeof vi.fn>;
const sms = sendSms as unknown as ReturnType<typeof vi.fn>;
const whatsapp = sendWhatsApp as unknown as ReturnType<typeof vi.fn>;
const suppressed = isSuppressed as unknown as ReturnType<typeof vi.fn>;
const instagramSend = sendInstagramMessage as unknown as ReturnType<typeof vi.fn>;
const messengerSend = sendMessengerMessage as unknown as ReturnType<typeof vi.fn>;
const gmailSend = sendEmail as unknown as ReturnType<typeof vi.fn>;

function lead(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead1",
    businessId: "biz1",
    name: "Jamie Rivera",
    email: "jamie@example.com",
    phone: "+15551234567",
    optedOutAt: null,
    crmProvider: null,
    crmId: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  p.conversation.findFirst.mockResolvedValue(null);
  p.conversation.create.mockResolvedValue({ id: "conv1" });
  p.message.create.mockResolvedValue({});
  p.message.findFirst.mockResolvedValue({ sentAt: new Date() });
  p.followUp.create.mockResolvedValue({});
  // No automated message to this lead yet today — the one-per-day rule
  // for reminders (sendFollowUpToLead, 2026-09-25) lets these through.
  p.followUp.findFirst.mockResolvedValue(null);
  p.lead.update.mockResolvedValue({});
  p.outboundSend.findFirst.mockResolvedValue(null);
  sms.mockResolvedValue({ success: true, sid: "s1" });
  whatsapp.mockResolvedValue({ success: true, sid: "w1" });
  instagramSend.mockResolvedValue({ success: true });
  messengerSend.mockResolvedValue({ success: true });
});

describe("sendFollowUpToLead — opt-out enforcement", () => {
  it("refuses to send SMS to an opted-out lead", async () => {
    p.lead.findUnique.mockResolvedValue(lead({ optedOutAt: new Date() }));
    const result = await sendFollowUpToLead("lead1", "Hey, still interested?", { channel: "text" });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/STOP/i);
    expect(sms).not.toHaveBeenCalled();
    expect(p.message.create).not.toHaveBeenCalled();
  });

  it("refuses to send WhatsApp to an opted-out lead", async () => {
    p.lead.findUnique.mockResolvedValue(lead({ optedOutAt: new Date() }));
    const result = await sendFollowUpToLead("lead1", "Hey, still interested?", { channel: "whatsapp" });
    expect(result.success).toBe(false);
    expect(whatsapp).not.toHaveBeenCalled();
  });

  it("still allows email to a lead who opted out of SMS", async () => {
    p.lead.findUnique.mockResolvedValue(lead({ optedOutAt: new Date() }));
    const result = await sendFollowUpToLead("lead1", "Following up on your inquiry", { channel: "email" });
    expect(result.success).toBe(true);
  });

  it("blocks the automated/silence path exactly the same as a manual send, with no audit row for a message that never went out", async () => {
    p.lead.findUnique.mockResolvedValue(lead({ optedOutAt: new Date() }));
    const result = await sendFollowUpToLead("lead1", "Just checking in", { channel: "text", automated: true, trigger: "silence" });
    expect(result.success).toBe(false);
    expect(audit).not.toHaveBeenCalled();
  });

  it("sends normally once optedOutAt is cleared", async () => {
    p.lead.findUnique.mockResolvedValue(lead({ optedOutAt: null }));
    const result = await sendFollowUpToLead("lead1", "Hey, still interested?", { channel: "text" });
    expect(result.success).toBe(true);
    expect(sms).toHaveBeenCalledTimes(1);
  });
});

/**
 * The DM opt-out, which this funnel did not enforce at all.
 *
 * Instagram and Messenger are the channels this product is launching on,
 * and a lead who DMed "stop" kept receiving automated follow-ups: the
 * opt-out check here was scoped to text/whatsapp, and nothing on the Meta
 * inbound path ever recorded consent in the first place. The business
 * believed they were compliant because STOP works over SMS.
 *
 * The consent record is the Suppression table keyed on the platform user
 * id, so what these tests pin is not just "it refuses" but WHAT IT LOOKS
 * UP: the raw IGSID/PSID and the right channel. Looking up the wrong key
 * is the same failure as not looking at all — it just fails silently, in
 * the shape of a message going out.
 */
describe("sendFollowUpToLead — Instagram and Messenger opt-out", () => {
  beforeEach(() => {
    suppressed.mockResolvedValue(false);
  });

  it("refuses an Instagram DM to a lead who sent STOP, and looks it up by IGSID", async () => {
    p.lead.findUnique.mockResolvedValue(lead({ email: null, phone: "ig:17841400000000001" }));
    suppressed.mockResolvedValue(true);

    const result = await sendFollowUpToLead("lead1", "Still interested?", { automated: true, trigger: "silence" });

    expect(suppressed).toHaveBeenCalledWith("biz1", "17841400000000001", "instagram");
    expect(result.success).toBe(false);
    expect(result.failure).toBe("refused");
    expect(result.message).toMatch(/STOP on Instagram/i);
    expect(instagramSend).not.toHaveBeenCalled();
    expect(p.message.create).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("refuses a Messenger DM to a lead who sent STOP, and looks it up by PSID", async () => {
    p.lead.findUnique.mockResolvedValue(lead({ email: null, phone: "fb:9988776655" }));
    suppressed.mockResolvedValue(true);

    const result = await sendFollowUpToLead("lead1", "Still interested?", { automated: true, trigger: "silence" });

    expect(suppressed).toHaveBeenCalledWith("biz1", "9988776655", "messenger");
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/STOP on Messenger/i);
    expect(messengerSend).not.toHaveBeenCalled();
  });

  // A DM STOP is the same act as an SMS STOP: the person typed the word at
  // the business. The email suppression deliberately still allows a human
  // reply; this deliberately does not.
  it("refuses a MANUAL DM too, not only automated ones", async () => {
    p.lead.findUnique.mockResolvedValue(lead({ email: null, phone: "ig:17841400000000001" }));
    suppressed.mockResolvedValue(true);

    const result = await sendFollowUpToLead("lead1", "Hey, following up myself", { channel: "instagram" });

    expect(result.success).toBe(false);
    expect(instagramSend).not.toHaveBeenCalled();
  });

  it("sends the DM normally when they never opted out", async () => {
    p.lead.findUnique.mockResolvedValue(lead({ email: null, phone: "ig:17841400000000001" }));

    const result = await sendFollowUpToLead("lead1", "Still interested?", { automated: true, trigger: "silence" });

    expect(result.success).toBe(true);
    expect(instagramSend).toHaveBeenCalledTimes(1);
  });

  // Opting back in is undoing the row, so the same call that blocked the
  // send must let it through again with nothing else changed.
  it("sends again once the suppression is gone (they sent START)", async () => {
    p.lead.findUnique.mockResolvedValue(lead({ email: null, phone: "fb:9988776655" }));
    suppressed.mockResolvedValueOnce(true);
    const blocked = await sendFollowUpToLead("lead1", "Still interested?", { channel: "messenger" });
    expect(blocked.success).toBe(false);

    suppressed.mockResolvedValue(false);
    const allowed = await sendFollowUpToLead("lead1", "Still interested?", { channel: "messenger" });
    expect(allowed.success).toBe(true);
    expect(messengerSend).toHaveBeenCalledTimes(1);
  });

  // An opt-out on one platform is not an opt-out on the other: the ids are
  // separate namespaces and can collide as strings, which is why the row
  // carries a channel at all.
  it("does not treat an Instagram opt-out as a Messenger one", async () => {
    suppressed.mockImplementation(async (_b: string, _a: string, channel: string) => channel === "instagram");
    p.lead.findUnique.mockResolvedValue(lead({ email: null, phone: "fb:17841400000000001" }));

    const result = await sendFollowUpToLead("lead1", "Still interested?", { channel: "messenger" });

    expect(result.success).toBe(true);
    expect(messengerSend).toHaveBeenCalledTimes(1);
  });

  // Email is a different address and a different mechanism; a DM STOP must
  // not quietly become a blanket "never contact again."
  it("still allows email to a lead who opted out of Instagram", async () => {
    suppressed.mockImplementation(async (_b: string, _a: string, channel: string) => channel === "instagram");
    p.lead.findUnique.mockResolvedValue(lead({ phone: "ig:17841400000000001" }));

    const result = await sendFollowUpToLead("lead1", "Following up on your enquiry", { channel: "email" });

    expect(result.success).toBe(true);
  });
});

/**
 * The half-failed send. The provider has accepted the message — it is on
 * its way to a real customer's phone or inbox — and only then does the
 * database write fail (a Prisma connection-pool timeout, an ECONNRESET, a
 * deploy cycling Postgres mid-request).
 *
 * This must resolve to "sent", not to a throw, because of what the
 * callers do with a throw:
 *  - automation.ts classifies ECONNRESET/ETIMEDOUT as transient, RELEASES
 *    its lastAutomationCheckedAt claim, and re-drafts and re-sends the
 *    lead on the next hourly tick. lastContacted never updated either, so
 *    the lead is still inside the silence window and qualifies again.
 *  - sequences.ts leaves the lead enrolled on the same sequenceStepIndex
 *    behind only a 5-minute claim lock, which expires long before the
 *    next hourly tick — that step re-sends unconditionally.
 * Either way the customer gets the same message twice, in the owner's
 * name. Losing the Message row is a gap in the thread view; retrying is a
 * duplicate message to a stranger's customer.
 */
describe("sendFollowUpToLead — a send the provider already accepted is never reported as failed", () => {
  beforeEach(() => {
    p.lead.findUnique.mockResolvedValue(lead());
  });

  it("returns success when the conversation/message write fails after the provider accepted", async () => {
    p.conversation.create.mockRejectedValue(new Error("Timed out fetching a new connection from the connection pool"));

    const result = await sendFollowUpToLead("lead1", "Following up on your inquiry", {
      channel: "email",
      automated: true,
      trigger: "silence",
    });

    expect(result.success).toBe(true);
  });

  it("returns success when the FollowUp write fails after the provider accepted", async () => {
    p.followUp.create.mockRejectedValue(Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }));

    const result = await sendFollowUpToLead("lead1", "Still interested?", {
      channel: "text",
      automated: true,
      trigger: "sequence",
    });

    expect(result.success).toBe(true);
    expect(sms).toHaveBeenCalledTimes(1);
  });

  it("returns success when the lastContacted write fails after the provider accepted", async () => {
    p.lead.update.mockRejectedValue(Object.assign(new Error("connection terminated"), { code: "ECONNRESET" }));

    const result = await sendFollowUpToLead("lead1", "Still interested?", { channel: "text" });

    expect(result.success).toBe(true);
    expect(sms).toHaveBeenCalledTimes(1);
  });

  // lastContacted is the one field that takes the lead back out of every
  // re-eligibility window, so on a flaky database it gets the first and
  // best chance of landing.
  it("writes lastContacted before the conversation/message bookkeeping", async () => {
    await sendFollowUpToLead("lead1", "Following up", { channel: "email" });

    expect(p.lead.update.mock.invocationCallOrder[0]).toBeLessThan(p.message.create.mock.invocationCallOrder[0]);
  });

  // The counterpart guarantee: a provider that did NOT accept must still
  // fail loudly, or the caller would advance a sequence step nothing was
  // sent for.
  it("still reports failure when the provider itself rejects the message", async () => {
    sms.mockResolvedValue({ success: false, message: "Twilio rejected this message." });

    const result = await sendFollowUpToLead("lead1", "Still interested?", { channel: "text" });

    expect(result.success).toBe(false);
    expect(p.message.create).not.toHaveBeenCalled();
  });
});

describe("sendFollowUpToLead — AI audit trail", () => {
  beforeEach(() => {
    p.lead.findUnique.mockResolvedValue(lead());
  });

  it("records an ai.send audit event for an automated send", async () => {
    const result = await sendFollowUpToLead("lead1", "Just checking in", { channel: "email", automated: true, trigger: "unanswered" });
    expect(result.success).toBe(true);
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: "biz1" }),
      "ai.send",
      expect.objectContaining({ targetId: "lead1", meta: expect.objectContaining({ trigger: "unanswered" }) })
    );
  });

  it("does not record an ai.send audit event for a manual send", async () => {
    const result = await sendFollowUpToLead("lead1", "Following up", { channel: "email" });
    expect(result.success).toBe(true);
    expect(audit).not.toHaveBeenCalled();
  });

  // task #63 follow-up: a caller-specific decision (the instant ack's
  // generated-vs-fallback choice, src/lib/acknowledge.ts) is merged into
  // this same event via extraAuditMeta — not logged as its own action —
  // so a lead never ends up with two audit rows for one send.
  it("merges extraAuditMeta into the same ai.send event, alongside the standard fields", async () => {
    const result = await sendFollowUpToLead("lead1", "Thanks for reaching out", {
      channel: "email",
      automated: true,
      trigger: "instant_ack",
      extraAuditMeta: { source: "fallback", reason: "risk medium: states availability", localized: true },
    });
    expect(result.success).toBe(true);
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: "biz1" }),
      "ai.send",
      expect.objectContaining({
        targetId: "lead1",
        meta: {
          channel: "email",
          trigger: "instant_ack",
          length: "Thanks for reaching out".length,
          source: "fallback",
          reason: "risk medium: states availability",
          localized: true,
        },
      })
    );
  });
});

/**
 * Email unsubscribe. `optedOutAt` above is the SMS/WhatsApp STOP mechanism;
 * this is the email equivalent, which did not exist at all until now — no
 * link, no header, no list.
 *
 * The line it draws is deliberate: it stops AUTOMATED mail and nothing
 * else. Someone who clicks unsubscribe on an automated nudge has not asked
 * their builder to stop answering their questions, and the copy on the link
 * says exactly that. These tests pin both halves, because either one
 * failing alone is a real harm — silently mailing someone who opted out, or
 * silently severing a live conversation.
 */
describe("email unsubscribe", () => {
  beforeEach(() => {
    suppressed.mockResolvedValue(false);
  });

  it("refuses a REACTIVATION email once the address is suppressed", async () => {
    p.lead.findUnique.mockResolvedValue(lead());
    suppressed.mockResolvedValue(true);

    const result = await sendFollowUpToLead("lead1", "Still interested?", {
      automated: true,
      trigger: "dead_lead_reactivation",
    });

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/unsubscribed from automated follow-ups/i);
    expect(gmailSend).not.toHaveBeenCalled();
  });

  // The narrowing that makes the product honest. An unsubscribe is an
  // opt-out from a MAILING. A reply to someone who wrote yesterday is not a
  // mailing, and treating it as one would stop a business answering a
  // customer who is mid-conversation with them.
  it("still sends an ordinary automated REPLY to a suppressed address", async () => {
    p.lead.findUnique.mockResolvedValue(lead());
    p.conversation.findFirst.mockResolvedValue({ id: "c1" });
    suppressed.mockResolvedValue(true);

    const result = await sendFollowUpToLead("lead1", "Following up on your question.", {
      automated: true,
      trigger: "unanswered",
    });

    expect(result.success).toBe(true);
    expect(gmailSend).toHaveBeenCalled();
  });

  // The other half. A human replying to their own customer must still get
  // through, or the product stops doing its job in the name of consent.
  it("still lets a HUMAN reply to the same person", async () => {
    p.lead.findUnique.mockResolvedValue(lead());
    p.conversation.findFirst.mockResolvedValue({ id: "c1" });
    suppressed.mockResolvedValue(true);

    const result = await sendFollowUpToLead("lead1", "Yes — Tuesday works.", { automated: false });

    expect(result.success).toBe(true);
    expect(gmailSend).toHaveBeenCalled();
  });

  // Founder's call, 2026-09-15: no unsubscribe line and no
  // List-Unsubscribe header on ANY message, including the cold batch.
  // Every message goes to someone who contacted the business first, and the
  // draft is required to say so — an "unsubscribe" line would misdescribe
  // an overdue reply as a mailing. This pins the absence, so it can't drift
  // back in unnoticed.
  it("puts no unsubscribe line or header on anything, batch included", async () => {
    for (const options of [
      { automated: false } as const,
      { automated: true, trigger: "unanswered" } as const,
      { automated: true, trigger: "dead_lead_reactivation" } as const,
    ]) {
      gmailSend.mockClear();
      p.lead.findUnique.mockResolvedValue(lead());
      p.conversation.findFirst.mockResolvedValue({ id: "c1" });

      await sendFollowUpToLead("lead1", "You asked about the refit — sorry we never came back.", options);

      const sent = gmailSend.mock.calls.at(-1)![1] as { body: string; extraHeaders?: string[] };
      expect(sent.body).not.toMatch(/unsubscribe/i);
      expect(sent.extraHeaders).toBeUndefined();
    }
  });

  it("never blocks a text because of an EMAIL unsubscribe", async () => {
    p.lead.findUnique.mockResolvedValue(lead({ email: null, phone: "+15551234567" }));
    p.conversation.findFirst.mockResolvedValue({ id: "c1" });
    suppressed.mockResolvedValue(true);

    const result = await sendFollowUpToLead("lead1", "Quick update.", {
      automated: true,
      channel: "text",
      trigger: "dead_lead_reactivation",
    });

    expect(result.success).toBe(true);
    expect(sms).toHaveBeenCalled();
  });
});

/**
 * Reply buttons ride through the one funnel every send takes
 * (src/lib/quickReplies.ts): they reach the two Meta senders and nothing
 * else, and the audit trail records how many went — a count, never the
 * titles.
 */
describe("sendFollowUpToLead — reply buttons", () => {
  const chips = [
    { title: "Morning", payload: "fu1;unanswered;availability_unanswered;morning;a" },
    { title: "Afternoon", payload: "fu1;unanswered;availability_unanswered;afternoon;a" },
  ];

  // An earlier block leaves isSuppressed answering "yes" for Instagram;
  // clearAllMocks keeps implementations, so this block sets its own.
  beforeEach(() => {
    suppressed.mockReset();
    suppressed.mockResolvedValue(false);
  });

  it("hands the chips to the Instagram sender", async () => {
    p.lead.findUnique.mockResolvedValue(lead({ email: null, phone: "ig:17841400000000001" }));
    const result = await sendFollowUpToLead("lead1", "Morning or afternoon?", { automated: true, trigger: "unanswered", channel: "instagram", quickReplies: chips });
    expect(result).toEqual({ success: true });
    expect(instagramSend).toHaveBeenCalledWith("biz1", "17841400000000001", "Morning or afternoon?", { quickReplies: chips, humanAgent: false });
  });

  it("hands the chips to the Messenger sender", async () => {
    p.lead.findUnique.mockResolvedValue(lead({ email: null, phone: "fb:9988776655" }));
    await sendFollowUpToLead("lead1", "Morning or afternoon?", { automated: true, trigger: "unanswered", channel: "messenger", quickReplies: chips });
    expect(messengerSend).toHaveBeenCalledWith("biz1", "9988776655", "Morning or afternoon?", { quickReplies: chips, humanAgent: false });
  });

  it("drops them silently on a channel that has no such thing", async () => {
    p.lead.findUnique.mockResolvedValue(lead());
    await sendFollowUpToLead("lead1", "Morning or afternoon?", { automated: true, trigger: "unanswered", channel: "text", quickReplies: chips });
    expect(sms).toHaveBeenCalledWith("biz1", "+15551234567", "Morning or afternoon?");
    expect(audit).toHaveBeenCalledWith(expect.anything(), "ai.send", expect.objectContaining({ meta: expect.not.objectContaining({ quickReplies: expect.anything() }) }));
  });

  it("records the count in the ai.send audit event, never the titles", async () => {
    p.lead.findUnique.mockResolvedValue(lead({ email: null, phone: "ig:17841400000000001" }));
    await sendFollowUpToLead("lead1", "Morning or afternoon?", { automated: true, trigger: "unanswered", channel: "instagram", quickReplies: chips });
    const [, action, detail] = audit.mock.calls.find((c) => c[1] === "ai.send")!;
    expect(action).toBe("ai.send");
    expect(detail.meta.quickReplies).toBe(2);
    expect(JSON.stringify(detail.meta)).not.toContain("Morning");
  });
});

/**
 * Meta's window on Instagram and Messenger, judged BEFORE the provider is
 * called (sendFollowUpToLead → metaWindowFor). Inside 24 hours of the
 * lead's last message: any send. Between 24 hours and 7 days: only a
 * person's send, tagged human_agent, and only when the call carries that
 * person's id — nothing automated can ever carry the tag. Past 7 days:
 * nothing, in a sentence the owner can act on. No fallback to another
 * channel, ever (PRODUCT_DIRECTION, DM-only).
 */
describe("sendFollowUpToLead — Meta's window on Instagram and Messenger", () => {
  const H = 3_600_000;
  const igLead = () => lead({ email: null, phone: "ig:17841400000000001", name: "Aanya Shah" });
  const lastWrote = (hoursAgo: number) => p.message.findFirst.mockResolvedValue({ sentAt: new Date(Date.now() - hoursAgo * H) });

  beforeEach(() => {
    suppressed.mockReset();
    suppressed.mockResolvedValue(false);
    p.lead.findUnique.mockResolvedValue(igLead());
  });

  it("sends an automated DM inside the window as a plain in-window message", async () => {
    lastWrote(3);
    const result = await sendFollowUpToLead("lead1", "Morning or afternoon?", { automated: true, trigger: "unanswered", channel: "instagram" });
    expect(result).toEqual({ success: true });
    expect(instagramSend).toHaveBeenCalledWith("biz1", "17841400000000001", "Morning or afternoon?", { quickReplies: undefined, humanAgent: false });
  });

  it("refuses an automated DM past 24 hours before touching the provider, and says only the owner can send it", async () => {
    lastWrote(30);
    const result = await sendFollowUpToLead("lead1", "Still there?", { automated: true, trigger: "silence", channel: "instagram" });
    expect(result.success).toBe(false);
    expect(result.failure).toBe("refused");
    expect(result.message).toMatch(/24-hour window on Instagram has closed for Aanya/);
    expect(result.message).toMatch(/Only you can send one/);
    expect(instagramSend).not.toHaveBeenCalled();
    expect(p.outboundSend.create).not.toHaveBeenCalled();
  });

  it("sends a PERSON's reply between 24 hours and 7 days under the human-agent tag, and says so in the result", async () => {
    lastWrote(3 * 24);
    const result = await sendFollowUpToLead("lead1", "Here's the quote you asked for.", { trigger: "manual", humanSend: { userId: "user1" } });
    expect(result).toEqual({ success: true, messagingTag: "HUMAN_AGENT" });
    expect(instagramSend).toHaveBeenCalledWith("biz1", "17841400000000001", "Here's the quote you asked for.", { quickReplies: undefined, humanAgent: true });
  });

  it("does the same on Messenger", async () => {
    p.lead.findUnique.mockResolvedValue(lead({ email: null, phone: "fb:9988776655", name: "Ben" }));
    lastWrote(2 * 24);
    const result = await sendFollowUpToLead("lead1", "Here's the quote.", { trigger: "manual", humanSend: { userId: "user1" } });
    expect(result.messagingTag).toBe("HUMAN_AGENT");
    expect(messengerSend).toHaveBeenCalledWith("biz1", "9988776655", "Here's the quote.", { quickReplies: undefined, humanAgent: true });
  });

  it("never lets an automated send carry the tag, even if a caller passes humanSend", async () => {
    lastWrote(3 * 24);
    const result = await sendFollowUpToLead("lead1", "Still there?", { automated: true, trigger: "sequence", channel: "instagram", humanSend: { userId: "user1" } });
    expect(result.success).toBe(false);
    expect(instagramSend).not.toHaveBeenCalled();
  });

  it("sends a person's reply inside 24 hours WITHOUT the tag — in-window is in-window", async () => {
    lastWrote(5);
    const result = await sendFollowUpToLead("lead1", "Yes, Saturday works.", { trigger: "manual", humanSend: { userId: "user1" } });
    expect(result).toEqual({ success: true });
    expect(instagramSend).toHaveBeenCalledWith("biz1", "17841400000000001", "Yes, Saturday works.", { quickReplies: undefined, humanAgent: false });
  });

  it("refuses everyone past 7 days with a plain sentence, before touching the provider", async () => {
    lastWrote(8 * 24);
    const result = await sendFollowUpToLead("lead1", "Still there?", { trigger: "manual", humanSend: { userId: "user1" } });
    expect(result.success).toBe(false);
    expect(result.failure).toBe("refused");
    expect(result.message).toMatch(/Aanya last wrote on Instagram more than 7 days ago/);
    expect(result.message).toMatch(/They'll need to write first/);
    expect(instagramSend).not.toHaveBeenCalled();
  });

  it("refuses a lead who has never written on the channel", async () => {
    p.message.findFirst.mockResolvedValue(null);
    const result = await sendFollowUpToLead("lead1", "Hello?", { trigger: "manual", humanSend: { userId: "user1" } });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/hasn't messaged you on Instagram yet/);
    expect(instagramSend).not.toHaveBeenCalled();
  });

  it("measures the window from the lead's last message on THAT channel", async () => {
    lastWrote(3);
    await sendFollowUpToLead("lead1", "Morning?", { automated: true, trigger: "unanswered", channel: "instagram" });
    expect(p.message.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { conversation: { leadId: "lead1", channel: "instagram" }, direction: "inbound" } })
    );
  });

  it("leaves email, SMS and WhatsApp alone — no window check at all", async () => {
    p.lead.findUnique.mockResolvedValue(lead());
    p.message.findFirst.mockResolvedValue(null);
    const result = await sendFollowUpToLead("lead1", "Following up", { automated: true, trigger: "silence", channel: "text" });
    expect(result.success).toBe(true);
    expect(p.message.findFirst).not.toHaveBeenCalled();
  });
});
