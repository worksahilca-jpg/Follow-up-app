/**
 * "If Twilio crashes I don't want FollowUp to crash as well, and I don't
 * want to lose leads."
 *
 * Every inbound webhook used to parse its payload and then do all the work
 * — find-or-create the lead, write the message, score it, acknowledge it —
 * inside the request. Twilio and Meta both stop retrying the instant they
 * get a 2xx, and all of these routes must answer 2xx. So a throw partway
 * through the work destroyed the message: the provider's copy was gone, and
 * nothing on disk recorded that it had ever arrived.
 *
 * These tests pin the fix: the raw payload lands in InboundWebhookEvent
 * BEFORE any processing, the provider still gets its TwiML / 200, and a
 * processing failure is written onto that row instead of being swallowed —
 * leaving a replayable record rather than a hole.
 *
 * They also pin the two things that must NOT change while doing it:
 * signature validation still happens before anything is persisted, and no
 * billing gate comes back to these capture routes.
 *
 * The per-channel processors are mocked here on purpose. What is under test
 * is the durability envelope around them — persist, mark, answer — not the
 * lead/message/scoring behavior, which is unchanged and covered elsewhere.
 */
import { NextRequest } from "next/server";
import { createHmac } from "crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  businessFindUnique,
  eventCreate,
  eventUpdate,
  eventFindUnique,
  eventFindMany,
  eventDeleteMany,
  processTwilioInbound,
  processMetaEnvelope,
  processLeadFormSubmission,
  tooManyRecentLeads,
  recordAuthFailure,
} = vi.hoisted(() => ({
  businessFindUnique: vi.fn(),
  eventCreate:
    vi.fn<(args: { data: Record<string, unknown> }) => Promise<{ id: string; receivedAt: Date }>>(),
  eventUpdate: vi.fn<(args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>>(
    async () => ({})
  ),
  eventFindUnique: vi.fn(),
  eventFindMany: vi.fn(async () => []),
  eventDeleteMany: vi.fn<(args: { where: Record<string, unknown> }) => Promise<{ count: number }>>(async () => ({
    count: 0,
  })),
  processTwilioInbound: vi.fn(async () => {}),
  processMetaEnvelope: vi.fn(async () => {}),
  processLeadFormSubmission: vi.fn(async () => ({ leadId: "lead-1" })),
  tooManyRecentLeads: vi.fn(async () => false),
  recordAuthFailure: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    business: { findUnique: businessFindUnique },
    inboundWebhookEvent: {
      create: eventCreate,
      update: eventUpdate,
      findUnique: eventFindUnique,
      findMany: eventFindMany,
      deleteMany: eventDeleteMany,
    },
  },
}));
vi.mock("@/lib/inbound/twilioMessage", () => ({ processTwilioInbound }));
vi.mock("@/lib/inbound/meta", () => ({ processMetaEnvelope }));
vi.mock("@/lib/inbound/leadForm", () => ({ processLeadFormSubmission }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentLeads }));
vi.mock("@/lib/monitoring", () => ({ recordAuthFailure }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn() }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn() }));
vi.mock("@/lib/conversations", () => ({ findOrCreateConversation: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://followupbase.io" }));

import { POST as smsPOST } from "@/app/api/twilio/sms/[secret]/route";
import { POST as whatsappPOST } from "@/app/api/twilio/whatsapp/[secret]/route";
import { POST as metaPOST } from "@/app/api/instagram/webhook/route";
import { POST as embedPOST } from "@/app/api/embed/[businessId]/lead/route";
import { POST as leadWebhookPOST } from "@/app/api/webhooks/lead/[secret]/route";
import { pruneInboundWebhookEvents, replayInboundWebhookEvent } from "@/lib/inboundEvents";

const AUTH_TOKEN = "auth-token-1";
const IG_SECRET = "instagram-app-secret";
const RECEIVED_AT = new Date("2026-09-15T12:00:00.000Z");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const routeCtx = (value: Record<string, string>) => ({ params: Promise.resolve(value) }) as any;

function twilioRequest(url: string, form: Record<string, string>, signature?: string) {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(signature ? { "x-twilio-signature": signature } : {}),
    },
    body: new URLSearchParams(form).toString(),
  });
}

function signTwilio(url: string, form: Record<string, string>) {
  const data =
    url +
    Object.keys(form)
      .sort()
      .map((k) => k + form[k])
      .join("");
  return createHmac("sha1", AUTH_TOKEN).update(data, "utf8").digest("base64");
}

function metaRequest(body: string, signature?: string | null) {
  return new NextRequest("https://followupbase.io/api/instagram/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", ...(signature ? { "x-hub-signature-256": signature } : {}) },
    body,
  });
}

const signMeta = (body: string) => `sha256=${createHmac("sha256", IG_SECRET).update(body, "utf8").digest("hex")}`;

function jsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** The row `recordInboundWebhookEvent` would have written, as the update calls refer to it. */
function storedRow() {
  expect(eventCreate).toHaveBeenCalledTimes(1);
  return eventCreate.mock.calls[0][0].data;
}

function statusUpdates() {
  return eventUpdate.mock.calls.map((call) => call[0].data);
}

beforeEach(() => {
  vi.stubEnv("INSTAGRAM_APP_SECRET", IG_SECRET);
  // mockReset, not just the config's clearMocks: several tests below queue a
  // one-shot rejection, and a `mockRejectedValueOnce` that the test under
  // test never consumed would otherwise leak into the next one.
  for (const mock of [processTwilioInbound, processMetaEnvelope, processLeadFormSubmission, eventUpdate]) {
    mock.mockReset();
  }
  eventUpdate.mockResolvedValue({});
  eventCreate.mockResolvedValue({ id: "evt-1", receivedAt: RECEIVED_AT });
  businessFindUnique.mockResolvedValue({ id: "biz1", twilioAuthToken: AUTH_TOKEN });
  tooManyRecentLeads.mockResolvedValue(false);
  processTwilioInbound.mockResolvedValue(undefined);
  processMetaEnvelope.mockResolvedValue(undefined);
  processLeadFormSubmission.mockResolvedValue({ leadId: "lead-1" });
  // Silence the deliberate console.error on the failure paths below.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("inbound SMS webhook durability", () => {
  const URL_PATH = "https://followupbase.io/api/twilio/sms/sekret123";
  const form = { From: "+14155551234", Body: "is the roof job still available?", MessageSid: "SM123", NumMedia: "0" };

  it("persists the raw payload BEFORE any processing runs", async () => {
    await smsPOST(twilioRequest(URL_PATH, form, signTwilio(URL_PATH, form)), routeCtx({ secret: "sekret123" }));

    expect(storedRow()).toMatchObject({
      provider: "twilio",
      channel: "sms",
      businessId: "biz1",
      externalId: "SM123",
      payload: form,
    });
    // The ordering is the entire guarantee: if processing ran first, a
    // crash inside it would leave nothing on disk, which is the bug.
    expect(eventCreate.mock.invocationCallOrder[0]).toBeLessThan(processTwilioInbound.mock.invocationCallOrder[0]);
  });

  it("records a processing failure on the row and STILL answers Twilio with TwiML", async () => {
    processTwilioInbound.mockRejectedValueOnce(new Error("OpenAI request timed out"));

    const res = await smsPOST(
      twilioRequest(URL_PATH, form, signTwilio(URL_PATH, form)),
      routeCtx({ secret: "sekret123" })
    );

    // Twilio's contract is unchanged — anything other than TwiML here makes
    // it fall back/alert on a message that is already safely on disk.
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/xml");
    expect(await res.text()).toContain("<Response/>");

    // ...and the payload is recoverable, with the reason it failed.
    expect(storedRow()).toMatchObject({ payload: form });
    const [update] = statusUpdates();
    expect(update).toMatchObject({ status: "failed", attempts: { increment: 1 } });
    expect(String(update.error)).toContain("OpenAI request timed out");
  });

  it("marks the row processed when the work completes", async () => {
    await smsPOST(twilioRequest(URL_PATH, form, signTwilio(URL_PATH, form)), routeCtx({ secret: "sekret123" }));

    expect(statusUpdates()[0]).toMatchObject({ status: "processed", error: null });
  });

  it("persists NOTHING for a request that fails the Twilio signature check", async () => {
    const res = await smsPOST(twilioRequest(URL_PATH, form, "not-a-real-signature"), routeCtx({ secret: "sekret123" }));

    expect(res.status).toBe(200);
    // An unverified payload must never be stored as though it were real.
    expect(eventCreate).not.toHaveBeenCalled();
    expect(processTwilioInbound).not.toHaveBeenCalled();
    expect(recordAuthFailure).toHaveBeenCalled();
  });

  it("persists NOTHING when the business has no Auth Token to verify against", async () => {
    businessFindUnique.mockResolvedValue({ id: "biz1", twilioAuthToken: null });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await smsPOST(twilioRequest(URL_PATH, form), routeCtx({ secret: "sekret123" }));

    expect(eventCreate).not.toHaveBeenCalled();
  });
});

