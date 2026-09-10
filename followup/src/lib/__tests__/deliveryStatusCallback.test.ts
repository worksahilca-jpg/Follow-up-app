/**
 * task #96: sendSms()/sendWhatsApp() (src/lib/twilio.ts) must attach a
 * StatusCallback pointed at /api/twilio/status/[secret] on every outbound
 * send, so Twilio's real delivery outcome (not just "accepted for
 * sending") gets recorded — see src/app/api/twilio/status/[secret]/route.ts
 * for the receiving side.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { business: { findUnique } } }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn() }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://followupbase.io" }));
vi.mock("@/lib/monitoring", () => ({ recordAuthFailure: vi.fn() }));

import { sendSms, sendWhatsApp } from "@/lib/twilio";

function jsonResponse(status: number, body: Record<string, unknown>) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

beforeEach(() => {
  findUnique.mockReset();
  vi.stubGlobal("fetch", vi.fn());
});

describe("sendSms StatusCallback", () => {
  it("attaches the status callback URL when the business has a Twilio secret", async () => {
    findUnique.mockResolvedValue({
      twilioAccountSid: "ACxxx",
      twilioAuthToken: "token",
      twilioPhoneNumber: "+15550009999",
      twilioSecret: "sekret123",
    });
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse(201, { sid: "SM1" }));

    await sendSms("biz1", "+15550001111", "Hi there");

    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = decodeURIComponent(String(init.body));
    expect(body).toContain("StatusCallback=https://followupbase.io/api/twilio/status/sekret123");
  });

  it("omits StatusCallback when the business has no Twilio secret yet", async () => {
    findUnique.mockResolvedValue({
      twilioAccountSid: "ACxxx",
      twilioAuthToken: "token",
      twilioPhoneNumber: "+15550009999",
      twilioSecret: null,
    });
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse(201, { sid: "SM1" }));

    await sendSms("biz1", "+15550001111", "Hi there");

    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(init.body)).not.toContain("StatusCallback");
  });
});

describe("sendWhatsApp StatusCallback", () => {
  const BUSINESS_BASE = {
    twilioAccountSid: "ACxxx",
    twilioAuthToken: "token",
    whatsappPhoneNumber: "+14155238886",
    whatsappTemplateSid: null as string | null,
    twilioSecret: "sekret123",
  };

  it("attaches the status callback on the initial free-form send", async () => {
    findUnique.mockResolvedValue(BUSINESS_BASE);
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse(201, { sid: "SM1" }));

    await sendWhatsApp("biz1", "+15550001111", "Still interested?");

    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = decodeURIComponent(String(init.body));
    expect(body).toContain("StatusCallback=https://followupbase.io/api/twilio/status/sekret123");
  });

  it("also attaches it on the template-retry send", async () => {
    findUnique.mockResolvedValue({ ...BUSINESS_BASE, whatsappTemplateSid: "HXabc123" });
    (fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(jsonResponse(400, { code: 63016 }))
      .mockResolvedValueOnce(jsonResponse(201, { sid: "SM2" }));

    await sendWhatsApp("biz1", "+15550001111", "Still interested?", { leadFirstName: "Priya" });

    const [, retryInit] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[1];
    const retryBody = decodeURIComponent(String(retryInit.body));
    expect(retryBody).toContain("StatusCallback=https://followupbase.io/api/twilio/status/sekret123");
  });
});
