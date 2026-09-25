/**
 * The WhatsApp paste-a-token connect and the disconnect
 * (src/app/api/whatsapp/config/route.ts), for two findings from the
 * 2026-09-25 security pass:
 *
 * F6 — the audit trail said "WhatsApp connected" for a connect that was
 *      refused, because the event was written before the save.
 * F5 — disconnecting unsubscribed FollowUp from the whole WhatsApp
 *      Business Account, silencing every other business on that account.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const ctx = { userId: "u1", businessId: "b1", email: "owner@example.com", authTime: Date.now() };
const { recordAudit, businessUpdate, businessFindUnique, businessCount, unsubscribeAppFromWaba } = vi.hoisted(() => ({
  recordAudit: vi.fn(),
  businessUpdate: vi.fn(async () => ({})),
  businessFindUnique: vi.fn(async () => null),
  businessCount: vi.fn(async () => 0),
  unsubscribeAppFromWaba: vi.fn(async () => undefined),
}));

vi.mock("@/lib/session", () => ({ getSessionContext: vi.fn(async () => ctx), requireAdmin: vi.fn(async () => true) }));
vi.mock("@/lib/audit", () => ({ recordAudit }));
vi.mock("@/lib/db", () => ({ prisma: { business: { update: businessUpdate, findUnique: businessFindUnique, count: businessCount } } }));
vi.mock("@/lib/whatsappCloud", () => ({
  lookupWhatsAppNumber: vi.fn(async () => ({ displayNumber: "+1 555 140 4294" })),
  subscribeAppToWaba: vi.fn(async () => ({ ok: true })),
  unsubscribeAppFromWaba,
  whatsappSignupAvailable: () => true,
}));

import { POST, DELETE } from "@/app/api/whatsapp/config/route";

const connect = () =>
  POST(
    new NextRequest("https://www.followupbase.io/api/whatsapp/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: "EAAG-pasted", phoneNumberId: "1349091144951993", wabaId: "1111528771562275" }),
    })
  );

const auditActions = () => recordAudit.mock.calls.map((c) => (c as unknown[])[1]);

beforeEach(() => {
  vi.clearAllMocks();
  businessUpdate.mockResolvedValue({});
  businessCount.mockResolvedValue(0);
  businessFindUnique.mockResolvedValue({ whatsappWabaId: "1111528771562275", whatsappAccessToken: "EAAG-stored" } as never);
});

describe("connecting WhatsApp by pasting a token", () => {
  it("records 'connected' once the save has held", async () => {
    const res = await connect();
    expect(res.status).toBe(200);
    expect(auditActions()).toEqual(["integration.whatsapp.connect"]);
  });

  it("records nothing called 'connected' when the number is already on another account", async () => {
    businessUpdate.mockRejectedValueOnce(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }));
    const res = await connect();
    expect(res.status).toBe(409);
    expect(auditActions()).not.toContain("integration.whatsapp.connect");
  });
});

describe("disconnecting WhatsApp", () => {
  it("unsubscribes from the WhatsApp Business Account when no other business uses it", async () => {
    await DELETE();
    expect(businessCount).toHaveBeenCalledWith({ where: { id: { not: "b1" }, whatsappWabaId: "1111528771562275" } });
    expect(unsubscribeAppFromWaba).toHaveBeenCalledWith("1111528771562275", "EAAG-stored");
  });

  it("leaves the account subscribed when another business still has a number in it", async () => {
    businessCount.mockResolvedValue(1);
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(unsubscribeAppFromWaba).not.toHaveBeenCalled();
    // This business is still disconnected either way.
    expect(businessUpdate).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: expect.objectContaining({ whatsappWabaId: null, whatsappAccessToken: null, whatsappPhoneNumberId: null }),
    });
  });
});
