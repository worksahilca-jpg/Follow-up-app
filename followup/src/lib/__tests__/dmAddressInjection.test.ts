/**
 * Security audit 2026-09-26, A-6 (first raised 2026-09-16, Meta surface #7).
 *
 * Lead.phone doubles as the Instagram/Messenger address: "ig:<igsid>" and
 * "fb:<psid>" pick the channel and the recipient of every send. Only the
 * Meta inbound path may write those. Before this, anyone could submit
 * "ig:…" as a phone number through the public embed form (or the lead
 * webhook, a CSV, the manual form) and get a lead FollowUp treated as an
 * Instagram contact — or, with a real IGSID, have their words merged into
 * that customer's DM thread through the duplicate-phone path.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { recordInboundWebhookEvent, processInboundEvent } = vi.hoisted(() => ({
  recordInboundWebhookEvent: vi.fn(async () => ({ id: "evt1", receivedAt: new Date() })),
  processInboundEvent: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/inboundEvents", () => ({ recordInboundWebhookEvent, processInboundEvent }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentLeads: vi.fn(async () => false) }));
vi.mock("@/lib/db", () => ({ prisma: { business: { findUnique: vi.fn(async () => ({ id: "biz1" })) } } }));

import { cleanedPhone, sanitizeUserPhone } from "@/lib/validation";
import { POST as embedPost } from "@/app/api/embed/[businessId]/lead/route";

function submit(body: Record<string, unknown>) {
  return embedPost(
    new NextRequest("https://followupbase.io/api/embed/biz1/lead", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ businessId: "biz1" }) }
  );
}

beforeEach(() => vi.clearAllMocks());

describe("sanitizeUserPhone / cleanedPhone", () => {
  it.each(["ig:17841400000000000", "fb:1234567890", "  ig:1", "fb:"])("drops the DM address %j", (v) => {
    expect(sanitizeUserPhone(v)).toBe("");
    expect(cleanedPhone(40).parse(v)).toBe("");
  });

  it.each(["+1 416 555 0100", "(416) 555-0100", "IG-Shop main line 555 0100"])("keeps a real phone %j", (v) => {
    expect(cleanedPhone(40).parse(v)).toBe(v.trim());
  });

  it("stays forgiving: a non-string still becomes empty rather than rejecting", () => {
    expect(cleanedPhone(40).parse(12345)).toBe("");
    expect(cleanedPhone(40).parse(undefined)).toBe("");
  });
});

describe("the public embed form", () => {
  it("never stores an Instagram address typed into the phone field", async () => {
    const res = await submit({ name: "Stranger", email: "a@example.com", phone: "ig:17841400000000000", message: "hi" });
    expect(res.status).toBe(200);
    const payload = (recordInboundWebhookEvent.mock.calls[0] as unknown as [{ payload: { phone: string } }])[0].payload;
    expect(payload.phone).toBe("");
  });

  it("with only a DM address and no email, asks for a real contact instead of creating a lead", async () => {
    const res = await submit({ name: "Stranger", phone: "fb:1234567890", message: "hi" });
    expect(res.status).toBe(400);
    expect(recordInboundWebhookEvent).not.toHaveBeenCalled();
  });
});
