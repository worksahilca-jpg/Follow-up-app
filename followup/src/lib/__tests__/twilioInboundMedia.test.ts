/**
 * POST /api/twilio/sms/[secret] and /api/twilio/whatsapp/[secret] — two
 * inbound guarantees that did not hold.
 *
 * 1. A picture-only MMS/WhatsApp message is NOT dropped. "Here's a photo
 *    of the thing that's broken" with no caption arrives from Twilio as
 *    NumMedia >= 1 and an EMPTY Body. Both routes gated everything —
 *    Message row, acknowledgement, scoring — behind `if (body)`, so the
 *    Lead row was created and then nothing else happened: the owner saw a
 *    bare phone number with an empty conversation, with no way to know
 *    anyone had actually sent them anything. A silently dropped lead is
 *    the single worst outcome this product can produce.
 *
 * 2. The acknowledgement answers only what the lead actually TYPED. The
 *    placeholder recorded for a media-only message is FollowUp's own
 *    words; letting generateInstantReply() answer it would be a machine
 *    replying to a message nobody sent. Empty inboundText makes
 *    acknowledgeNewLead fall through to its always-safe fixed line.
 *
 * 3. A redelivery of the same Twilio MessageSid appends nothing and
 *    re-acknowledges nobody.
 */
import { NextRequest } from "next/server";
import { createHmac } from "crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { businessFindUnique, leadFindFirst, leadUpdate, leadCreate } = vi.hoisted(() => ({
  businessFindUnique: vi.fn(),
  leadFindFirst: vi.fn(),
  leadUpdate: vi.fn(),
  leadCreate: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    business: { findUnique: businessFindUnique },
    lead: { findFirst: leadFindFirst, update: leadUpdate, create: leadCreate },
  },
}));

// Explicitly typed so its recorded call arguments stay inspectable —
// an untyped vi.fn() infers `mock.calls` as an empty tuple.
type CreateInboundMessageIfNew = (
  conversationId: string,
  body: string,
  sentAt: Date,
  externalId?: string
) => Promise<boolean>;
const { createInboundMessageIfNew } = vi.hoisted(() => ({
  createInboundMessageIfNew: vi.fn<CreateInboundMessageIfNew>(async () => true),
}));
vi.mock("@/lib/instagram", () => ({ createInboundMessageIfNew }));

const { acknowledgeNewLead } = vi.hoisted(() => ({ acknowledgeNewLead: vi.fn(async () => ({ sent: true })) }));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead }));

const { scoreAndDraftForLead } = vi.hoisted(() => ({ scoreAndDraftForLead: vi.fn(async () => true) }));
vi.mock("@/lib/scoring", () => ({ scoreAndDraftForLead }));

const { findOrCreateConversation } = vi.hoisted(() => ({
  findOrCreateConversation: vi.fn(async () => ({ id: "conv1" })),
}));
vi.mock("@/lib/conversations", () => ({ findOrCreateConversation }));

vi.mock("@/lib/billing", () => ({ requireActiveBilling: vi.fn(async () => true) }));
vi.mock("@/lib/engagement", () => ({ checkRapidEngagement: vi.fn() }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn(async () => null) }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn() }));
vi.mock("@/lib/monitoring", () => ({ recordAuthFailure: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://followupbase.io" }));

import { POST as smsPost } from "@/app/api/twilio/sms/[secret]/route";
import { POST as whatsappPost } from "@/app/api/twilio/whatsapp/[secret]/route";

const AUTH_TOKEN = "auth-token-1";
const SECRET = "sekret123";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx = () => ({ params: Promise.resolve({ secret: SECRET }) }) as any;

function sign(url: string, form: Record<string, string>) {
  const data =
    url +
    Object.keys(form)
      .sort()
      .map((k) => k + form[k])
      .join("");
  return createHmac("sha1", AUTH_TOKEN).update(data, "utf8").digest("base64");
}

function signedRequest(url: string, form: Record<string, string>) {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": sign(url, form),
    },
    body: new URLSearchParams(form).toString(),
  });
}

const SMS_URL = `https://followupbase.io/api/twilio/sms/${SECRET}`;
const WHATSAPP_URL = `https://followupbase.io/api/twilio/whatsapp/${SECRET}`;

beforeEach(() => {
  vi.clearAllMocks();
  businessFindUnique.mockResolvedValue({
    id: "biz1",
    name: "Acme Plumbing",
    twilioAuthToken: AUTH_TOKEN,
    twilioAccountSid: "AC1",
    voiceAgentEnabled: false,
  });
  leadFindFirst.mockResolvedValue({ id: "lead1", businessId: "biz1", phone: "+15551230000" });
  leadUpdate.mockImplementation(async () => ({ id: "lead1", businessId: "biz1", phone: "+15551230000" }));
  createInboundMessageIfNew.mockResolvedValue(true);
});

