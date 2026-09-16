/**
 * A provider outage must delay a message, not lose it — and must never send
 * it twice.
 *
 * Until now sendFollowUpToLead() answered a failed provider call with
 * { success: false } and every caller shrugged. For an automated send that
 * meant the message was simply never sent: one transient Twilio 500, one
 * Gmail rate limit, and a real follow-up to a real customer quietly did not
 * happen. These tests pin the retry that fixes it, and — more importantly —
 * the three things it must never do:
 *
 *   1. Send the same message twice. Two invocations racing one queued row,
 *      and a CALLER re-sending while a retry is still pending, are both
 *      covered here. A duplicate is far worse than a message that never
 *      went out.
 *   2. Retry a permanent failure. A bad number, an opt-out, a suppressed
 *      address, a tripped daily fuse: all terminal, none retried.
 *   3. Send past a guard. A lead who texts STOP between the first attempt
 *      and the retry is not messaged — the guards are re-evaluated at send
 *      time, not at enqueue time.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    lead: { findUnique: vi.fn(), update: vi.fn() },
    user: { findMany: vi.fn() },
    notification: { create: vi.fn() },
    conversation: { findFirst: vi.fn(), create: vi.fn() },
    message: { create: vi.fn(), findFirst: vi.fn() },
    followUp: { create: vi.fn() },
    outboundSend: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
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
vi.mock("@/lib/sendCaps", () => ({ checkSendCap: vi.fn(async () => ({ allowed: true, used: 0, cap: 250 })) }));
vi.mock("@/lib/suppression", () => ({ isSuppressed: vi.fn(async () => false) }));
vi.mock("@/lib/billing", () => ({ requireActiveBilling: vi.fn(async () => true) }));

import { prisma } from "@/lib/db";
import { sendSms } from "@/lib/twilio";
import { sendEmail } from "@/lib/integrations/gmail";
import { checkSendCap } from "@/lib/sendCaps";
import { requireActiveBilling } from "@/lib/billing";
import { sendFollowUpToLead, runOutboundRetries } from "@/lib/sending";
import { MAX_SEND_ATTEMPTS, RETRY_BACKOFF_MINUTES } from "@/lib/sendQueue";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const sms = sendSms as unknown as ReturnType<typeof vi.fn>;
const gmailSend = sendEmail as unknown as ReturnType<typeof vi.fn>;
const cap = checkSendCap as unknown as ReturnType<typeof vi.fn>;
const billing = requireActiveBilling as unknown as ReturnType<typeof vi.fn>;

function lead(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead1",
    businessId: "biz1",
    name: "Jamie Rivera",
    email: "jamie@example.com",
    phone: "+15551234567",
    optedOutAt: null,
    assignedToId: "user1",
    crmProvider: null,
    crmId: null,
    ...overrides,
  };
}

/** A queued row as claimNextDueSend() hands it back. */
function queuedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "q1",
    businessId: "biz1",
    leadId: "lead1",
    channel: "text",
    body: "Still interested in the quote?",
    subject: null,
    emailThreadId: null,
    emailInReplyTo: null,
    trigger: "silence",
    auditMeta: null,
    attempts: 2,
    maxAttempts: MAX_SEND_ATTEMPTS,
    ...overrides,
  };
}

/**
 * Arms the queue mocks so one row is due and can be claimed successfully.
 * The first findMany is reapStaleSends' own scan (nothing stale here); the
 * second is the "what is due" query the claim walks.
 */
function oneRowDue(row = queuedRow()) {
  p.outboundSend.findMany
    .mockResolvedValueOnce([]) // reapStaleSends
    .mockResolvedValueOnce([{ id: row.id }]) // due
    .mockResolvedValue([]);
  p.outboundSend.updateMany.mockResolvedValue({ count: 1 });
  p.outboundSend.findUnique.mockResolvedValue(row);
}

beforeEach(() => {
  vi.clearAllMocks();
  p.lead.findUnique.mockResolvedValue(lead());
  p.lead.update.mockResolvedValue({});
  p.user.findMany.mockResolvedValue([{ id: "admin1" }]);
  p.notification.create.mockResolvedValue({});
  p.conversation.findFirst.mockResolvedValue({ id: "conv1" });
  p.conversation.create.mockResolvedValue({ id: "conv1" });
  p.message.create.mockResolvedValue({});
  p.message.findFirst.mockResolvedValue(null);
  p.followUp.create.mockResolvedValue({});
  p.outboundSend.findFirst.mockResolvedValue(null);
  p.outboundSend.findMany.mockResolvedValue([]);
  p.outboundSend.updateMany.mockResolvedValue({ count: 1 });
  p.outboundSend.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "q1",
    nextAttemptAt: data.nextAttemptAt,
  }));
  sms.mockResolvedValue({ success: true, sid: "s1" });
  gmailSend.mockResolvedValue({ success: true, messageId: "m1" });
  cap.mockResolvedValue({ allowed: true, used: 0, cap: 250 });
  billing.mockResolvedValue(true);
});

