/**
 * Never lose a lead because of a billing state.
 *
 * Every inbound channel where FollowUp is the ONLY receiver used to refuse
 * outright while `subscriptionStatus` was past_due: the Twilio SMS and
 * WhatsApp webhooks answered an empty <Response/>, the Meta webhook skipped
 * the business's events, the embed widget and the generic lead webhook
 * returned 503. Nothing on the other side retries — Twilio and Meta got
 * their 200, Zapier drops a failed task, the visitor closed the tab — and
 * nothing anywhere held a copy. So a customer whose card expired lost every
 * lead that arrived during the lockout, permanently, and fixing the card
 * brought none of them back. (Email escaped only because Gmail/Outlook keep
 * holding the mail until the next sync.)
 *
 * Capture is free; what costs money is AI processing and sending. So the
 * split is now the same one the Free tier already uses — "capture
 * continues, AI pauses"
 * (research/market/2026-09-11-tier-pricing-recommendation.md §2.2): the
 * routes below capture unconditionally, and checkAiEligibility (@/lib/billing)
 * is the single gate that pauses the spending half. Both halves are
 * asserted here.
 */
import { NextRequest } from "next/server";
import { createHmac } from "crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

// A real, paying business whose card just failed. Everything below runs
// against this one state.
const PAST_DUE = { subscriptionStatus: "past_due", tier: "plus" };

const { businessFindUnique, leadFindFirst, leadUpdate, leadCreate, leadCount, conversationCreate, messageCreate } =
  vi.hoisted(() => ({
    businessFindUnique: vi.fn(),
    leadFindFirst: vi.fn(),
    leadUpdate: vi.fn(),
    leadCreate: vi.fn(),
    leadCount: vi.fn(async () => 1),
    conversationCreate: vi.fn(async () => ({ id: "conv1" })),
    messageCreate: vi.fn(async () => ({ id: "msg1" })),
  }));
vi.mock("@/lib/db", () => ({
  prisma: {
    business: { findUnique: businessFindUnique },
    lead: { findFirst: leadFindFirst, update: leadUpdate, create: leadCreate, count: leadCount },
    conversation: { create: conversationCreate },
    message: { create: messageCreate },
    // Every capture route now writes the raw payload here before doing any
    // work (see @/lib/inboundEvents) — the durability envelope, not the
    // subject of this file. Stubbed so the capture assertions below still
    // reach the processing they're about.
    inboundWebhookEvent: {
      create: async () => ({ id: "evt-test", receivedAt: new Date() }),
      update: async () => ({}),
    },
  },
}));

type CreateInboundMessageIfNew = (
  conversationId: string,
  body: string,
  sentAt: Date,
  externalId?: string
) => Promise<boolean>;
const { createInboundMessageIfNew } = vi.hoisted(() => ({
  createInboundMessageIfNew: vi.fn<CreateInboundMessageIfNew>(async () => true),
}));
vi.mock("@/lib/instagram", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/instagram")>()),
  createInboundMessageIfNew,
  findOrCreateLeadByInstagram: vi.fn(async () => ({ id: "lead1", businessId: "biz1" })),
}));
vi.mock("@/lib/facebook", () => ({
  findOrCreateLeadByMessenger: vi.fn(async () => ({ id: "lead1", businessId: "biz1" })),
  fetchLeadgenLead: vi.fn(async () => null),
  upsertLeadFromLeadgen: vi.fn(async () => null),
}));

// The two spending calls. Asserting they're NOT called would only prove the
// routes stopped calling them; they're mocked here so this file can assert
// the opposite — that capture reaches them — while the gate that actually
// pauses them is exercised for real in the last describe block below.
const { acknowledgeNewLead } = vi.hoisted(() => ({ acknowledgeNewLead: vi.fn(async () => ({ sent: false })) }));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead }));
const { scoreAndDraftForLead } = vi.hoisted(() => ({ scoreAndDraftForLead: vi.fn(async () => false) }));
vi.mock("@/lib/scoring", () => ({ scoreAndDraftForLead }));

const { findOrCreateConversation } = vi.hoisted(() => ({
  findOrCreateConversation: vi.fn(async () => ({ id: "conv1" })),
}));
vi.mock("@/lib/conversations", () => ({ findOrCreateConversation }));

const { applySourceRouting } = vi.hoisted(() => ({ applySourceRouting: vi.fn() }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting }));

