/**
 * Past the plan's monthly allowance, rewrite, "Catching up" and voicemail
 * transcription stop calling OpenAI (founder, 2026-09-30).
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const refusal = { ok: false as const, reason: "past this month's cap", ownerMessage: "The Free plan covers 20 leads a month and this one is past that." };
const { leadAiRefusal, rewriteReply, summarizeConversation, transcribeAudio, messageCreate } = vi.hoisted(() => ({
  leadAiRefusal: vi.fn(),
  rewriteReply: vi.fn(async () => "rewritten"),
  summarizeConversation: vi.fn(async () => "summary"),
  transcribeAudio: vi.fn(async () => "hello"),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  messageCreate: vi.fn(async (_args: { data: { body: string } }) => ({})),
}));
vi.mock("@/lib/billing", () => ({ requireActiveBilling: vi.fn(async () => true), billingLockedMessage: async () => "locked", leadAiRefusal }));
vi.mock("@/lib/integrations/openai", () => ({ rewriteReply, summarizeConversation, transcribeAudio }));
vi.mock("@/lib/session", () => ({ getSessionContext: vi.fn(async () => ({ businessId: "biz1", userId: "u1", email: "o@acme.com" })) }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions: vi.fn(async () => false) }));
const conversation = Array.from({ length: 8 }, (_, i) => ({ id: `m${i}`, direction: "inbound", channel: "email", body: "x", date: new Date().toISOString() }));
vi.mock("@/lib/leads-data", () => ({ getLeadById: vi.fn(async () => ({ id: "l1", name: "Maya Patel", conversation, languageRead: null })) }));
vi.mock("@/lib/db", () => ({
  prisma: {
    lead: { findUnique: vi.fn(async () => ({ catchUpText: null, catchUpCount: 0 })), findFirst: vi.fn(async () => ({ id: "l1" })), update: vi.fn() },
    message: { create: messageCreate },
  },
}));
vi.mock("@/lib/conversations", () => ({ findOrCreateConversation: vi.fn(async () => ({ id: "c1" })) }));
vi.mock("@/lib/scoring", () => ({ scoreAndDraftForLead: vi.fn(async () => {}) }));
vi.mock("@/lib/twilio", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/twilio")>()),
  findBusinessByTwilioSecret: vi.fn(async () => ({ id: "biz1", twilioAuthToken: "tok", twilioAccountSid: "AC1" })),
  validateTwilioRequestSignature: vi.fn(() => true),
  fetchTwilioRecording: vi.fn(async () => Buffer.from("audio")),
}));

import { POST as rewrite } from "@/app/api/leads/[id]/rewrite/route";
import { GET as catchUp } from "@/app/api/leads/[id]/catch-up/route";
import { POST as voicemail } from "@/app/api/twilio/voice/transcription/[secret]/route";

const idCtx = { params: Promise.resolve({ id: "l1" }) } as never;

beforeEach(() => {
  vi.clearAllMocks();
  leadAiRefusal.mockResolvedValue(refusal);
});

describe("past the monthly allowance", () => {
  it("rewrite says why and doesn't call OpenAI", async () => {
    const res = await rewrite(new NextRequest("https://x/api/leads/l1/rewrite", { method: "POST", body: JSON.stringify({ text: "Hi", style: "shorter" }) }), idCtx);
    expect(res.status).toBe(402);
    expect((await res.json()).message).toBe(refusal.ownerMessage);
    expect(rewriteReply).not.toHaveBeenCalled();
  });

  it("'Catching up' shows nothing new and doesn't call OpenAI", async () => {
    const body = await (await catchUp(new Request("https://x/api/leads/l1/catch-up"), idCtx)).json();
    expect(body.text).toBeNull();
    expect(summarizeConversation).not.toHaveBeenCalled();
  });

  it("a voicemail is noted on the customer, not transcribed", async () => {
    const req = new NextRequest("https://followupbase.io/api/twilio/voice/transcription/sekret", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": "sig" },
      body: new URLSearchParams({ From: "+15550001111", CallSid: "CA1", RecordingUrl: "https://api.twilio.com/2010-04-01/Accounts/AC1/Recordings/RE1", RecordingStatus: "completed" }).toString(),
    });
    await voicemail(req, { params: Promise.resolve({ secret: "sekret" }) } as never);
    expect(transcribeAudio).not.toHaveBeenCalled();
    expect(messageCreate.mock.calls[0][0].data.body).toContain("Left a voicemail");
  });

  it("inside the allowance, all three still work", async () => {
    leadAiRefusal.mockResolvedValue(null);
    await rewrite(new NextRequest("https://x/api/leads/l1/rewrite", { method: "POST", body: JSON.stringify({ text: "Hi", style: "shorter" }) }), idCtx);
    await catchUp(new Request("https://x/api/leads/l1/catch-up"), idCtx);
    expect(rewriteReply).toHaveBeenCalled();
    expect(summarizeConversation).toHaveBeenCalled();
  });
});
