/**
 * The rate limits added in the 2026-09-26 perimeter pass
 * (research/audit/2026-09-26-security-hardening-perimeter.md §2).
 *
 * What is being defended, per route:
 *   - POST /api/book/[leadId]: public. One booking link must not be able to
 *     take every open slot on a business's calendar (audit 2026-09-16, M-2).
 *   - POST /api/automation/run, /api/sequences/run: one button each, but a
 *     whole business's worth of AI drafting behind it on the shared key.
 *   - POST /api/team/invites: each invite can send an email from the
 *     business's mailbox.
 *   - POST /api/feedback: rows are later read into the founder's notes.
 *
 * And, just as load-bearing: under the limit, each route does exactly what
 * it did before — the limit is never what a real person meets.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  getSessionContext: vi.fn(),
  tooManyRecentActions: vi.fn(),
  leadFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  feedbackCreate: vi.fn(),
  requireActiveBilling: vi.fn(),
  runAutomationForBusiness: vi.fn(),
  runSequencesForBusiness: vi.fn(),
  inviteMember: vi.fn(),
  createBooking: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSessionContext: h.getSessionContext }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions: h.tooManyRecentActions }));
vi.mock("@/lib/db", () => ({
  prisma: {
    lead: { findUnique: h.leadFindUnique },
    user: { findUnique: h.userFindUnique },
    productFeedback: { create: h.feedbackCreate },
  },
}));
vi.mock("@/lib/billing", () => ({
  requireActiveBilling: h.requireActiveBilling,
  billingLockedMessage: async () => "Billing is locked.",
}));
vi.mock("@/lib/automation", () => ({ runAutomationForBusiness: h.runAutomationForBusiness }));
vi.mock("@/lib/sequences", () => ({ runSequencesForBusiness: h.runSequencesForBusiness }));
vi.mock("@/lib/team", () => ({ inviteMember: h.inviteMember }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn(async () => undefined) }));
vi.mock("@/lib/booking", () => ({
  getBookingContext: vi.fn(),
  getAvailableSlots: vi.fn(),
  createBooking: h.createBooking,
}));

import { POST as bookPOST } from "@/app/api/book/[leadId]/route";
import { POST as automationRunPOST } from "@/app/api/automation/run/route";
import { POST as sequencesRunPOST } from "@/app/api/sequences/run/route";
import { POST as invitePOST } from "@/app/api/team/invites/route";
import { POST as feedbackPOST } from "@/app/api/feedback/route";

type AnyReq = Parameters<typeof bookPOST>[0];
const req = (body: unknown) => ({ json: async () => body }) as unknown as AnyReq;
const leadParams = { params: Promise.resolve({ leadId: "lead1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  h.getSessionContext.mockResolvedValue({ userId: "user1", businessId: "biz1", email: "owner@shop.test", authTime: 0 });
  h.tooManyRecentActions.mockResolvedValue(false);
  h.requireActiveBilling.mockResolvedValue(true);
  h.leadFindUnique.mockResolvedValue({ businessId: "biz1" });
  h.userFindUnique.mockResolvedValue({ name: "Owner" });
  h.feedbackCreate.mockResolvedValue({});
  h.runAutomationForBusiness.mockResolvedValue({ checked: 0, sent: 0 });
  h.runSequencesForBusiness.mockResolvedValue({ ran: 0 });
  h.inviteMember.mockResolvedValue({ success: true });
  h.createBooking.mockResolvedValue({ success: true, scheduledAt: "2026-10-01T15:00:00.000Z" });
});

describe("POST /api/book/[leadId] — public booking", () => {
  it("books normally under the limit, and keys the limit to the lead's own business", async () => {
    const res = await bookPOST(req({ scheduledAt: "2026-10-01T15:00:00.000Z" }), leadParams);
    expect(res.status).toBe(200);
    expect(h.createBooking).toHaveBeenCalledWith("lead1", "2026-10-01T15:00:00.000Z");
    expect(h.tooManyRecentActions).toHaveBeenCalledWith("biz1", "book.create:lead1", { windowMinutes: 60, max: 10 });
    expect(h.tooManyRecentActions).toHaveBeenCalledWith("biz1", "book.create", { windowMinutes: 60, max: 60 });
  });

  it("refuses with 429 and creates nothing once one link has hit its limit", async () => {
    h.tooManyRecentActions.mockImplementation(async (_b: string, key: string) => key === "book.create:lead1");
    const res = await bookPOST(req({ scheduledAt: "2026-10-01T15:00:00.000Z" }), leadParams);
    expect(res.status).toBe(429);
    expect(h.createBooking).not.toHaveBeenCalled();
  });

  it("refuses with 429 once the business as a whole has hit its limit", async () => {
    h.tooManyRecentActions.mockImplementation(async (_b: string, key: string) => key === "book.create");
    const res = await bookPOST(req({ scheduledAt: "2026-10-01T15:00:00.000Z" }), leadParams);
    expect(res.status).toBe(429);
    expect(h.createBooking).not.toHaveBeenCalled();
  });

  it("answers an unknown link exactly as before (409, same words) without touching the limiter", async () => {
    h.leadFindUnique.mockResolvedValue(null);
    const res = await bookPOST(req({ scheduledAt: "2026-10-01T15:00:00.000Z" }), leadParams);
    expect(res.status).toBe(409);
    expect((await res.json()).message).toBe("This booking link isn't valid.");
    expect(h.tooManyRecentActions).not.toHaveBeenCalled();
  });

  it("refuses an oversized scheduledAt with a 400 before any booking work", async () => {
    const res = await bookPOST(req({ scheduledAt: "x".repeat(65) }), leadParams);
    expect(res.status).toBe(400);
    expect(h.createBooking).not.toHaveBeenCalled();
  });
});

describe("manual AI runs", () => {
  it("automation/run runs under the limit and refuses with 429 over it", async () => {
    expect((await automationRunPOST()).status).toBe(200);
    expect(h.tooManyRecentActions).toHaveBeenCalledWith("biz1", "automation.run", { windowMinutes: 10, max: 10 });
    h.tooManyRecentActions.mockResolvedValue(true);
    h.runAutomationForBusiness.mockClear();
    expect((await automationRunPOST()).status).toBe(429);
    expect(h.runAutomationForBusiness).not.toHaveBeenCalled();
  });

  it("sequences/run runs under the limit and refuses with 429 over it", async () => {
    expect((await sequencesRunPOST()).status).toBe(200);
    expect(h.tooManyRecentActions).toHaveBeenCalledWith("biz1", "sequences.run", { windowMinutes: 10, max: 10 });
    h.tooManyRecentActions.mockResolvedValue(true);
    h.runSequencesForBusiness.mockClear();
    expect((await sequencesRunPOST()).status).toBe(429);
    expect(h.runSequencesForBusiness).not.toHaveBeenCalled();
  });
});

describe("POST /api/team/invites", () => {
  it("invites under the limit and refuses with 429 over it", async () => {
    expect((await invitePOST(req({ email: "new@shop.test" }))).status).toBe(201);
    expect(h.tooManyRecentActions).toHaveBeenCalledWith("biz1", "team.invite", { windowMinutes: 60, max: 30 });
    h.tooManyRecentActions.mockResolvedValue(true);
    h.inviteMember.mockClear();
    expect((await invitePOST(req({ email: "new@shop.test" }))).status).toBe(429);
    expect(h.inviteMember).not.toHaveBeenCalled();
  });

  it("refuses an address longer than any real one can be", async () => {
    const res = await invitePOST(req({ email: `${"a".repeat(400)}@shop.test` }));
    expect(res.status).toBe(400);
    expect(h.inviteMember).not.toHaveBeenCalled();
  });
});

describe("POST /api/feedback", () => {
  it("saves under the limit, keyed per person, and refuses with 429 over it", async () => {
    expect((await feedbackPOST(req({ message: "Love it" }))).status).toBe(200);
    expect(h.tooManyRecentActions).toHaveBeenCalledWith("biz1", "feedback:user1", { windowMinutes: 10, max: 10 });
    h.tooManyRecentActions.mockResolvedValue(true);
    h.feedbackCreate.mockClear();
    expect((await feedbackPOST(req({ message: "Love it" }))).status).toBe(429);
    expect(h.feedbackCreate).not.toHaveBeenCalled();
  });

  it("still answers a signed-out caller 401 before counting anything", async () => {
    h.getSessionContext.mockResolvedValue(null);
    expect((await feedbackPOST(req({ message: "hi" }))).status).toBe(401);
    expect(h.tooManyRecentActions).not.toHaveBeenCalled();
  });
});
