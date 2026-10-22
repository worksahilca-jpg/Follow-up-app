/**
 * "Write it better" (A-290) keeps an example that changes every later reply sent in the business's name, so only an
 * admin can keep or undo one (milestone 1, 2026-10-22), as with the business's facts (A-308) and questions (A-100).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { getSessionContext, requireAdmin } = vi.hoisted(() => ({ getSessionContext: vi.fn(), requireAdmin: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));
const { saveOwnerExample, deleteOwnerExample } = vi.hoisted(() => ({
  saveOwnerExample: vi.fn(async () => ({ id: "x1" })),
  deleteOwnerExample: vi.fn(async () => true),
}));
vi.mock("@/lib/ownerExamples", () => ({ saveOwnerExample, deleteOwnerExample }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions: vi.fn(async () => false) }));

import { DELETE, POST } from "../route";

const body = { channel: "email", customerSaid: "is it free?", reply: "Happy to explain how it works." };
const post = () => new Request("http://localhost/api/practice/teach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const del = (id: string) => new Request(`http://localhost/api/practice/teach?id=${id}`, { method: "DELETE" });

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "u1" });
  requireAdmin.mockResolvedValue(true);
});

describe("POST /api/practice/teach", () => {
  it("an admin keeps an example for their own business", async () => {
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(saveOwnerExample).toHaveBeenCalledWith("biz1", "u1", body);
  });

  it("a teammate who isn't an admin is told why, and nothing is kept", async () => {
    requireAdmin.mockResolvedValue(false);
    const res = await POST(post());
    expect(res.status).toBe(403);
    expect((await res.json()).message).toMatch(/Only an admin can teach FollowUp/);
    expect(saveOwnerExample).not.toHaveBeenCalled();
  });

  it("signed out is refused before anything else", async () => {
    getSessionContext.mockResolvedValue(null);
    expect((await POST(post())).status).toBe(401);
    expect(requireAdmin).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/practice/teach", () => {
  it("an admin's Undo is held to their own business, and says who did it", async () => {
    expect((await DELETE(del("x1"))).status).toBe(200);
    expect(deleteOwnerExample).toHaveBeenCalledWith("biz1", "x1", "u1");
  });

  it("a teammate who isn't an admin can't undo one either", async () => {
    requireAdmin.mockResolvedValue(false);
    expect((await DELETE(del("x1"))).status).toBe(403);
    expect(deleteOwnerExample).not.toHaveBeenCalled();
  });
});
