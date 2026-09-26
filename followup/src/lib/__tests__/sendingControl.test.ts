/**
 * Pause all sending, and Only admins send (design brain A-041).
 *
 * Pause rides on holdAllForApproval, the gate every automated path already
 * obeys, so what matters here is exactly what each write sets and when it
 * refuses: a pause that stamped a never-sending account would offer a
 * Resume that turns sending ON.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { updateMany, businessFindUnique, userFindUnique } = vi.hoisted(() => ({
  updateMany: vi.fn(),
  businessFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: { business: { updateMany, findUnique: businessFindUnique }, user: { findUnique: userFindUnique } },
}));
vi.mock("@/lib/session", () => ({ getSessionContext: vi.fn(async () => null) }));

import { pauseSending, resumeSending, sendRefusal } from "@/lib/sendingControl";

beforeEach(() => vi.clearAllMocks());

describe("pauseSending", () => {
  it("holds everything and stamps the pause, only on an account that was sending by itself", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    expect(await pauseSending("biz")).toEqual({ ok: true });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "biz", holdAllForApproval: false },
      data: { holdAllForApproval: true, autoSendAllowedAt: null, sendingPausedAt: expect.any(Date) },
    });
  });

  it("refuses on an account where nothing sends by itself", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    businessFindUnique.mockResolvedValue({ sendingPausedAt: null });
    const result = await pauseSending("biz");
    expect(result).toEqual(expect.objectContaining({ ok: false, status: 409 }));
  });

  it("is a no-op success when already paused", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    businessFindUnique.mockResolvedValue({ sendingPausedAt: new Date() });
    expect(await pauseSending("biz")).toEqual({ ok: true });
  });
});

describe("resumeSending", () => {
  it("turns sending back on with a fresh stamp, so what waited during the pause keeps waiting", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    expect(await resumeSending("biz")).toEqual({ ok: true });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "biz", sendingPausedAt: { not: null } },
      data: { holdAllForApproval: false, autoSendAllowedAt: expect.any(Date), sendingPausedAt: null },
    });
  });

  it("refuses when nothing is paused, instead of granting permission to send", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    expect(await resumeSending("biz")).toEqual(expect.objectContaining({ ok: false, status: 409 }));
  });
});

describe("sendRefusal", () => {
  it("lets anyone send when the option is off", async () => {
    businessFindUnique.mockResolvedValue({ onlyAdminsSend: false });
    userFindUnique.mockResolvedValue({ role: "SALES", businessId: "biz" });
    expect(await sendRefusal("biz", "u")).toBeNull();
  });

  it("lets an admin of this business send when it is on", async () => {
    businessFindUnique.mockResolvedValue({ onlyAdminsSend: true });
    userFindUnique.mockResolvedValue({ role: "ADMIN", businessId: "biz" });
    expect(await sendRefusal("biz", "u")).toBeNull();
  });

  it("refuses a teammate when it is on", async () => {
    businessFindUnique.mockResolvedValue({ onlyAdminsSend: true });
    userFindUnique.mockResolvedValue({ role: "SALES", businessId: "biz" });
    expect(await sendRefusal("biz", "u")).toMatch(/Only admins send/);
  });

  it("refuses an admin of a different business", async () => {
    businessFindUnique.mockResolvedValue({ onlyAdminsSend: true });
    userFindUnique.mockResolvedValue({ role: "ADMIN", businessId: "other" });
    expect(await sendRefusal("biz", "u")).toMatch(/Only admins send/);
  });
});