describe("POST /api/twilio/sms/[secret] — picture-only MMS", () => {
  it("records the contact instead of dropping it when Body is empty but NumMedia is set", async () => {
    const form = {
      From: "+15551230000",
      To: "+15559990000",
      Body: "",
      NumMedia: "1",
      MessageSid: "SM_mms_1",
      MediaUrl0: "https://api.twilio.com/media/ME1",
    };

    const res = await smsPost(signedRequest(SMS_URL, form), ctx());

    expect(res.status).toBe(200);
    expect(createInboundMessageIfNew).toHaveBeenCalledTimes(1);
    const [conversationId, body, , externalId] = createInboundMessageIfNew.mock.calls[0] ?? [];
    expect(conversationId).toBe("conv1");
    expect(body).toMatch(/media attachment/i);
    expect(externalId).toBe("SM_mms_1");
    // The contact is still worked like any other inbound: acknowledged and scored.
    expect(acknowledgeNewLead).toHaveBeenCalledTimes(1);
    expect(scoreAndDraftForLead).toHaveBeenCalledWith("lead1");
  });

  it("acknowledges a picture-only MMS with EMPTY inboundText, never the placeholder FollowUp wrote", async () => {
    const form = { From: "+15551230000", Body: "", NumMedia: "2", MessageSid: "SM_mms_2" };

    await smsPost(signedRequest(SMS_URL, form), ctx());

    expect(acknowledgeNewLead).toHaveBeenCalledWith(
      "lead1",
      expect.objectContaining({ channel: "text", inboundText: "" })
    );
  });

  it("still does nothing at all for a truly empty inbound — no body, no media", async () => {
    const form = { From: "+15551230000", Body: "", NumMedia: "0", MessageSid: "SM_empty" };

    await smsPost(signedRequest(SMS_URL, form), ctx());

    expect(createInboundMessageIfNew).not.toHaveBeenCalled();
    expect(acknowledgeNewLead).not.toHaveBeenCalled();
  });

  it("passes the lead's real words through untouched when there IS a body", async () => {
    const form = { From: "+15551230000", Body: "  my boiler is leaking  ", NumMedia: "0", MessageSid: "SM_text" };

    await smsPost(signedRequest(SMS_URL, form), ctx());

    expect(createInboundMessageIfNew).toHaveBeenCalledWith("conv1", "my boiler is leaking", expect.any(Date), "SM_text");
    expect(acknowledgeNewLead).toHaveBeenCalledWith(
      "lead1",
      expect.objectContaining({ inboundText: "my boiler is leaking" })
    );
  });

  it("is idempotent on MessageSid — a redelivery neither re-acknowledges nor re-scores", async () => {
    createInboundMessageIfNew.mockResolvedValue(false); // this SID is already recorded
    const form = { From: "+15551230000", Body: "my boiler is leaking", NumMedia: "0", MessageSid: "SM_dup" };

    const res = await smsPost(signedRequest(SMS_URL, form), ctx());

    expect(res.status).toBe(200);
    expect(acknowledgeNewLead).not.toHaveBeenCalled();
    expect(scoreAndDraftForLead).not.toHaveBeenCalled();
  });
});

describe("POST /api/twilio/whatsapp/[secret] — media-only message", () => {
  it("records the contact instead of dropping it, and acknowledges with empty inboundText", async () => {
    const form = {
      From: "whatsapp:+15551230000",
      To: "whatsapp:+15559990000",
      Body: "",
      NumMedia: "1",
      MessageSid: "SM_wa_1",
    };

    const res = await whatsappPost(signedRequest(WHATSAPP_URL, form), ctx());

    expect(res.status).toBe(200);
    expect(createInboundMessageIfNew).toHaveBeenCalledTimes(1);
    expect(createInboundMessageIfNew.mock.calls[0]?.[1]).toMatch(/media attachment/i);
    expect(acknowledgeNewLead).toHaveBeenCalledWith(
      "lead1",
      expect.objectContaining({ channel: "whatsapp", inboundText: "" })
    );
  });

  it("is idempotent on MessageSid", async () => {
    createInboundMessageIfNew.mockResolvedValue(false);
    const form = { From: "whatsapp:+15551230000", Body: "hola", NumMedia: "0", MessageSid: "SM_wa_dup" };

    await whatsappPost(signedRequest(WHATSAPP_URL, form), ctx());

    expect(acknowledgeNewLead).not.toHaveBeenCalled();
    expect(scoreAndDraftForLead).not.toHaveBeenCalled();
  });
});
