/**
 * The two endpoints that put src/lib/reactivation.ts in front of a user.
 *
 * What's worth asserting here isn't the bucketing (quietOutcome.test.ts
 * owns that) — it's the gates. Every one of these tests is a thing that,
 * if it broke, would either show one business another business's dropped
 * conversations, or let an unbounded OpenAI bill be run up on the
 * platform's shared key by someone who isn't paying for it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { getSessionContext, requireAdmin } = vi.hoisted(() => ({
  getSessionContext: vi.fn(),
  requireAdmin: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));

const { getReactivationBatch, classifyQuietLeads } = vi.hoisted(() => ({
  getReactivationBatch: vi.fn(),
  classifyQuietLeads: vi.fn(),
}));
vi.mock("@/lib/reactivation", () => ({ getReactivationBatch, classifyQuietLeads }));

const { businessFindUnique } = vi.hoisted(() => ({ businessFindUnique: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { business: { findUnique: businessFindUnique } } }));

const { tooManyRecentActions } = vi.hoisted(() => ({ tooManyRecentActions: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions }));

const { recordAudit } = vi.hoisted(() => ({ recordAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/audit", () => ({ recordAudit }));

import { GET } from "@/app/api/reactivation/batch/route";
import { POST } from "@/app/api/reactivation/classify/route";

const emptyBucket = { total: 0, leads: [] };
const batch = {
  cold: { total: 2, leads: [{ id: "lead-1", name: "Dana", email: "d@x.com", lastContacted: new Date(), reason: "Quote never answered." }] },
  neverReplied: emptyBucket,
  closed: emptyBucket,
  offPlatform: emptyBucket,
  unclear: emptyBucket,
  unjudged: 7,
};

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz-1", userId: "user-1", email: "owner@acme.com", authTime: Date.now() });
  requireAdmin.mockResolvedValue(true);
  businessFindUnique.mockResolvedValue({ subscriptionStatus: "active" });
  tooManyRecentActions.mockResolvedValue(false);
  getReactivationBatch.mockResolvedValue(batch);
  classifyQuietLeads.mockResolvedValue({ classified: 12, remaining: 188, failed: 1 });
});

describe("GET /api/reactivation/batch", () => {
  it("401s when nobody is signed in, and never reads any lead", async () => {
    getSessionContext.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(getReactivationBatch).not.toHaveBeenCalled();
  });

  // The whole of multi-tenancy for this route in one line: the businessId
  // is the session's, and there is no request input that could override it.
  it("asks only for the signed-in user's own business", async () => {
    getSessionContext.mockResolvedValue({ businessId: "biz-2", userId: "u", email: "e@x.com", authTime: 0 });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(getReactivationBatch).toHaveBeenCalledWith("biz-2");
    expect(getReactivationBatch).toHaveBeenCalledTimes(1);
  });

  it("returns the buckets and the unjudged count", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.batch.cold.total).toBe(2);
    expect(body.batch.unjudged).toBe(7);
  });

  // A rep's own dropped conversations must not be admin-only, and a
  // read that spends nothing must not be behind the billing gate — a
  // business whose card just failed should still see what it has.
  it("is open to a non-admin member and to a lapsed subscription", async () => {
    requireAdmin.mockResolvedValue(false);
    businessFindUnique.mockResolvedValue({ subscriptionStatus: "past_due" });
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("fails with a message rather than a stack trace", async () => {
    getReactivationBatch.mockRejectedValue(new Error("db down"));
    const res = await GET();
    expect(res.status).toBe(500);
    expect((await res.json()).success).toBe(false);
  });
});

describe("POST /api/reactivation/classify", () => {
  it("401s when nobody is signed in, before spending anything", async () => {
    getSessionContext.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
    expect(classifyQuietLeads).not.toHaveBeenCalled();
  });

  // "Should we pay to judge the whole back catalogue" is an account-level
  // decision, and the cron drains the same backlog anyway — so a rep
  // losing this button costs nothing.
  it("403s a non-admin member without calling OpenAI", async () => {
    requireAdmin.mockResolvedValue(false);
    const res = await POST();
    expect(res.status).toBe(403);
    expect(classifyQuietLeads).not.toHaveBeenCalled();
  });

  it("402s a business with no live paid subscription, with the reason why", async () => {
    businessFindUnique.mockResolvedValue({ subscriptionStatus: "past_due" });
    const res = await POST();
    expect(res.status).toBe(402);
    expect((await res.json()).message).toMatch(/payment didn't go through/i);
    expect(classifyQuietLeads).not.toHaveBeenCalled();
  });

  // Free tier's defining cap is that AI processing stops after 20 leads a
  // month. An unbounded back-catalogue classification on the shared
  // OpenAI key is exactly what that cap exists to prevent — so unlike
  // most gated routes, this one must NOT fall through on tier "free".
  it("does not let Free tier classify a back catalogue", async () => {
    businessFindUnique.mockResolvedValue({ subscriptionStatus: null, tier: "free" });
    const res = await POST();
    expect(res.status).toBe(402);
    expect(classifyQuietLeads).not.toHaveBeenCalled();
  });

  it("only ever reads the plain billing column off Business, never the encrypted row", async () => {
    await POST();
    expect(businessFindUnique).toHaveBeenCalledWith({ where: { id: "biz-1" }, select: { subscriptionStatus: true } });
  });

  it("429s when the business is over the rate limit, without calling OpenAI", async () => {
    tooManyRecentActions.mockResolvedValue(true);
    const res = await POST();
    expect(res.status).toBe(429);
    expect(classifyQuietLeads).not.toHaveBeenCalled();
  });

  // The limiter must be the shared atomic one, keyed per business — a
  // per-process counter would be defeated by two serverless instances.
  it("uses the shared per-business limiter", async () => {
    await POST();
    expect(tooManyRecentActions).toHaveBeenCalledWith("biz-1", "reactivation-classify", { windowMinutes: 10, max: 6 });
  });

  it("classifies only the signed-in user's own business", async () => {
    getSessionContext.mockResolvedValue({ businessId: "biz-9", userId: "u", email: "e@x.com", authTime: 0 });
    await POST();
    expect(classifyQuietLeads).toHaveBeenCalledWith("biz-9");
  });

  // The progress contract the client polls on: one batch per call, and
  // `remaining` says whether to call again.
  it("returns one batch's result including what it did not reach", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, classified: 12, remaining: 188, failed: 1 });
  });

  it("records who asked for the pass", async () => {
    await POST();
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: "biz-1" }),
      "ai.quiet_outcome_classify_run",
      expect.objectContaining({ meta: expect.objectContaining({ classified: 12 }) })
    );
  });

  it("fails with a message rather than a stack trace", async () => {
    classifyQuietLeads.mockRejectedValue(new Error("openai exploded"));
    const res = await POST();
    expect(res.status).toBe(500);
    expect((await res.json()).success).toBe(false);
  });
});
