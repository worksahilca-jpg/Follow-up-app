/**
 * Callers who hide their number (founder, 2026-09-30, src/lib/hiddenCaller.ts).
 * They used to merge into one customer, three strangers' voicemails on one
 * card, and the missed-call text went to a number that doesn't exist. Each
 * hidden-number call is now its own "Hidden number" customer, found again
 * by the call's id, and never texted.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = { id: string; businessId: string; name: string; phone: string | null; hiddenCallSid: string | null; automationTier: string };
const { rows, prismaMock } = vi.hoisted(() => {
  const rows: Row[] = [];
  const prismaMock = {
    business: { findUnique: vi.fn(async () => ({ holdAllForApproval: false })) },
    lead: {
      findFirst: vi.fn(async ({ where }: { where: Partial<Row> }) => rows.find((r) => Object.entries(where).every(([k, v]) => r[k as keyof Row] === v)) ?? null),
      create: vi.fn(async ({ data }: { data: Omit<Row, "id"> }) => {
        const row = { ...data, id: `lead${rows.length + 1}` } as Row;
        rows.push(row);
        return row;
      }),
      update: vi.fn(async ({ where }: { where: { id: string } }) => rows.find((r) => r.id === where.id)),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    message: { create: vi.fn(async () => ({})) },
  };
  return { rows, prismaMock };
});
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn(async () => null) }));
vi.mock("@/lib/billing", () => ({ requireActiveBilling: vi.fn(async () => true), leadAiRefusal: vi.fn(async () => null) }));
vi.mock("@/lib/siteUrl", () => ({ inboundBaseUrl: () => "https://followupbase.io" }));
vi.mock("@/lib/conversations", () => ({ findOrCreateConversation: vi.fn(async (leadId: string) => ({ id: `conv-${leadId}` })) }));
vi.mock("@/lib/scoring", () => ({ scoreAndDraftForLead: vi.fn(async () => {}) }));
vi.mock("@/lib/integrations/openai", () => ({ transcribeAudio: vi.fn(async () => "Hi, it's about the leaking roof.") }));

const { sendSms, findOrCreateLeadByPhone } = vi.hoisted(() => ({
  sendSms: vi.fn(async () => ({ success: true })),
  findOrCreateLeadByPhone: vi.fn(async () => ({ id: "known" })),
}));
vi.mock("@/lib/twilio", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/twilio")>();
  return {
    ...actual,
    findBusinessByTwilioSecret: vi.fn(async () => ({ id: "biz1", name: "Acme Plumbing", twilioAuthToken: "tok", twilioAccountSid: "AC1", voiceAgentEnabled: false })),
    validateTwilioRequestSignature: vi.fn(() => true),
    fetchTwilioRecording: vi.fn(async () => Buffer.from("audio")),
    claimMissedCallTextBack: vi.fn(async () => true),
    findOrCreateLeadByPhone,
    sendSms,
  };
});

import { isHiddenCaller, HIDDEN_CALLER_NAME } from "@/lib/hiddenCaller";
import { POST as voice } from "@/app/api/twilio/voice/[secret]/route";
import { POST as voicemail } from "@/app/api/twilio/voice/transcription/[secret]/route";

function form(url: string, fields: Record<string, string>) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": "sig" },
    body: new URLSearchParams(fields).toString(),
  });
}
const ctx = { params: Promise.resolve({ secret: "sekret" }) } as never;
const ring = (From: string, CallSid: string) => voice(form("https://followupbase.io/api/twilio/voice/sekret", { From, CallSid }), ctx);
const leaveVoicemail = (From: string, CallSid: string) =>
  voicemail(
    form("https://followupbase.io/api/twilio/voice/transcription/sekret", {
      From,
      CallSid,
      RecordingUrl: "https://api.twilio.com/2010-04-01/Accounts/AC1/Recordings/RE1",
      RecordingStatus: "completed",
    }),
    ctx
  );

beforeEach(() => {
  rows.length = 0;
  vi.clearAllMocks();
});

describe("isHiddenCaller", () => {
  it("knows the ways Twilio reports a hidden number", () => {
    for (const from of ["+266696687", "+86282452253", "+7378742833", "+2562533", "Anonymous", "RESTRICTED", " private "]) {
      expect(isHiddenCaller(from)).toBe(true);
    }
  });
  it("leaves real numbers alone", () => {
    for (const from of ["+15550001111", "+447700900123", "", null]) expect(isHiddenCaller(from)).toBe(false);
  });
});

describe("a call from a hidden number", () => {
  it("makes each hidden-number call its own customer, never one shared card", async () => {
    await ring("+266696687", "CA1");
    await ring("+266696687", "CA2");
    await ring("Restricted", "CA3");
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row).toMatchObject({ name: HIDDEN_CALLER_NAME, phone: null, automationTier: "OFF" });
    }
    expect(findOrCreateLeadByPhone).not.toHaveBeenCalled();
  });

  it("never sends the missed-call text, since there is no number", async () => {
    await ring("+266696687", "CA1");
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("puts each voicemail on its own caller's card", async () => {
    await ring("+266696687", "CA1");
    await ring("+266696687", "CA2");
    await leaveVoicemail("+266696687", "CA2");
    expect(rows).toHaveLength(2);
    expect(prismaMock.message.create).toHaveBeenCalledWith({ data: expect.objectContaining({ conversationId: "conv-lead2", direction: "inbound" }) });
  });

  it("still texts a caller who shows their number", async () => {
    await ring("+15550001111", "CA9");
    expect(findOrCreateLeadByPhone).toHaveBeenCalled();
    expect(sendSms).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(0);
  });
});