describe("a transient provider failure is held, not lost", () => {
  // The founder's requirement, in one test. Twilio having a bad minute used
  // to cost a follow-up outright.
  it("queues an automated send Twilio refused with a 503", async () => {
    sms.mockResolvedValue({ success: false, message: "Service Unavailable", status: 503 });

    const result = await sendFollowUpToLead("lead1", "Still interested in the quote?", {
      channel: "text",
      automated: true,
      trigger: "silence",
    });

    expect(result.success).toBe(false);
    expect(result.failure).toBe("transient");
    expect(result.queuedRetryAt).toBeInstanceOf(Date);
    expect(p.outboundSend.create).toHaveBeenCalledTimes(1);

    const row = p.outboundSend.create.mock.calls[0][0].data;
    // The whole envelope, so the retry sends the message the risk gate
    // already approved rather than paying to draft a new one nobody saw.
    expect(row).toMatchObject({
      businessId: "biz1",
      leadId: "lead1",
      channel: "text",
      body: "Still interested in the quote?",
      trigger: "silence",
      status: "queued",
      attempts: 1,
    });
    // Growing delay, first step first.
    const delayMs = (row.nextAttemptAt as Date).getTime() - Date.now();
    expect(delayMs).toBeGreaterThan(RETRY_BACKOFF_MINUTES[0] * 60_000 - 5_000);
  });

  // Gmail is the other failure shape: googleapis THROWS a GaxiosError with a
  // status on it. That throw must not escape — automation.ts reads an escaped
  // transient throw as "release the claim and re-draft next hour", which
  // would race the queue and deliver the same follow-up twice.
  it("catches a Gmail rate-limit throw, queues it, and does not re-throw", async () => {
    gmailSend.mockRejectedValue(Object.assign(new Error("Rate Limit Exceeded"), { status: 429 }));

    const result = await sendFollowUpToLead("lead1", "Following up on your quote", {
      channel: "email",
      automated: true,
      trigger: "unanswered",
    });

    expect(result.failure).toBe("transient");
    expect(p.outboundSend.create).toHaveBeenCalledTimes(1);
  });

  it("carries the email threading fields through, so the retry lands in the same thread", async () => {
    gmailSend.mockResolvedValue({ success: false, message: "Backend Error", status: 500 });

    await sendFollowUpToLead("lead1", "Following up", {
      channel: "email",
      automated: true,
      trigger: "instant_ack",
      subject: "Re: your enquiry",
      emailThreadId: "thread-9",
      emailInReplyTo: "<msg-9@mail>",
      extraAuditMeta: { source: "generated" },
    });

    expect(p.outboundSend.create.mock.calls[0][0].data).toMatchObject({
      subject: "Re: your enquiry",
      emailThreadId: "thread-9",
      emailInReplyTo: "<msg-9@mail>",
      auditMeta: { source: "generated" },
    });
  });
});

describe("a permanent failure is never retried", () => {
  // The cost of getting this wrong in the generous direction is a loop that
  // burns money and looks like abuse — which is why the classifier is the
  // existing narrow allowlist and not a denylist.
  it("does not queue a message Twilio rejected with a 400", async () => {
    sms.mockResolvedValue({ success: false, message: "The 'To' number is not a valid phone number.", status: 400 });

    const result = await sendFollowUpToLead("lead1", "Still interested?", {
      channel: "text",
      automated: true,
      trigger: "silence",
    });

    expect(result.failure).toBe("permanent");
    expect(p.outboundSend.create).not.toHaveBeenCalled();
  });

  it("does not queue a send the opt-out guard refused", async () => {
    p.lead.findUnique.mockResolvedValue(lead({ optedOutAt: new Date() }));

    const result = await sendFollowUpToLead("lead1", "Still interested?", {
      channel: "text",
      automated: true,
      trigger: "silence",
    });

    expect(result.failure).toBe("refused");
    expect(p.outboundSend.create).not.toHaveBeenCalled();
    expect(sms).not.toHaveBeenCalled();
  });

  it("does not queue a send the daily fuse refused", async () => {
    cap.mockResolvedValue({ allowed: false, used: 250, cap: 250, reason: "FollowUp has stopped after 250 messages today." });

    const result = await sendFollowUpToLead("lead1", "Still interested?", {
      channel: "text",
      automated: true,
      trigger: "silence",
    });

    expect(result.failure).toBe("refused");
    expect(p.outboundSend.create).not.toHaveBeenCalled();
  });

  // A person who pressed Send is looking at the screen and is told it
  // failed. Queueing it behind their back means their message goes out
  // twice the moment they press it again.
  it("never queues a manual send, even a transient one", async () => {
    sms.mockResolvedValue({ success: false, message: "Service Unavailable", status: 503 });

    const result = await sendFollowUpToLead("lead1", "Tuesday works", { channel: "text" });

    expect(result.success).toBe(false);
    expect(p.outboundSend.create).not.toHaveBeenCalled();
  });
});

