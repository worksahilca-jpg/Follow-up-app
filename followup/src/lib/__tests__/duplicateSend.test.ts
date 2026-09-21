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
 *
 * ## Why this file was rewritten on 2026-09-21
 *
 * The first guard counted recent outbound Message rows with the same body
 * and then decided — and this file tested it by stubbing that count, which
 * could only ever ask "does it refuse when told a duplicate exists?". It
 * could not ask the question that actually mattered: what happens when two
 * requests arrive at once and the count is zero for both. That is a race,
 * and every cause listed above IS a race.
 *
 * So the fake below is not a stub returning a number. It is an in-memory
 * stand-in for the unique index on SendClaim(leadId, bodyHash): `create`
 * throws Prisma's P2002 on a key that already exists, and `updateMany`
 * honours the `claimedAt` predicate that re-takes a claim only once its
 * window has passed. That is enough to run two sends concurrently and
 * assert that exactly one of them reaches the wire.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { claims, sendEmailMock, leadFindUnique, advanceClaimAge } = vi.hoisted(() => {
  /** key -> claimedAt. Stands in for the unique index on (leadId, bodyHash). */
  const claims = new Map<string, Date>();

  return {
    claims,
    sendEmailMock: vi.fn(async (): Promise<{ success: boolean; message?: string }> => ({ success: true })),
    leadFindUnique: vi.fn(),
    /** Push every held claim back in time, to test the expiry path. */
    advanceClaimAge: (ms: number) => {
      for (const [key, at] of claims) claims.set(key, new Date(at.getTime() - ms));
    },
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    // The real constraint, in memory. `create` rejecting with P2002 is the
    // whole mechanism under test — a fake that silently overwrote would
    // pass every assertion below while proving nothing.
    sendClaim: {
      create: vi.fn(async ({ data }: { data: { leadId: string; bodyHash: string } }) => {
        const key = `${data.leadId}|${data.bodyHash}`;
        if (claims.has(key)) {
          const err = new Error("Unique constraint failed on the fields: (`leadId`,`bodyHash`)");
          (err as Error & { code: string }).code = "P2002";
          throw err;
        }
        claims.set(key, new Date());
        return { id: "claim", ...data, claimedAt: claims.get(key) };
      }),
      updateMany: vi.fn(
        async ({
          where,
        }: {
          where: { leadId: string; bodyHash: string; claimedAt: { lt: Date } };
        }) => {
          const key = `${where.leadId}|${where.bodyHash}`;
          const held = claims.get(key);
          // The predicate is part of the write in Postgres — only a claim
          // older than the window is re-takeable.
          if (!held || held.getTime() >= where.claimedAt.lt.getTime()) return { count: 0 };
          claims.set(key, new Date());
          return { count: 1 };
        }
      ),
      deleteMany: vi.fn(async ({ where }: { where: { leadId: string; bodyHash: string } }) => {
        const key = `${where.leadId}|${where.bodyHash}`;
        const had = claims.delete(key);
        return { count: had ? 1 : 0 };
      }),
    },
    message: { count: vi.fn(async () => 0), create: vi.fn(), findFirst: vi.fn() },
    lead: { findUnique: leadFindUnique, update: vi.fn() },
    conversation: { findFirst: vi.fn(), create: vi.fn() },
    business: { findUnique: vi.fn(async () => ({ name: "MJ Homes", tier: "plus" })) },
    followUp: { create: vi.fn() },
    outboundSend: { findFirst: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/sender", () => ({
  sendEmail: sendEmailMock,
  getSenderFirstName: vi.fn(async () => "Sahil"),
  composeFollowUpEmail: vi.fn(async (_f: string, _b: string, body: string) => body),
  latestInboundText: vi.fn(() => undefined),
}));
vi.mock("@/lib/integrations/gmail", () => ({
  sendEmail: sendEmailMock,
  getGmailStatus: vi.fn(async () => ({ connected: true })),
}));
vi.mock("@/lib/integrations/outlook", () => ({
  sendOutlookEmail: vi.fn(async () => ({ success: true })),
  getOutlookStatus: vi.fn(async () => ({ connected: false })),
}));
vi.mock("@/lib/suppression", () => ({
  isSuppressed: vi.fn(async () => false),
  dmSuppressionKey: vi.fn(() => null),
}));
vi.mock("@/lib/sendCaps", () => ({ checkSendCap: vi.fn(async () => ({ allowed: true })) }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));

import { sendFollowUpToLead } from "@/lib/sending";
import { SEND_CLAIM_WINDOW_MS } from "@/lib/sendClaim";

const BODY = "Hi Dipu,\n\nThank you for reaching out about our rental properties in Etobicoke.";

beforeEach(() => {
  claims.clear();
  sendEmailMock.mockClear();
  sendEmailMock.mockResolvedValue({ success: true });
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
  it("refuses the second send of that exact body moments later", async () => {
    const first = await sendFollowUpToLead("lead1", BODY, { trigger: "manual" });
    const second = await sendFollowUpToLead("lead1", BODY, { trigger: "manual" });

    expect(first.success).toBe(true);
    expect(second.success).toBe(false);
    expect(second.message).toMatch(/already went to this lead/);
  });

  it("marks it refused, not transient — retrying is the thing being prevented", async () => {
    await sendFollowUpToLead("lead1", BODY, { trigger: "manual" });
    const second = await sendFollowUpToLead("lead1", BODY, { trigger: "manual" });
    // "transient" would put it in the outbound retry queue, which would
    // send the duplicate a few minutes later — the exact opposite.
    expect(second.failure).toBe("refused");
  });

  /**
   * The test the old count-based guard could not express, and the reason
   * the guard was rewritten: two callers arriving together.
   *
   * Under the old rule both would read a count of zero and both would
   * send. Here they contend for one row, and the loser never reaches the
   * provider at all — which is what `sendEmail` being called once proves.
   */
  it("sends once when two identical requests arrive at the same time", async () => {
    const [a, b] = await Promise.all([
      sendFollowUpToLead("lead1", BODY, { trigger: "manual" }),
      sendFollowUpToLead("lead1", BODY, { trigger: "manual" }),
    ]);

    expect([a.success, b.success].filter(Boolean)).toHaveLength(1);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("lets a different message to the same lead through immediately", async () => {
    await sendFollowUpToLead("lead1", BODY, { trigger: "manual" });
    const other = await sendFollowUpToLead("lead1", `${BODY} One more thing —`, { trigger: "manual" });

    expect(other.success).toBe(true);
  });

  it("lets the same message to a DIFFERENT lead through", async () => {
    await sendFollowUpToLead("lead1", BODY, { trigger: "manual" });
    leadFindUnique.mockResolvedValue({
      id: "lead2",
      businessId: "biz1",
      name: "Ana Ruiz",
      email: "ana@example.com",
      phone: null,
      optedOutAt: null,
      automationTier: "ASSISTED",
      createdAt: new Date(),
      source: "Gmail",
      conversations: [],
    });

    const result = await sendFollowUpToLead("lead2", BODY, { trigger: "manual" });
    expect(result.success).toBe(true);
  });

  it("allows a genuine resend once the window has passed", async () => {
    await sendFollowUpToLead("lead1", BODY, { trigger: "manual" });
    // A window, not "ever" — "sorry, resending that" minutes later is a
    // real thing people do, and blocking it would be its own bug.
    advanceClaimAge(SEND_CLAIM_WINDOW_MS + 1_000);

    const result = await sendFollowUpToLead("lead1", BODY, { trigger: "manual" });
    expect(result.success).toBe(true);
  });

  it("does not block a retry after the provider failed", async () => {
    sendEmailMock.mockResolvedValueOnce({ success: false, message: "Gmail said no." });

    const failed = await sendFollowUpToLead("lead1", BODY, { trigger: "manual" });
    expect(failed.success).toBe(false);

    // Nothing reached the lead, so the claim must have been given back —
    // otherwise a person pressing Send again after being told it failed
    // would be refused for a minute for no reason.
    const retry = await sendFollowUpToLead("lead1", BODY, { trigger: "manual" });
    expect(retry.success).toBe(true);
  });
});
