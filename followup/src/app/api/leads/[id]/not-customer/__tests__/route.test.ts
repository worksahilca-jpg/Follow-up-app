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

/** Someone who only ever emailed, and never did business here. */
function pitch(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead1",
    name: "Kira, Pixel Studio",
    email: "Kira@PixelStudio.example",
    stage: "NEW",
    conversations: [
      { channel: "email", externalId: "thread-1", emailProvider: "gmail", messages: [{ sentAt: last }] },
      { channel: "email", externalId: "conv-2", emailProvider: "outlook", messages: [] },
    ],
    _count: { deals: 0, bookings: 0, followUps: 0 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "u1" });
  prismaMock.lead.findFirst.mockResolvedValue(pitch());
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
    prismaMock.lead.findFirst.mockResolvedValue(pitch({ name: "DM only", email: null, conversations: [] }));
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

  // Audit 2026-09-29: the confirm box promises "bring them back from Filtered
  // out", which only email threads can keep. Anything else would be lost.
  describe("refuses when it couldn't be undone", () => {
    const cases: [string, Record<string, unknown>][] = [
      ["a booking", { _count: { deals: 0, bookings: 1, followUps: 0 } }],
      ["a deal", { _count: { deals: 1, bookings: 0, followUps: 0 } }],
      ["a stage past New", { stage: "QUALIFIED" }],
      ["replies already sent", { _count: { deals: 0, bookings: 0, followUps: 2 } }],
      ["an Instagram conversation", { conversations: [{ channel: "instagram", externalId: null, emailProvider: null, messages: [] }, ...pitch().conversations] }],
      ["no email thread at all", { conversations: [] }],
    ];
    for (const [what, overrides] of cases) {
      it(`with ${what}: 409, and nothing is removed or remembered`, async () => {
        prismaMock.lead.findFirst.mockResolvedValue(pitch(overrides));
        const res = await call();
        expect(res.status).toBe(409);
        expect((await res.json()).message).toMatch(/Use Delete if you're sure/);
        expect(deleteLeadCascade).not.toHaveBeenCalled();
        expect(prismaMock.senderVerdict.upsert).not.toHaveBeenCalled();
        expect(prismaMock.filteredEmail.upsert).not.toHaveBeenCalled();
      });
    }
  });
});