describe("never send twice", () => {
  // The race two overlapping cron invocations create. The claim is a single
  // conditional UPDATE with `status: "queued"` in the WHERE — the same shape
  // every other claim in this codebase uses — so exactly one invocation can
  // match the row.
  it("claims a queued row conditionally, and sends nothing when it loses the race", async () => {
    p.outboundSend.findMany
      .mockResolvedValueOnce([]) // nothing stale
      .mockResolvedValueOnce([{ id: "q1" }])
      .mockResolvedValue([]);
    p.outboundSend.updateMany.mockResolvedValue({ count: 0 }); // another invocation got there first

    const result = await runOutboundRetries();

    const claim = p.outboundSend.updateMany.mock.calls[0][0];
    expect(claim.where).toMatchObject({ id: "q1", status: "queued" });
    expect(claim.where.nextAttemptAt).toBeDefined();
    expect(claim.data).toMatchObject({ status: "sending" });
    // Nothing was sent and nothing was claimed by the loser.
    expect(sms).not.toHaveBeenCalled();
    expect(gmailSend).not.toHaveBeenCalled();
    expect(result.attempted).toBe(0);
  });

  it("spends an attempt as part of the claim, not after the send", async () => {
    oneRowDue();

    await runOutboundRetries();

    // If the count were incremented after the attempt, an invocation killed
    // mid-send would return the row with its budget untouched and the same
    // message could be attempted forever.
    expect(p.outboundSend.updateMany.mock.calls[0][0].data.attempts).toEqual({ increment: 1 });
  });

  // The other race, and the one that actually bites: sequences.ts leaves a
  // lead enrolled on the same step after a failed send and re-drafts it on
  // the next hourly tick. Without this guard the queue would deliver the
  // parked copy and the workflow a fresh one — the same follow-up twice, in
  // the owner's name.
  it("refuses a second automated send while a retry for that lead is still pending", async () => {
    p.outboundSend.findFirst.mockResolvedValue({ id: "q1" });

    const result = await sendFollowUpToLead("lead1", "Still interested?", {
      channel: "text",
      automated: true,
      trigger: "sequence",
    });

    expect(result.success).toBe(false);
    expect(result.failure).toBe("refused");
    expect(sms).not.toHaveBeenCalled();
    expect(p.outboundSend.create).not.toHaveBeenCalled();
    // Only ever asked about unfinished sends — a lead with a delivered
    // history must not be blocked forever.
    expect(p.outboundSend.findFirst.mock.calls[0][0].where).toMatchObject({
      leadId: "lead1",
      status: { in: ["queued", "sending"] },
    });
  });

  it("never blocks a human's own reply on a pending retry", async () => {
    p.outboundSend.findFirst.mockResolvedValue({ id: "q1" });

    const result = await sendFollowUpToLead("lead1", "Tuesday works", { channel: "text" });

    expect(result.success).toBe(true);
    expect(sms).toHaveBeenCalledTimes(1);
  });

  it("does not queue a second row when the retry itself fails again", async () => {
    oneRowDue();
    sms.mockResolvedValue({ success: false, message: "Service Unavailable", status: 503 });

    await runOutboundRetries();

    expect(p.outboundSend.create).not.toHaveBeenCalled();
  });

  // An invocation killed while the provider call was in flight. Whether the
  // message left is genuinely unknown, and "we might have already sent it"
  // resolves to "don't send it again" — the same call reactivationSend.ts
  // makes about its own claim.
  it("retires an interrupted attempt instead of re-sending it", async () => {
    p.outboundSend.findMany
      .mockResolvedValueOnce([{ id: "q-stale", leadId: "lead1", businessId: "biz1", channel: "text" }]) // reapStaleSends
      .mockResolvedValue([]); // nothing else due

    const result = await runOutboundRetries();

    expect(result.abandoned).toBe(1);
    expect(sms).not.toHaveBeenCalled();
    const retire = p.outboundSend.updateMany.mock.calls[0][0];
    expect(retire.where).toMatchObject({ id: "q-stale", status: "sending" });
    expect(retire.data.status).toBe("failed");
    // And a human is told, because a message that may never have arrived is
    // not something to leave in a table nobody opens.
    expect(p.notification.create).toHaveBeenCalled();
  });
});

