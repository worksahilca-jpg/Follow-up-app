/**
 * "Check for anyone waiting, right now" (POST /api/automation/run) sends
 * whatever is due, so with "Only admins send" on (A-041) a teammate can't
 * press it — the same rule as /api/sequences/run (security audit
 * 2026-09-29, founder chose this on 2026-09-30).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const ctx = { userId: "u1", businessId: "b1", email: "rep@example.com", authTime: Date.now() };
const { refusal, runAutomationForBusiness } = vi.hoisted(() => ({
  refusal: vi.fn(),
  runAutomationForBusiness: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSessionContext: vi.fn(async () => ctx) }));
vi.mock("@/lib/sendingControl", () => ({ sendRefusal: refusal }));
vi.mock("@/lib/billing", () => ({ requireActiveBilling: vi.fn(async () => true), billingLockedMessage: vi.fn(async () => "") }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions: vi.fn(async () => false) }));
vi.mock("@/lib/automation", () => ({ runAutomationForBusiness }));

import { POST as runNow } from "@/app/api/automation/run/route";

beforeEach(() => {
  vi.clearAllMocks();
  runAutomationForBusiness.mockResolvedValue({ checked: 0, sent: 0 });
});

describe("running the automation check now", () => {
  it("is refused for a teammate when only admins send, and nothing runs", async () => {
    refusal.mockResolvedValue("Only admins send on this account.");
    const res = await runNow();
    expect(res.status).toBe(403);
    expect((await res.json()).message).toMatch(/Only admins send/);
    expect(refusal).toHaveBeenCalledWith("b1", "u1");
    expect(runAutomationForBusiness).not.toHaveBeenCalled();
  });

  it("runs as before for anyone allowed to send", async () => {
    refusal.mockResolvedValue(null);
    const res = await runNow();
    expect(res.status).toBe(200);
    expect(runAutomationForBusiness).toHaveBeenCalledWith("b1");
  });
});
