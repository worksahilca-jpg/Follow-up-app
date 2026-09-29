/**
 * "Not a customer" (founder, 2026-09-29: learn from corrections). The
 * owner's call is remembered for the sender, each of the person's email
 * threads is set aside where the owner can take it back, and the lead goes.
 * Business-scoped: another tenant's lead is never touched.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock, deleteLeadCascade, recordAudit, getSessionContext } = vi.hoisted(() => ({
  prismaMock: {
    lead: { findFirst: vi.fn() },
    senderVerdict: { upsert: vi.fn(async () => ({})) },
    filteredEmail: { upsert: vi.fn(async () => ({})) },
  },
  deleteLeadCascade: vi.fn(async () => undefined),
  recordAudit: vi.fn(async () => undefined),
  getSessionContext: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/leads-admin", () => ({ deleteLeadCascade }));
vi.mock("@/lib/audit", () => ({ recordAudit }));
vi.mock("@/lib/session", () => ({ getSessionContext }));

import { POST } from "@/app/api/leads/[id]/not-customer/route";
import { OWNER_SAID_NOT_CUSTOMER } from "@/lib/senderVerdicts";

const params = Promise.resolve({ id: "lead1" });
const call = () => POST(new Request("http://localhost/api/leads/lead1/not-customer", { method: "POST" }), { params });
const last = new Date("2026-09-20T10:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "u1" });
  prismaMock.lead.findFirst.mockResolvedValue({
    id: "lead1",
    name: "Kira, Pixel Studio",
    email: "Kira@PixelStudio.example",
    conversations: [
      { externalId: "thread-1", emailProvider: "gmail", messages: [{ sentAt: last }] },
      { externalId: "conv-2", emailProvider: "outlook", messages: [] },
    ],
  });
});

describe("POST /api/leads/[id]/not-customer", () => {
  it("remembers the sender for this business, sets each thread aside, then removes the lead", async () => {
    const res = await call();
    expect(await res.json()).toEqual({ success: true });

    expect(prismaMock.senderVerdict.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId_sender: { businessId: "biz1", sender: "kira@pixelstudio.example" } },
        create: expect.objectContaining({ businessId: "biz1", sender: "kira@pixelstudio.example", verdict: "not_customer" }),
      })
    );

    const calls = prismaMock.filteredEmail.upsert.mock.calls as unknown as [{ create: Record<string, unknown> }][];
    const rows = calls.map(([a]) => a.create);
    expect(rows.map((r) => [r.threadId, r.provider, r.reason])).toEqual([
      ["thread-1", "gmail", OWNER_SAID_NOT_CUSTOMER],
      ["conv-2", "outlook", OWNER_SAID_NOT_CUSTOMER],
    ]);
    // The newest message's time, so the sync doesn't re-judge the thread until something new arrives.
    expect(rows[0].lastMessageAt).toEqual(last);

    expect(deleteLeadCascade).toHaveBeenCalledWith("lead1", "biz1");
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), "lead.not_customer", expect.objectContaining({ targetId: "lead1" }));
  });

  it("looks the lead up inside the signed-in business only", async () => {
    prismaMock.lead.findFirst.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(404);
    expect(prismaMock.lead.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "lead1", businessId: "biz1" } }));
    expect(deleteLeadCascade).not.toHaveBeenCalled();
    expect(prismaMock.senderVerdict.upsert).not.toHaveBeenCalled();
  });

  it("refuses when there is no email address to remember, and removes nothing", async () => {
    prismaMock.lead.findFirst.mockResolvedValue({ id: "lead1", name: "DM only", email: null, conversations: [] });
    const res = await call();
    expect(res.status).toBe(400);
    expect(deleteLeadCascade).not.toHaveBeenCalled();
  });

  it("keeps the lead when remembering fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    prismaMock.senderVerdict.upsert.mockRejectedValueOnce(new Error("db down"));
    const res = await call();
    expect(res.status).toBe(500);
    expect(deleteLeadCascade).not.toHaveBeenCalled();
  });

  it("needs a signed-in user", async () => {
    getSessionContext.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
  });
});
