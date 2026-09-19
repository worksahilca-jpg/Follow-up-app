/**
 * The DM grace period (founder's decision, 2026-09-16).
 *
 * On Instagram, Messenger and WhatsApp the instant acknowledgement waits
 * ~2 minutes instead of firing from the webhook. If the owner answers the
 * DM themselves inside that window, FollowUp stays silent; if they don't,
 * it sends and then tells the owner it replied for them. What is being
 * proved here is that deferring did not cost any of the guarantees
 * src/lib/acknowledge.ts already made — every one of them is re-evaluated
 * at SEND time, two minutes later, against the world as it is then:
 *
 *  - the owner replying during the window cancels the acknowledgement;
 *  - exactly one acknowledgement per lead, ever, even with two cron ticks
 *    racing the same due row;
 *  - a STOP that arrives during the window is honoured;
 *  - an opted-out / OFF / past-the-cap / stale lead is never acknowledged;
 *  - an invocation killed mid-flight leaves the lead due again rather than
 *    silently unacknowledged.
 *
 * The prisma mock here is stateful on purpose. A `vi.fn()` returning a
 * fixed `{ count: 1 }` would make every claim in this file succeed, which
 * is precisely the thing the race tests exist to disprove — so updateMany
 * evaluates its own WHERE against the row, exactly as Postgres would.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type LeadRow = {
  id: string;
  businessId: string;
  name: string;
  email: string | null;
  phone: string | null;
  automationTier: string;
  acknowledgedAt: Date | null;
  ackDueAt: Date | null;
  ackChannel: string | null;
  ackInboundText: string | null;
  ackInboundAt: Date | null;
  optedOutAt: Date | null;
  assignedToId: string | null;
  createdAt: Date;
  source: string | null;
};

const NOW = new Date("2026-09-16T12:00:00Z");

let lead: LeadRow;
let outboundMessage: { id: string } | null;
let notifications: { userId: string; leadId: string | null; message: string }[];
let businessRow: Record<string, unknown> | null;

function matches(where: Record<string, unknown>): boolean {
  if (typeof where.id === "string" && where.id !== lead.id) return false;
  if ("acknowledgedAt" in where && where.acknowledgedAt === null && lead.acknowledgedAt !== null) return false;
  const due = where.ackDueAt as { lte?: Date } | undefined;
  if (due?.lte) {
    if (!lead.ackDueAt) return false;
    if (lead.ackDueAt.getTime() > due.lte.getTime()) return false;
  }
  return true;
}

vi.mock("@/lib/db", () => ({
  prisma: {
    lead: {
      findUnique: vi.fn(async () => ({ ...lead })),
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => (matches(where) ? [{ id: lead.id }] : [])),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        if (!matches(where)) return { count: 0 };
        Object.assign(lead, data);
        return { count: 1 };
      }),
      count: vi.fn(async () => 1),
    },
    message: { findFirst: vi.fn(async () => outboundMessage) },
    automation: { findFirst: vi.fn(async () => null) },
    business: { findUnique: vi.fn(async () => businessRow) },
    user: { findMany: vi.fn(async () => [{ id: "admin1" }]) },
    notification: {
      create: vi.fn(async ({ data }: { data: { userId: string; leadId: string | null; message: string } }) => {
        notifications.push(data);
        return data;
      }),
    },
  },
}));
vi.mock("@/lib/integrations/openai", () => ({
  localizeFixedText: vi.fn(async (t: string) => t),
  generateInstantReply: vi.fn(async () => "Got it — I'll get you the exact price and follow up shortly."),
  assessAckRisk: vi.fn(async () => ({ verdict: "ok", reason: "ok" })),
}));
vi.mock("@/lib/sender", () => ({
  latestInboundText: vi.fn(() => undefined),
  getSenderFirstName: vi.fn(async () => "Manoj"),
  composeFollowUpEmail: vi.fn(async (first: string, _b: string, body: string) => `Hi ${first},\n\n${body}\n\nBest,\nManoj`),
}));
vi.mock("@/lib/sending", () => ({ sendFollowUpToLead: vi.fn(async () => ({ success: true })) }));
vi.mock("@/lib/suppression", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/suppression")>();
  return { ...actual, isSuppressed: vi.fn(async () => false) };
});

import { prisma } from "@/lib/db";
import { sendFollowUpToLead } from "@/lib/sending";
import { isSuppressed } from "@/lib/suppression";
import { generateInstantReply } from "@/lib/integrations/openai";
import { acknowledgeNewLead, runDueInstantAcks, DM_ACK_GRACE_PERIOD_MS, ACK_CLAIM_LEASE_MS } from "@/lib/acknowledge";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const send = sendFollowUpToLead as unknown as ReturnType<typeof vi.fn>;
const suppressed = isSuppressed as unknown as ReturnType<typeof vi.fn>;
const generateReply = generateInstantReply as unknown as ReturnType<typeof vi.fn>;

/** The DM that started it all, as the Instagram webhook would hand it over. */
async function inboundDm(channel: "instagram" | "messenger" | "whatsapp" = "instagram", text = "Is the roof original?") {
  return acknowledgeNewLead(lead.id, { channel, inboundText: text, inboundAt: new Date() });
}