describe("the guards still win at retry time", () => {
  // THE case. The lead texted STOP after the first attempt failed. The
  // approval to message them is a snapshot; the world moved on.
  it("does not send a queued message to a lead who opted out between attempts", async () => {
    oneRowDue();
    p.lead.findUnique.mockResolvedValue(lead({ optedOutAt: new Date() }));

    const result = await runOutboundRetries();

    expect(sms).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
    expect(result.canceled).toBe(1);
    // Terminal, and terminal as CANCELED rather than FAILED: nothing went
    // wrong, the product correctly declined.
    const retire = p.outboundSend.updateMany.mock.calls.at(-1)![0];
    expect(retire.data.status).toBe("canceled");
    expect(retire.data.lastError).toMatch(/STOP/i);
    // Not a failure anyone needs waking up about.
    expect(p.notification.create).not.toHaveBeenCalled();
  });

  it("does not send a queued message once the daily fuse has tripped", async () => {
    oneRowDue();
    cap.mockResolvedValue({ allowed: false, used: 250, cap: 250, reason: "FollowUp has stopped after 250 messages today." });

    const result = await runOutboundRetries();

    expect(sms).not.toHaveBeenCalled();
    expect(result.canceled).toBe(1);
  });

  it("sends nothing on behalf of a business whose subscription lapsed", async () => {
    oneRowDue();
    billing.mockResolvedValue(false);

    const result = await runOutboundRetries();

    expect(sms).not.toHaveBeenCalled();
    expect(result.canceled).toBe(1);
  });

  it("re-enters the funnel at the top, so the send is a real one when the guards pass", async () => {
    oneRowDue();

    const result = await runOutboundRetries();

    expect(result.sent).toBe(1);
    expect(sms).toHaveBeenCalledWith("biz1", "+15551234567", "Still interested in the quote?");
    // The bookkeeping every other send gets: a Message in the thread and a
    // FollowUp row, so the weekly report and the daily fuse both count it.
    expect(p.message.create).toHaveBeenCalled();
    expect(p.followUp.create).toHaveBeenCalled();
    const done = p.outboundSend.updateMany.mock.calls.at(-1)![0];
    expect(done.data.status).toBe("sent");
  });
});

describe("bounded, then a terminal state someone can see", () => {
  it("backs off further each time while there is budget left", async () => {
    oneRowDue(queuedRow({ attempts: 2 }));
    sms.mockResolvedValue({ success: false, message: "Service Unavailable", status: 503 });

    const result = await runOutboundRetries();

    expect(result.requeued).toBe(1);
    const requeue = p.outboundSend.updateMany.mock.calls.at(-1)![0];
    expect(requeue.data.status).toBe("queued");
    // attempts = 2 means the second delay in the ladder, not the first.
    const delayMs = (requeue.data.nextAttemptAt as Date).getTime() - Date.now();
    expect(delayMs).toBeGreaterThan(RETRY_BACKOFF_MINUTES[1] * 60_000 - 5_000);
    expect(delayMs).toBeLessThan(RETRY_BACKOFF_MINUTES[1] * 60_000 + 5_000);
    expect(p.notification.create).not.toHaveBeenCalled();
  });

  it("gives up after the last attempt and tells whoever owns the lead", async () => {
    oneRowDue(queuedRow({ attempts: MAX_SEND_ATTEMPTS }));
    sms.mockResolvedValue({ success: false, message: "Service Unavailable", status: 503 });

    const result = await runOutboundRetries();

    expect(result.failed).toBe(1);
    expect(result.requeued).toBe(0);
    const retire = p.outboundSend.updateMany.mock.calls.at(-1)![0];
    expect(retire.data.status).toBe("failed");
    expect(retire.data.resolvedAt).toBeInstanceOf(Date);
    // The lead's assignee, not a silent console line.
    expect(p.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "user1", leadId: "lead1" }) })
    );
    const note = p.notification.create.mock.calls[0][0].data.message as string;
    expect(note).toMatch(/couldn't be delivered/i);
    // Plain language, no queue jargon — the owner is not a software person.
    expect(note).not.toMatch(/transient|queue|backoff/i);
  });

  it("stops retrying the moment the provider's answer stops changing", async () => {
    oneRowDue();
    sms.mockResolvedValue({ success: false, message: "The 'To' number is not a valid phone number.", status: 400 });

    const result = await runOutboundRetries();

    expect(result.failed).toBe(1);
    expect(result.requeued).toBe(0);
    expect(p.outboundSend.updateMany.mock.calls.at(-1)![0].data.status).toBe("failed");
  });
});