vi.mock("@/lib/engagement", () => ({ checkRapidEngagement: vi.fn() }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn(async () => null) }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentLeads: vi.fn(async () => false) }));
vi.mock("@/lib/leadConflict", () => ({ findConflictingLead: vi.fn(async () => null) }));
vi.mock("@/lib/monitoring", () => ({ recordAuthFailure: vi.fn() }));
// twilio.ts signs against appUrl() — pin it so the test's signatures match.
vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://followupbase.io" }));
vi.mock("@/lib/integrations/openai", () => ({
  generateInstantReply: vi.fn(),
  assessAckRisk: vi.fn(),
  localizeFixedText: vi.fn(async (t: string) => t),
}));

import { POST as smsPost } from "@/app/api/twilio/sms/[secret]/route";
import { POST as whatsappPost } from "@/app/api/twilio/whatsapp/[secret]/route";
import { POST as metaPost } from "@/app/api/instagram/webhook/route";
import { POST as embedPost } from "@/app/api/embed/[businessId]/lead/route";
import { POST as leadWebhookPost } from "@/app/api/webhooks/lead/[secret]/route";
import { checkAiEligibility, AI_PAUSED_BILLING_REASON } from "@/lib/billing";

const AUTH_TOKEN = "auth-token-1";
const META_SECRET = "instagram-app-secret";
const SECRET = "sekret123";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const secretCtx = () => ({ params: Promise.resolve({ secret: SECRET }) }) as any;

function sign(url: string, form: Record<string, string>) {
  const data =
    url +
    Object.keys(form)
      .sort()
      .map((k) => k + form[k])
      .join("");
  return createHmac("sha1", AUTH_TOKEN).update(data, "utf8").digest("base64");
}

function signedTwilioRequest(url: string, form: Record<string, string>) {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": sign(url, form),
    },
    body: new URLSearchParams(form).toString(),
  });
}

function metaRequest(payload: unknown) {
  const raw = JSON.stringify(payload);
  const signature = `sha256=${createHmac("sha256", META_SECRET).update(raw, "utf8").digest("hex")}`;
  return new NextRequest("https://followupbase.io/api/instagram/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "x-hub-signature-256": signature },
    body: raw,
  });
}

function jsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.INSTAGRAM_APP_SECRET = META_SECRET;
  businessFindUnique.mockResolvedValue({
    id: "biz1",
    name: "Acme Plumbing",
    twilioAuthToken: AUTH_TOKEN,
    twilioAccountSid: "AC1",
    voiceAgentEnabled: false,
    ...PAST_DUE,
  });
  leadFindFirst.mockResolvedValue(null);
  leadCreate.mockImplementation(async () => ({ id: "lead1", businessId: "biz1", phone: "+15551230000" }));
  leadUpdate.mockImplementation(async () => ({ id: "lead1", businessId: "biz1", phone: "+15551230000" }));
  createInboundMessageIfNew.mockResolvedValue(true);
  leadCount.mockResolvedValue(1);
});

describe("inbound SMS during a billing lockout", () => {
  it("still records the message instead of discarding a lead nothing else holds a copy of", async () => {
    const url = `https://followupbase.io/api/twilio/sms/${SECRET}`;
    const form = { From: "+15551230000", Body: "Do you do emergency callouts?", MessageSid: "SM1", NumMedia: "0" };

    const res = await smsPost(signedTwilioRequest(url, form), secretCtx());

    expect(res.status).toBe(200);
    expect(leadCreate).toHaveBeenCalled();
    expect(createInboundMessageIfNew).toHaveBeenCalledWith("conv1", "Do you do emergency callouts?", expect.any(Date), "SM1");
  });
});

describe("inbound WhatsApp during a billing lockout", () => {
  it("still records the message", async () => {
    const url = `https://followupbase.io/api/twilio/whatsapp/${SECRET}`;
    const form = { From: "whatsapp:+15551230000", Body: "Is the unit still available?", MessageSid: "SM2", NumMedia: "0" };

    const res = await whatsappPost(signedTwilioRequest(url, form), secretCtx());

    expect(res.status).toBe(200);
    expect(leadCreate).toHaveBeenCalled();
    expect(createInboundMessageIfNew).toHaveBeenCalledWith("conv1", "Is the unit still available?", expect.any(Date), "SM2");
  });
});

