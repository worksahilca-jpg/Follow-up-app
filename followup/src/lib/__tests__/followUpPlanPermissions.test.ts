/**
 * Follow-up plans (founder, 2026-09-27: "only admins can create follow-up
 * plans"). A teammate used to be able to write a plan and enrol customers,
 * and the hourly run then sent with no admin involved, sidestepping "Only
 * admins send" (A-041, audit 2026-09-27).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const ctx = { userId: "u1", businessId: "b1", email: "rep@example.com", authTime: Date.now() };
const { isAdmin, refusal, createSequence, updateSequence, deleteSequence, enrollLead, runSequencesForBusiness } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  refusal: vi.fn(),
  createSequence: vi.fn(),
  updateSequence: vi.fn(),
  deleteSequence: vi.fn(),
  enrollLead: vi.fn(),
  runSequencesForBusiness: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSessionContext: vi.fn(async () => ctx), requireAdmin: isAdmin }));
vi.mock("@/lib/sendingControl", () => ({ sendRefusal: refusal }));
vi.mock("@/lib/billing", () => ({ requireActiveBilling: vi.fn(async () => true), billingLockedMessage: vi.fn(async () => "") }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions: vi.fn(async () => false) }));
vi.mock("@/lib/sequences", () => ({
  getSequences: vi.fn(),
  getSequence: vi.fn(),
  createSequence,
  updateSequence,
  deleteSequence,
  enrollLead,
  unenrollLead: vi.fn(),
  getLeadEnrollment: vi.fn(),
  runSequencesForBusiness,
}));

import { POST as createPlan } from "@/app/api/sequences/route";
import { PATCH as editPlan, DELETE as deletePlan } from "@/app/api/sequences/[id]/route";
import { POST as enrol } from "@/app/api/leads/[id]/sequence/route";
import { POST as runPlans } from "@/app/api/sequences/run/route";

const json = (body: unknown) => new NextRequest("http://localhost/api", { method: "POST", body: JSON.stringify(body) });
const params = { params: Promise.resolve({ id: "x1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  createSequence.mockResolvedValue({ success: true });
  updateSequence.mockResolvedValue({ success: true });
  deleteSequence.mockResolvedValue({ success: true });
  enrollLead.mockResolvedValue({ success: true });
  runSequencesForBusiness.mockResolvedValue({});
});

describe("creating, changing and deleting a plan", () => {
  it("is refused for a teammate who isn't an admin", async () => {
    isAdmin.mockResolvedValue(false);
    expect((await createPlan(json({ name: "Plan", steps: [] }))).status).toBe(403);
    expect((await editPlan(json({ name: "Plan" }), params)).status).toBe(403);
    expect((await deletePlan(json({}), params)).status).toBe(403);
    expect(createSequence).not.toHaveBeenCalled();
    expect(updateSequence).not.toHaveBeenCalled();
    expect(deleteSequence).not.toHaveBeenCalled();
  });

  it("is allowed for an admin", async () => {
    isAdmin.mockResolvedValue(true);
    expect((await createPlan(json({ name: "Plan", steps: [] }))).status).toBe(201);
    expect(createSequence).toHaveBeenCalled();
  });
});

describe("adding a customer to a plan, and running plans by hand", () => {
  it("follows Only admins send, like the Send button", async () => {
    refusal.mockResolvedValue("Only admins send on this account.");
    expect((await enrol(json({ sequenceId: "s1" }), params)).status).toBe(403);
    expect((await runPlans()).status).toBe(403);
    expect(enrollLead).not.toHaveBeenCalled();
    expect(runSequencesForBusiness).not.toHaveBeenCalled();
  });

  it("is allowed when anyone may send", async () => {
    refusal.mockResolvedValue(null);
    expect((await enrol(json({ sequenceId: "s1" }), params)).status).toBe(200);
    expect(enrollLead).toHaveBeenCalled();
  });
});