describe("inbound WhatsApp webhook durability", () => {
  const URL_PATH = "https://followupbase.io/api/twilio/whatsapp/sekret123";
  const form = { From: "whatsapp:+14155551234", Body: "", MessageSid: "SM900", NumMedia: "1" };

  it("persists a media-only WhatsApp payload and records a processing failure against it", async () => {
    processTwilioInbound.mockRejectedValueOnce(new Error("cold start killed the container"));

    const res = await whatsappPOST(
      twilioRequest(URL_PATH, form, signTwilio(URL_PATH, form)),
      routeCtx({ secret: "sekret123" })
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<Response/>");
    expect(storedRow()).toMatchObject({ provider: "twilio", channel: "whatsapp", businessId: "biz1", payload: form });
    expect(statusUpdates()[0]).toMatchObject({ status: "failed" });
  });
});

describe("Meta webhook durability (Instagram / Messenger / Lead Ads)", () => {
  const envelope = { object: "instagram", entry: [{ id: "ig-1", messaging: [{ sender: { id: "u1" }, message: { text: "hi" } }] }] };
  const body = JSON.stringify(envelope);

  it("persists the signed envelope before processing it", async () => {
    await metaPOST(metaRequest(body, signMeta(body)));

    expect(storedRow()).toMatchObject({
      provider: "meta",
      channel: "instagram_or_messenger",
      // One envelope can carry entries for several connected accounts, so
      // attribution happens per-entry during processing, not here.
      businessId: null,
      payload: envelope,
    });
    expect(eventCreate.mock.invocationCallOrder[0]).toBeLessThan(processMetaEnvelope.mock.invocationCallOrder[0]);
  });

  it("records a processing failure and STILL answers Meta 200", async () => {
    processMetaEnvelope.mockRejectedValueOnce(new Error("Graph API 500 on leadgen fetch"));

    const res = await metaPOST(metaRequest(body, signMeta(body)));

    // A non-2xx here starts Meta's retry storm against an envelope that is
    // already safely on disk — and eventually gets the subscription disabled.
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(storedRow()).toMatchObject({ payload: envelope });
    const [update] = statusUpdates();
    expect(update).toMatchObject({ status: "failed" });
    expect(String(update.error)).toContain("Graph API 500 on leadgen fetch");
  });

  it("persists NOTHING for a payload that fails the Meta signature check", async () => {
    const res = await metaPOST(metaRequest(body, `sha256=${"0".repeat(64)}`));

    expect(res.status).toBe(403);
    expect(eventCreate).not.toHaveBeenCalled();
    expect(processMetaEnvelope).not.toHaveBeenCalled();
  });

  it("stores a correctly-signed but unparseable body verbatim instead of dropping it", async () => {
    const garbage = "{not json at all";

    const res = await metaPOST(metaRequest(garbage, signMeta(garbage)));

    expect(res.status).toBe(200);
    expect(storedRow()).toMatchObject({ payload: { __unparsedBody: garbage } });
    // Nothing to process it into — but the bytes exist, which is the only
    // evidence anyone would have that Meta sent something unexpected.
    expect(processMetaEnvelope).not.toHaveBeenCalled();
    expect(statusUpdates()[0]).toMatchObject({ status: "failed" });
  });
});

describe("embed form durability", () => {
  const URL_PATH = "https://followupbase.io/api/embed/biz1/lead";
  const submission = { name: "Dana", email: "Dana@example.com", phone: "", message: "quote for a new roof?" };

  it("persists the submission before creating the lead", async () => {
    await embedPOST(jsonRequest(URL_PATH, submission), routeCtx({ businessId: "biz1" }));

    expect(storedRow()).toMatchObject({
      provider: "http",
      channel: "embed_form",
      businessId: "biz1",
      payload: { name: "Dana", email: "dana@example.com", message: "quote for a new roof?" },
    });
    expect(eventCreate.mock.invocationCallOrder[0]).toBeLessThan(processLeadFormSubmission.mock.invocationCallOrder[0]);
  });

  it("keeps the enquiry when processing throws, and does not tell the visitor it failed", async () => {
    processLeadFormSubmission.mockRejectedValueOnce(new Error("scoreAndDraftForLead timed out"));

    const res = await embedPOST(jsonRequest(URL_PATH, submission), routeCtx({ businessId: "biz1" }));

    // The enquiry IS durably stored; a failure response would invite a
    // re-submit (a duplicate lead) or leave the visitor thinking their
    // message never landed.
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, queued: true });
    expect(storedRow()).toMatchObject({ payload: { name: "Dana" } });
    expect(statusUpdates()[0]).toMatchObject({ status: "failed" });
  });

  it("persists NOTHING for a honeypot submission", async () => {
    const res = await embedPOST(
      jsonRequest(URL_PATH, { ...submission, hp: "i am a bot" }),
      routeCtx({ businessId: "biz1" })
    );

    expect(await res.json()).toEqual({ success: true });
    expect(eventCreate).not.toHaveBeenCalled();
  });

  it("persists NOTHING when the submission is rejected before it counts as a lead", async () => {
    // Rate-limited, and missing-name: both are answers the caller can see
    // and act on, so there is nothing lost yet to write down.
    tooManyRecentLeads.mockResolvedValueOnce(true);
    await embedPOST(jsonRequest(URL_PATH, submission), routeCtx({ businessId: "biz1" }));
    expect(eventCreate).not.toHaveBeenCalled();

    await embedPOST(jsonRequest(URL_PATH, { ...submission, name: "" }), routeCtx({ businessId: "biz1" }));
    expect(eventCreate).not.toHaveBeenCalled();
  });
});

