/**
 * Sending on the owner's own WhatsApp number (src/lib/whatsappCloud.ts):
 * the words as written inside 24 hours, the approved template past them,
 * and a plain refusal — never another channel — when there is no template.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { sendWhatsAppCloud, toWaId, type WhatsAppCloudConnection } from "@/lib/whatsappCloud";

const conn: WhatsAppCloudConnection = {
  businessId: "biz1",
  phoneNumberId: "104567890123456",
  accessToken: "tok",
  templateName: "followup_still_interested",
  templateLanguage: "en",
};

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const metaError = (code: number, message: string) => ({ ok: false, status: 400, json: async () => ({ error: { message, code } }) });

function sentBody(call = 0) {
  return JSON.parse(fetchMock.mock.calls[call][1].body as string);
}

describe("sendWhatsAppCloud", () => {
  it("sends the words as written inside the window, to the digits-only id, and returns Meta's message id", async () => {
    fetchMock.mockResolvedValueOnce(ok({ messages: [{ id: "wamid.abc" }] }));
    const result = await sendWhatsAppCloud(conn, "+1 (416) 555-0100", "Hi Priya — yes we do kitchens.", { hoursSinceLead: 2, leadFirstName: "Priya" });

    expect(result).toEqual({ success: true, sid: "wamid.abc" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://graph.facebook.com/v21.0/104567890123456/messages");
    expect(sentBody()).toMatchObject({ messaging_product: "whatsapp", to: "14165550100", type: "text", text: { body: "Hi Priya — yes we do kitchens." } });
  });

  it("sends the template past 24 hours, with the first name in the placeholder", async () => {
    fetchMock.mockResolvedValueOnce(ok({ messages: [{ id: "wamid.tpl" }] }));
    const result = await sendWhatsAppCloud(conn, "+14165550100", "ignored", { hoursSinceLead: 30, leadFirstName: "Priya" });

    expect(result.success).toBe(true);
    expect(sentBody()).toMatchObject({
      type: "template",
      template: { name: "followup_still_interested", language: { code: "en" }, components: [{ type: "body", parameters: [{ type: "text", text: "Priya" }] }] },
    });
  });

  it("treats a lead who never wrote on WhatsApp like one outside the window", async () => {
    fetchMock.mockResolvedValueOnce(ok({ messages: [{ id: "wamid.tpl" }] }));
    await sendWhatsAppCloud(conn, "+14165550100", "hello", { hoursSinceLead: null, leadFirstName: "Priya" });
    expect(sentBody().type).toBe("template");
  });

  it("refuses in plain words, without calling Meta, when there is no template past the window", async () => {
    const result = await sendWhatsAppCloud({ ...conn, templateName: null }, "+14165550100", "hello", { hoursSinceLead: 48 });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/24 hours/);
    expect(result.message).toMatch(/Settings → WhatsApp/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to the template when Meta says the window is shut even though our clock disagreed", async () => {
    fetchMock.mockResolvedValueOnce(metaError(131047, "Re-engagement message")).mockResolvedValueOnce(ok({ messages: [{ id: "wamid.tpl2" }] }));
    const result = await sendWhatsAppCloud(conn, "+14165550100", "hello", { hoursSinceLead: 23.9, leadFirstName: "Priya" });
    expect(result).toEqual({ success: true, sid: "wamid.tpl2" });
    expect(sentBody(1).type).toBe("template");
  });

  it("passes any other Meta rejection through with its status and code, so the retry queue can classify it", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ error: { message: "Service temporarily unavailable", code: 2 } }) });
    const result = await sendWhatsAppCloud(conn, "+14165550100", "hello", { hoursSinceLead: 1 });
    expect(result).toMatchObject({ success: false, status: 503, code: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("toWaId", () => {
  it("keeps digits only", () => {
    expect(toWaId("+1 (416) 555-0100")).toBe("14165550100");
  });
});
