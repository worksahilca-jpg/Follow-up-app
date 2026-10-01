/**
 * "Only admins send" (A-041) and one customer's automation (bug hunt
 * 2026-09-30, founder: "Yes fix it"). Turning a customer on lets the hourly
 * check send to them by itself, so a teammate on such an account can't do
 * it; turning a customer off is always fine.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const ctx = { userId: "u1", businessId: "b1", email: "rep@example.com", authTime: Date.now() };
const { refusal, prismaMock } = vi.hoisted(() => ({
  refusal: vi.fn(),
  prismaMock: {
    lead: { findFirst: vi.fn(), update: vi.fn() },
    business: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/session", () => ({ getSessionContext: vi.fn(async () => ctx), requireAdmin: vi.fn(async () => false) }));
vi.mock("@/lib/sendingControl", () => ({ sendRefusal: refusal }));
vi.mock("@/lib/billing", () => ({ requireActiveBilling: vi.fn(async () => true), billingLockedMessage: vi.fn(async () => "") }));
vi.mock("@/lib/autonomousPermission", () => ({ isAutonomousAllowed: vi.fn(async () => true), AUTONOMOUS_NOT_ALLOWED_MESSAGE: "no" }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { POST } from "@/app/api/leads/[id]/automation/route";

const call = (tier: string) =>
  POST(new NextRequest("http://localhost/api/leads/l1/automation", { method: "POST", body: JSON.stringify({ tier }) }), {
    params: Promise.resolve({ id: "l1" }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.lead.findFirst.mockResolvedValue({ id: "l1", sequenceId: null });
  prismaMock.lead.update.mockImplementation(async ({ data }) => ({ automationTier: data.automationTier }));
});

describe("one customer's automation with Only admins send on", () => {
  it("refuses a teammate turning a customer on, and changes nothing", async () => {
    refusal.mockResolvedValue("Only admins send on this account.");
    const res = await call("assisted");
    expect(res.status).toBe(403);
    expect((await res.json()).message).toMatch(/only an admin can turn this on/);
    expect(refusal).toHaveBeenCalledWith("b1", "u1");
    expect(prismaMock.lead.update).not.toHaveBeenCalled();
  });

  it("still lets a teammate turn a customer off", async () => {
    refusal.mockResolvedValue("Only admins send on this account.");
    const res = await call("off");
    expect(res.status).toBe(200);
    expect(prismaMock.lead.update).toHaveBeenCalledWith({ where: { id: "l1" }, data: { automationTier: "OFF" } });
  });

  it("works as before for anyone allowed to send", async () => {
    refusal.mockResolvedValue(null);
    const res = await call("assisted");
    expect(res.status).toBe(200);
    expect((await res.json()).automationTier).toBe("assisted");
  });
});