describe("inbound Instagram DM during a billing lockout", () => {
  it("still records the DM instead of skipping the whole business's events", async () => {
    const payload = {
      object: "instagram",
      entry: [
        {
          id: "ig-account-1",
          messaging: [{ sender: { id: "ig-sender-1" }, message: { mid: "mid_1", text: "Hi, are you taking bookings?" } }],
        },
      ],
    };

    const res = await metaPost(metaRequest(payload));

    expect(res.status).toBe(200);
    expect(createInboundMessageIfNew).toHaveBeenCalledWith("conv1", "Hi, are you taking bookings?", expect.any(Date), "mid_1", undefined);
  });
});

describe("inbound Messenger DM during a billing lockout", () => {
  it("still records the DM", async () => {
    const payload = {
      object: "page",
      entry: [
        {
          id: "page-1",
          messaging: [{ sender: { id: "fb-sender-1" }, message: { mid: "mid_2", text: "What do you charge for a quote?" } }],
        },
      ],
    };

    const res = await metaPost(metaRequest(payload));

    expect(res.status).toBe(200);
    expect(createInboundMessageIfNew).toHaveBeenCalledWith("conv1", "What do you charge for a quote?", expect.any(Date), "mid_2", undefined);
  });
});

describe("the embed widget during a billing lockout", () => {
  it("accepts the submission instead of telling the visitor to reach out another way", async () => {
    const req = jsonRequest("https://followupbase.io/api/embed/biz1/lead", {
      name: "Dana Reed",
      email: "dana@example.com",
      message: "Looking for a quote on a bathroom reno.",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await embedPost(req, { params: Promise.resolve({ businessId: "biz1" }) } as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(leadCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ source: "Website form" }) }));
    // The form's message goes through the same idempotent writer the Twilio
    // and Meta paths use (createInboundMessageIfNew, mocked above), keyed on
    // the InboundWebhookEvent row id — these two channels have no
    // provider-supplied message id of their own, so that id is what keeps a
    // replay from appending the visitor's message twice.
    expect(createInboundMessageIfNew).toHaveBeenCalledWith(
      "conv1",
      "Looking for a quote on a bathroom reno.",
      expect.any(Date),
      "evt-test"
    );
    // Capture is the whole point, so the per-source rules that fire on
    // capture still fire. See src/lib/sourceRouting.ts.
    expect(applySourceRouting).toHaveBeenCalledWith("biz1", "lead1", "Website form");
  });
});

describe("the generic lead webhook during a billing lockout", () => {
  it("accepts the lead instead of 503ing a Zap that will never replay it", async () => {
    const req = jsonRequest(`https://followupbase.io/api/webhooks/lead/${SECRET}`, {
      name: "Sam Okafor",
      email: "sam@example.com",
      message: "Need someone this week.",
    });

    const res = await leadWebhookPost(req, secretCtx());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(leadCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ source: "Webhook" }) }));
  });
});

describe("what still pauses while billing is lapsed", () => {
  const lead = { id: "lead1", createdAt: new Date("2026-09-15T10:00:00Z"), source: "SMS" };

  it("refuses AI processing for a past_due paid business, however early in the month the lead is", async () => {
    leadCount.mockResolvedValue(1);
    const verdict = await checkAiEligibility("biz1", lead, "plus");

    expect(verdict.ok).toBe(false);
    expect((verdict as { ok: false; reason: string }).reason).toBe(AI_PAUSED_BILLING_REASON);
  });

  it("refuses AI processing for a cancelled business that hasn't been reset to Free yet", async () => {
    businessFindUnique.mockResolvedValue({ subscriptionStatus: "canceled" });
    const verdict = await checkAiEligibility("biz1", lead, "pro");

    expect(verdict.ok).toBe(false);
  });

  it("says so in words the owner can act on — never blaming the lead", async () => {
    const verdict = await checkAiEligibility("biz1", lead, "plus");

    expect((verdict as { ok: false; reason: string }).reason).toMatch(/still captured/);
  });

  it("still allows AI for a genuine Free business, which has no subscription at all", async () => {
    businessFindUnique.mockResolvedValue({ subscriptionStatus: null });
    const verdict = await checkAiEligibility("biz1", { ...lead, source: "Website form" }, "free");

    expect(verdict.ok).toBe(true);
  });

  it("still allows AI for a paying business in good standing", async () => {
    businessFindUnique.mockResolvedValue({ subscriptionStatus: "active" });
    const verdict = await checkAiEligibility("biz1", lead, "plus");

    expect(verdict.ok).toBe(true);
  });

  it("still allows AI during the free trial", async () => {
    businessFindUnique.mockResolvedValue({ subscriptionStatus: "trialing" });
    const verdict = await checkAiEligibility("biz1", lead, "plus");

    expect(verdict.ok).toBe(true);
  });
});