/**
 * One cron tick, with the whole world's clock at `now` — not just the
 * query's. The staleness check and the lease both read Date.now(), so a
 * test that moved only the query time would be testing a clock that cannot
 * exist in production.
 */
function tick(now: Date = new Date(NOW.getTime() + DM_ACK_GRACE_PERIOD_MS)) {
  vi.setSystemTime(now);
  return runDueInstantAcks({ now });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  lead = {
    id: "lead1",
    businessId: "biz1",
    name: "Priya Shah",
    email: null,
    phone: "ig:17841400000000001",
    automationTier: "ASSISTED",
    acknowledgedAt: null,
    ackDueAt: null,
    ackChannel: null,
    ackInboundText: null,
    ackInboundAt: null,
    optedOutAt: null,
    assignedToId: null,
    createdAt: new Date("2026-09-16T11:59:00Z"),
    source: "Instagram",
  };
  outboundMessage = null;
  notifications = [];
  businessRow = { name: "MJ Homes", tier: "plus", subscriptionStatus: "active" };
  send.mockResolvedValue({ success: true });
  suppressed.mockResolvedValue(false);
  generateReply.mockResolvedValue("Got it — I'll get you the exact price and follow up shortly.");
});

describe("the two-minute wait itself", () => {
  it.each(["instagram", "messenger", "whatsapp"] as const)("parks a %s DM instead of replying to it", async (channel) => {
    const result = await acknowledgeNewLead("lead1", { channel, inboundText: "Is the roof original?", inboundAt: new Date() });

    expect(result.sent).toBe(false);
    expect(result.queuedFor).toEqual(new Date(NOW.getTime() + DM_ACK_GRACE_PERIOD_MS));
    expect(send).not.toHaveBeenCalled();
    // Not one model call at queue time either — the reply is written when
    // it is about to go out, against whatever the thread looks like then.
    expect(generateReply).not.toHaveBeenCalled();
    expect(lead.ackChannel).toBe(channel);
    expect(lead.ackInboundText).toBe("Is the roof original?");
    expect(lead.acknowledgedAt).toBeNull();
  });

  it("leaves SMS and email exactly as they were — this is a DM decision", async () => {
    lead.phone = "+15551234567";
    await acknowledgeNewLead("lead1", { channel: "text", inboundText: "Is the roof original?", inboundAt: new Date() });
    expect(send).toHaveBeenCalledTimes(1);
    expect(lead.ackDueAt).toBeNull();

    lead.acknowledgedAt = null;
    lead.email = "priya@example.com";
    await acknowledgeNewLead("lead1", { channel: "email", inboundText: "Is the roof original?", inboundAt: new Date() });
    expect(send).toHaveBeenCalledTimes(2);
    expect(lead.ackDueAt).toBeNull();
  });

  it("is not restarted by a chatty lead: a second DM refreshes the text, never the clock", async () => {
    await inboundDm("instagram", "hi");
    const firstDue = lead.ackDueAt;

    vi.setSystemTime(new Date(NOW.getTime() + 40_000));
    await inboundDm("instagram", "actually, how much for the roof?");

    expect(lead.ackDueAt).toEqual(firstDue);
    // The reply answers what they last said, not their "hi".
    expect(lead.ackInboundText).toBe("actually, how much for the roof?");
  });

  it("does nothing until the grace period is actually up", async () => {
    await inboundDm();
    const result = await tick(new Date(NOW.getTime() + 60_000));
    expect(result).toEqual({ claimed: 0, sent: 0, skipped: 0, retrying: 0 });
    expect(send).not.toHaveBeenCalled();
  });
});