describe("generic lead webhook durability", () => {
  const URL_PATH = "https://followupbase.io/api/webhooks/lead/hooksecret";
  const submission = { name: "Sam", email: "sam@example.com", phone: "", message: "need a quote" };

  it("persists the payload before creating the lead and echoes the lead id back", async () => {
    const res = await leadWebhookPOST(jsonRequest(URL_PATH, submission), routeCtx({ secret: "hooksecret" }));

    expect(storedRow()).toMatchObject({ provider: "http", channel: "webhook_lead", businessId: "biz1" });
    expect(eventCreate.mock.invocationCallOrder[0]).toBeLessThan(processLeadFormSubmission.mock.invocationCallOrder[0]);
    expect(await res.json()).toEqual({ success: true, leadId: "lead-1" });
  });

  it("keeps the payload when processing throws, rather than 500ing a Zap that won't replay", async () => {
    processLeadFormSubmission.mockRejectedValueOnce(new Error("database connection reset"));

    const res = await leadWebhookPOST(jsonRequest(URL_PATH, submission), routeCtx({ secret: "hooksecret" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, queued: true });
    expect(statusUpdates()[0]).toMatchObject({ status: "failed" });
  });

  it("persists NOTHING for an invalid webhook secret", async () => {
    businessFindUnique.mockResolvedValue(null);

    const res = await leadWebhookPOST(jsonRequest(URL_PATH, submission), routeCtx({ secret: "revoked" }));

    expect(res.status).toBe(404);
    expect(eventCreate).not.toHaveBeenCalled();
  });
});

describe("replay", () => {
  it("re-runs a failed row through the same processor and flips it to processed", async () => {
    eventFindUnique.mockResolvedValue({
      id: "evt-9",
      provider: "twilio",
      channel: "sms",
      businessId: "biz1",
      payload: { From: "+14155551234", Body: "still waiting on that quote", MessageSid: "SM777" },
      receivedAt: RECEIVED_AT,
      status: "failed",
    });

    const result = await replayInboundWebhookEvent("evt-9");

    expect(result).toEqual({ replayed: true });
    expect(processTwilioInbound).toHaveBeenCalledWith("biz1", "text", {
      From: "+14155551234",
      Body: "still waiting on that quote",
      MessageSid: "SM777",
    });
    expect(eventUpdate).toHaveBeenCalledWith({
      where: { id: "evt-9" },
      data: { status: "processed", processedAt: expect.any(Date), attempts: { increment: 1 }, error: null },
    });
  });

  it("re-records the failure and does not throw when a replay fails again", async () => {
    eventFindUnique.mockResolvedValue({
      id: "evt-10",
      provider: "meta",
      channel: "instagram_or_messenger",
      businessId: null,
      payload: { object: "instagram", entry: [] },
      receivedAt: RECEIVED_AT,
      status: "failed",
    });
    processMetaEnvelope.mockRejectedValueOnce(new Error("still broken"));

    const result = await replayInboundWebhookEvent("evt-10");

    expect(result.replayed).toBe(false);
    expect(statusUpdates()[0]).toMatchObject({ status: "failed", attempts: { increment: 1 } });
  });

  it("refuses to replay a row that already processed, so nothing is done twice", async () => {
    eventFindUnique.mockResolvedValue({
      id: "evt-11",
      provider: "twilio",
      channel: "sms",
      businessId: "biz1",
      payload: {},
      receivedAt: RECEIVED_AT,
      status: "processed",
    });

    expect(await replayInboundWebhookEvent("evt-11")).toEqual({ replayed: false, message: "Already processed." });
    expect(processTwilioInbound).not.toHaveBeenCalled();
  });
});

describe("retention", () => {
  it("prunes processed rows after 14 days and unreplayed ones after 90", async () => {
    const now = new Date("2026-09-15T00:00:00.000Z");

    await pruneInboundWebhookEvents(now);

    const wheres = eventDeleteMany.mock.calls.map((call) => call[0].where);
    expect(wheres).toContainEqual({
      status: "processed",
      receivedAt: { lt: new Date("2026-09-01T00:00:00.000Z") },
    });
    expect(wheres).toContainEqual({
      status: { in: ["pending", "failed"] },
      receivedAt: { lt: new Date("2026-06-17T00:00:00.000Z") },
    });
  });
});
