/**
 * sendWhatsApp()'s template-retry path (src/lib/twilio.ts): a free-form
 * WhatsApp send that Twilio rejects with error 63016 (more than 24 hours
 * since the lead's last inbound message) should retry via the business's
 * approved template (Content API) when one is configured, and keep the
 * old honest-failure behavior when none is.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { business: { findUnique } } }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn() }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://followupbase.io" }));
vi.mock("@/lib/monitoring", () => ({ recordAuthFailure: vi.fn() }));

import { sendWhatsApp } from "@/lib/twilio";

function jsonResponse(status: number, body: Record<string, unknown>) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const BUSINESS_BASE = {
  twilioAccountSid: "ACxxx",
  twilioAuthToken: "token",
  whatsappPhoneNumber: "+14155238886",
};

beforeEach(() => {
  findUnique.mockReset();
  vi.stubGlobal("fetch", vi.fn());
});

describe("sendWhatsApp", () => {
  it("sends free-form text normally when within the 24-hour window", async () => {
    findUnique.mockResolvedValue({ ...BUSINESS_BASE, whatsappTemplateSid: null });
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse(201, { sid: "SM1" }));

    const result = await sendWhatsApp("biz1", "+15550001111", "Still interested?");

    expect(result).toEqual({ success: true, sid: "SM1" });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(init.body)).toContain("Body=Still");
  });

  it("without a configured template, fails with the old honest explanation on a stale conversation", async () => {
    findUnique.mockResolvedValue({ ...BUSINESS_BASE, whatsappTemplateSid: null });
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse(400, { code: 63016 }));

    const result = await sendWhatsApp("biz1", "+15550001111", "Still interested?");

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/24 hours old/);
    expect(result.message).toMatch(/none is set up/);
    expect(fetch).toHaveBeenCalledTimes(1); // no retry without a template
  });

  it("with a configured template, retries via Content API on a stale conversation", async () => {
    findUnique.mockResolvedValue({ ...BUSINESS_BASE, whatsappTemplateSid: "HXabc123" });
    (fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(jsonResponse(400, { code: 63016 }))
      .mockResolvedValueOnce(jsonResponse(201, { sid: "SM2" }));

    const result = await sendWhatsApp("biz1", "+15550001111", "Still interested?", { leadFirstName: "Priya" });

    expect(result).toEqual({ success: true, sid: "SM2" });
    expect(fetch).toHaveBeenCalledTimes(2);
    const [, retryInit] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[1];
    const retryBody = String(retryInit.body);
    expect(retryBody).toContain("ContentSid=HXabc123");
    expect(decodeURIComponent(retryBody)).toContain('{"1":"Priya"}');
    expect(retryBody).not.toContain("Body=");
  });

  it("falls back to 'there' when no lead name is given for the template retry", async () => {
    findUnique.mockResolvedValue({ ...BUSINESS_BASE, whatsappTemplateSid: "HXabc123" });
    (fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(jsonResponse(400, { code: 63016 }))
      .mockResolvedValueOnce(jsonResponse(201, { sid: "SM3" }));

    await sendWhatsApp("biz1", "+15550001111", "Still interested?");

    const [, retryInit] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(decodeURIComponent(String(retryInit.body))).toContain('{"1":"there"}');
  });

  it("reports a rejected template send distinctly, without pretending it's the original 63016 case", async () => {
    findUnique.mockResolvedValue({ ...BUSINESS_BASE, whatsappTemplateSid: "HXabc123" });
    (fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(jsonResponse(400, { code: 63016 }))
      .mockResolvedValueOnce(jsonResponse(400, { message: "Content SID not approved for this sender" }));

    const result = await sendWhatsApp("biz1", "+15550001111", "Still interested?");

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/template send was rejected/);
    expect(result.message).toMatch(/not approved/);
  });

  it("still reports the plain 'not connected' error when Twilio/WhatsApp isn't configured at all", async () => {
    findUnique.mockResolvedValue(null);

    const result = await sendWhatsApp("biz1", "+15550001111", "Hi");

    expect(result).toEqual({ success: false, message: "WhatsApp isn't fully connected yet — check Settings → Phone (SMS + calls)." });
    expect(fetch).not.toHaveBeenCalled();
  });
});