describe("the owner replies inside the window", () => {
  // The entire point of the feature.
  it("sends nothing, because the outbound reply is looked for at send time", async () => {
    await inboundDm();
    // The owner answers from the Instagram app; the echo webhook records it
    // as an outbound message on the lead (captureDirectReply).
    outboundMessage = { id: "echo1" };

    const result = await tick();

    expect(result).toMatchObject({ claimed: 1, sent: 0, skipped: 1 });
    expect(send).not.toHaveBeenCalled();
    expect(notifications).toHaveLength(0);
    // Taken out of the queue rather than retried forever.
    expect(lead.ackDueAt).toBeNull();
    expect(lead.ackChannel).toBeNull();
  });

  it("proves the check is at send time, not queue time: the reply lands after the DM was queued", async () => {
    outboundMessage = null;
    await inboundDm();
    expect(p.message.findFirst).not.toHaveBeenCalled(); // nothing was checked when it was queued

    outboundMessage = { id: "echo1" };
    await tick();

    expect(p.message.findFirst).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("the owner does not reply", () => {
  it("sends the acknowledgement on the channel the lead used, once", async () => {
    await inboundDm("instagram");
    const result = await tick();

    expect(result).toMatchObject({ claimed: 1, sent: 1, skipped: 0 });
    expect(send).toHaveBeenCalledTimes(1);
    const [leadId, body, opts] = send.mock.calls[0];
    expect(leadId).toBe("lead1");
    expect(body).toBe("Hi! Got it — I'll get you the exact price and follow up shortly.");
    expect(opts).toMatchObject({ automated: true, channel: "instagram", trigger: "instant_ack" });
    expect(lead.acknowledgedAt).toBeInstanceOf(Date);
    expect(lead.ackDueAt).toBeNull();
  });

  it("tells the owner what happened, to whom, and what it said", async () => {
    await inboundDm("instagram");
    await tick();

    expect(notifications).toHaveLength(1);
    expect(notifications[0].leadId).toBe("lead1");
    expect(notifications[0].message).toBe(
      'Priya Shah messaged on Instagram and hadn\'t heard back after 2 minutes, so FollowUp replied for you: ' +
        '"Hi! Got it — I\'ll get you the exact price and follow up shortly." Check the thread.'
    );
  });

  it("notifies the assignee when the lead has one, rather than every admin", async () => {
    lead.assignedToId = "user7";
    await inboundDm();
    await tick();

    expect(notifications.map((n) => n.userId)).toEqual(["user7"]);
    expect(p.user.findMany).not.toHaveBeenCalled();
  });

  it("names the right channel on Messenger and WhatsApp", async () => {
    await inboundDm("whatsapp");
    await tick();
    expect(notifications[0].message).toContain("messaged on WhatsApp");
  });
});

describe("exactly once per lead, ever", () => {
  it("two ticks racing the same due lead: one claims it, one walks away", async () => {
    await inboundDm();

    const due = new Date(NOW.getTime() + DM_ACK_GRACE_PERIOD_MS);
    const [first, second] = await Promise.all([tick(due), tick(due)]);

    expect(first.claimed + second.claimed).toBe(1);
    expect(first.sent + second.sent).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(notifications).toHaveLength(1);
  });

  it("a claim is a lease, so the loser's tick never even reaches the ack", async () => {
    await inboundDm();
    const due = new Date(NOW.getTime() + DM_ACK_GRACE_PERIOD_MS);

    await tick(due); // claims, sends, clears
    const second = await tick(due); // the row is gone from the queue

    expect(second).toEqual({ claimed: 0, sent: 0, skipped: 0, retrying: 0 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("refuses a lead something else acknowledged while it sat in the queue", async () => {
    await inboundDm();
    lead.acknowledgedAt = new Date(); // e.g. the same person also emailed

    const result = await tick();

    expect(send).not.toHaveBeenCalled();
    // Still taken out of the queue — a due timestamp nothing will ever act
    // on would sit in the index forever.
    expect(result).toMatchObject({ claimed: 1, sent: 0, skipped: 1 });
    expect(lead.ackDueAt).toBeNull();
  });
});

describe("the guarantees are re-checked at send time, not at queue time", () => {
  it("honours a STOP that arrives during the window (DM suppression)", async () => {
    await inboundDm("instagram");
    // The lead DMs "stop" a minute later: the webhook writes a Suppression
    // row and, having opted them out, does not re-queue anything — so this
    // already-queued acknowledgement is the only thing left that could
    // reply to someone who just asked us not to.
    suppressed.mockResolvedValue(true);

    const result = await tick();

    expect(send).not.toHaveBeenCalled();
    expect(notifications).toHaveLength(0);
    expect(result).toMatchObject({ sent: 0, skipped: 1 });
    // Not marked acknowledged: a later START should still get a real first reply.
    expect(lead.acknowledgedAt).toBeNull();
    expect(lead.ackDueAt).toBeNull();
  });

  it("honours a WhatsApp STOP recorded on the lead during the window", async () => {
    lead.phone = "+15551234567";
    lead.source = "WhatsApp";
    await inboundDm("whatsapp");
    lead.optedOutAt = new Date();

    await tick();

    expect(send).not.toHaveBeenCalled();
    expect(lead.acknowledgedAt).toBeNull();
  });

  it("honours a lead switched to OFF during the window", async () => {
    await inboundDm();
    lead.automationTier = "OFF";
    await tick();
    expect(send).not.toHaveBeenCalled();
  });

  it("honours the business switch being turned off during the window", async () => {
    await inboundDm();
    p.automation.findFirst.mockResolvedValue({ enabled: false });
    await tick();
    expect(send).not.toHaveBeenCalled();
    p.automation.findFirst.mockResolvedValue(null);
  });

  it("honours the tier's AI cap at send time, spending nothing on a lead past it", async () => {
    await inboundDm();
    businessRow = { name: "MJ Homes", tier: "free", subscriptionStatus: null };
    p.lead.count.mockResolvedValue(21);

    await tick();

    expect(generateReply).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(lead.acknowledgedAt).toBeNull(); // still unclaimed, so next month still works
    p.lead.count.mockResolvedValue(1);
  });

  it("never acknowledges an inbound that has gone stale while queued", async () => {
    await inboundDm();
    // Two hours of missed ticks — a cheerful "we got your message" now is
    // worse than none, and automation.ts's neglect pass owns the lead.
    await tick(new Date(NOW.getTime() + 2 * 60 * 60_000));

    expect(send).not.toHaveBeenCalled();
    expect(lead.ackDueAt).toBeNull();
    expect(lead.acknowledgedAt).toBeNull();
  });
});

describe("when a tick dies or fails", () => {
  it("keeps the lead queued when the attempt errored rather than decided", async () => {
    await inboundDm();
    p.business.findUnique.mockRejectedValueOnce(new Error("database connection lost"));

    const result = await tick();

    expect(result).toMatchObject({ claimed: 1, sent: 0, retrying: 1 });
    expect(send).not.toHaveBeenCalled();
    // Still in the queue, one lease out — this is what stops a blip costing
    // the lead its acknowledgement entirely.
    expect(lead.ackDueAt).toEqual(new Date(NOW.getTime() + DM_ACK_GRACE_PERIOD_MS + ACK_CLAIM_LEASE_MS));
    expect(lead.ackChannel).toBe("instagram");
  });

  it("sends it on the next tick once the lease is up", async () => {
    await inboundDm();
    p.business.findUnique.mockRejectedValueOnce(new Error("database connection lost"));
    await tick();

    const later = new Date(NOW.getTime() + DM_ACK_GRACE_PERIOD_MS + ACK_CLAIM_LEASE_MS);
    vi.setSystemTime(later);
    const result = await tick(later);

    expect(result).toMatchObject({ claimed: 1, sent: 1 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(notifications).toHaveLength(1);
  });

  it("does not notify the owner about a message that failed to send", async () => {
    await inboundDm();
    send.mockResolvedValue({ success: false, message: "Instagram token expired" });

    await tick();

    expect(notifications).toHaveLength(0);
    // The claim is released by acknowledgeNewLead so a working channel can
    // still acknowledge this lead later.
    expect(lead.acknowledgedAt).toBeNull();
  });
});

/**
 * The head start runs from when the LEAD WROTE, not from when FollowUp
 * noticed. Those were the same instant while a webhook was the only way a
 * DM arrived. Since the conversation poller also asks Meta every few
 * minutes (src/lib/instagramPoll.ts, added because Meta's push proved
 * unreliable), they are not — and measuring from "now" made the two waits
 * stack. Seen live on 2026-09-19: a DM sent at 19:07:42 and found at
 * 19:09:06 was queued for 19:11:06, three and a half minutes after a lead
 * who expects a business to be awake.
 */
describe("a DM found late does not wait twice", () => {
  it("measures the grace period from the inbound, not from when it was queued", async () => {
    const wroteAt = new Date(NOW.getTime() - 84_000);
    const result = await acknowledgeNewLead(lead.id, { channel: "instagram", inboundText: "Is the roof original?", inboundAt: wroteAt });
    expect(result.queuedFor).toEqual(new Date(wroteAt.getTime() + DM_ACK_GRACE_PERIOD_MS));
    expect(lead.ackDueAt).toEqual(new Date(wroteAt.getTime() + DM_ACK_GRACE_PERIOD_MS));
  });

  it("is due immediately when the head start already elapsed before the poll found it", async () => {
    const wroteAt = new Date(NOW.getTime() - 3 * 60_000);
    await acknowledgeNewLead(lead.id, { channel: "instagram", inboundText: "Is the roof original?", inboundAt: wroteAt });
    expect(lead.ackDueAt!.getTime()).toBeLessThan(NOW.getTime());

    // So the very next tick sends it, rather than starting another wait.
    const result = await tick(NOW);
    expect(result).toMatchObject({ claimed: 1, sent: 1 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("still measures from now when no inbound time is given", async () => {
    const result = await acknowledgeNewLead(lead.id, { channel: "instagram", inboundText: "Is the roof original?" });
    expect(result.queuedFor).toEqual(new Date(NOW.getTime() + DM_ACK_GRACE_PERIOD_MS));
  });
});
