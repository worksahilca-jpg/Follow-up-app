/**
 * The same words, to the same person, twice.
 *
 * Found in production on 2026-09-20 while hunting for the next bug: a
 * real lead received the identical 409-character follow-up twice. Two
 * different Gmail message ids, identical body hash — two genuinely
 * delivered emails, not one email recorded twice.
 *
 * Nothing stopped it. sendFollowUpToLead guards volume, consent and
 * channel; the send route adds a rate limit of 60 actions per 10 minutes.
 * None of that is duplicate protection, and the approval queue's disabled
 * Send button is client-side only — a second tab, a slow network with an
 * impatient second click, or a retry all defeat it.
 *
 * It matters more now than it did last week. As of today every message on
 * a beta account goes out through a human pressing Send in Approvals, so
 * this path is THE path, and a double-tap is the likeliest way a real
 * customer gets messaged twice.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { messageCount, leadFindUnique } = vi.hoisted(() => ({
  messageCount: vi.fn(),
  leadFindUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    message: { count: messageCount, create: vi.fn(), findFirst: vi.fn() },
    lead: { findUnique: leadFindUnique, update: vi.fn() },
    conversation: { findFirst: vi.fn(), create: vi.fn() },
    business: { findUnique: vi.fn(async () => ({ name: "MJ Homes", tier: "plus" })) },
    followUp: { create: vi.fn() },
  },
}));
vi.mock("@/lib/sender", () => ({
  sendEmail: vi.fn(async () => ({ success: true })),
  getSenderFirstName: vi.fn(async () => "Sahil"),
  composeFollowUpEmail: vi.fn(async (_f: string, _b: string, body: string) => body),
  latestInboundText: vi.fn(() => undefined),
}));
vi.mock("@/lib/suppression", () => ({
  isSuppressed: vi.fn(async () => false),
  dmSuppressionKey: vi.fn(() => null),
}));
vi.mock("@/lib/sendCaps", () => ({ checkSendCap: vi.fn(async () => ({ allowed: true })) }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));

import { sendFollowUpToLead } from "@/lib/sending";

const BODY = "Hi Dipu,\n\nThank you for reaching out about our rental properties in Etobicoke.";

beforeEach(() => {
  messageCount.mockReset();
  leadFindUnique.mockResolvedValue({
    id: "lead1",
    businessId: "biz1",
    name: "Dipu Prajapati",
    email: "dipu@example.com",
    phone: null,
    optedOutAt: null,
    automationTier: "ASSISTED",
    createdAt: new Date(),
    source: "Gmail",
    conversations: [],
  });
});

describe("the same message is not sent twice in a row", () => {
  it("refuses when that exact body went to this lead moments ago", async () => {
    // The duplicate-window lookup finds the message from seconds earlier.
    messageCount.mockResolvedValue(1);

    const result = await sendFollowUpToLead("lead1", BODY, { trigger: "manual" });

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/already went to this lead/);
  });

  it("marks it refused, not transient — retrying is the thing being prevented", async () => {
    messageCount.mockResolvedValue(1);
    const result = await sendFollowUpToLead("lead1", BODY, { trigger: "manual" });
    // "transient" would put it in the outbound retry queue, which would
    // send the duplicate a few minutes later — the exact opposite.
    expect(result.failure).toBe("refused");
  });

  it("looks for the exact body on this lead, inside a window", async () => {
    messageCount.mockResolvedValue(1);
    await sendFollowUpToLead("lead1", BODY, { trigger: "manual" });

    const where = messageCount.mock.calls[0][0].where;
    expect(where.conversation).toEqual({ leadId: "lead1" });
    expect(where.direction).toBe("outbound");
    expect(where.body).toBe(BODY);
    // A window, not "ever" — a genuine resend minutes later must still go.
    expect(where.sentAt.gte).toBeInstanceOf(Date);
    expect(Date.now() - where.sentAt.gte.getTime()).toBeLessThanOrEqual(61_000);
  });

  it("does not block a lead who has had no recent outbound", async () => {
    messageCount.mockResolvedValue(0);
    const result = await sendFollowUpToLead("lead1", BODY, { trigger: "manual" });
    // Gets past the duplicate guard — whatever happens after is the rest
    // of the funnel's business, not this rule's.
    expect(result.message).not.toMatch(/already went to this lead/);
  });
});
