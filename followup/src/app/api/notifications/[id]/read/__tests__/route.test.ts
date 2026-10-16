import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateMany, getSessionContext } = vi.hoisted(() => ({ updateMany: vi.fn(), getSessionContext: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { notification: { updateMany } } }));
vi.mock("@/lib/session", () => ({ getSessionContext }));

import { POST } from "../route";

const call = (id: string) => POST(new Request(`http://localhost/api/notifications/${id}/read`, { method: "POST" }), { params: Promise.resolve({ id }) });

describe("POST /api/notifications/[id]/read (Got it, A-270)", () => {
  beforeEach(() => {
    updateMany.mockReset();
    getSessionContext.mockResolvedValue({ userId: "user-7", businessId: "biz-1" });
  });

  it("needs a session", async () => {
    getSessionContext.mockResolvedValue(null);
    expect((await call("n1")).status).toBe(401);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("marks only the viewer's own notice, in their business", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    expect((await call("n1")).status).toBe(200);
    expect(updateMany).toHaveBeenCalledWith({ where: { id: "n1", userId: "user-7", user: { businessId: "biz-1" } }, data: { read: true } });
  });

  it("is a 404 for anyone else's", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    expect((await call("someone-elses")).status).toBe(404);
  });
});
