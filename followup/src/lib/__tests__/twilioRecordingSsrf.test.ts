/**
 * POST /api/twilio/voice/transcription/[secret] fetched whatever
 * RecordingUrl the signed payload named (security hunt 2026-09-30).
 *
 * The signature only proves the payload was signed with THIS business's
 * Auth Token, and that token is whatever the business's admin pasted into
 * Settings → Phone — nothing checks it against Twilio. So any tenant admin
 * can sign their own recording callback, point RecordingUrl at an internal
 * address, and have the server fetch it (with redirects followed). The
 * fetch must only ever go to Twilio's own API host.
 */
import { NextRequest } from "next/server";
import { createHmac } from "crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { findUniqueBusiness, findFirstLead, createMessage } = vi.hoisted(() => ({
  findUniqueBusiness: vi.fn(),
  findFirstLead: vi.fn(),
  createMessage: vi.fn(async () => ({})),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    business: { findUnique: findUniqueBusiness },
    lead: { findFirst: findFirstLead },
    message: { create: createMessage },
  },
}));
vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://followupbase.io" }));
vi.mock("@/lib/monitoring", () => ({ recordAuthFailure: vi.fn() }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn() }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn() }));
vi.mock("@/lib/billing", () => ({ requireActiveBilling: vi.fn(async () => true) }));
vi.mock("@/lib/scoring", () => ({ scoreAndDraftForLead: vi.fn() }));
vi.mock("@/lib/conversations", () => ({ findOrCreateConversation: vi.fn(async () => ({ id: "conv1" })) }));
const { transcribeAudio } = vi.hoisted(() => ({ transcribeAudio: vi.fn(async () => "hello") }));
vi.mock("@/lib/integrations/openai", () => ({ transcribeAudio }));

import { POST } from "@/app/api/twilio/voice/transcription/[secret]/route";
import { fetchTwilioRecording } from "@/lib/twilio";

const SECRET = "tenantsecret123";
const URL_PATH = `https://followupbase.io/api/twilio/voice/transcription/${SECRET}`;
// The tenant chose this token itself in Settings → Phone.
const AUTH_TOKEN = "any-token-the-tenant-typed";
const SID = "AC" + "a".repeat(32);

function sign(form: Record<string, string>) {
  const data = URL_PATH + Object.keys(form).sort().map((k) => k + form[k]).join("");
  return createHmac("sha1", AUTH_TOKEN).update(data, "utf8").digest("base64");
}

function signedRequest(form: Record<string, string>) {
  return new NextRequest(URL_PATH, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": sign(form) },
    body: new URLSearchParams(form).toString(),
  });
}

const ctx = { params: Promise.resolve({ secret: SECRET }) } as never;

const fetchMock = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }));

beforeEach(() => {
  findUniqueBusiness.mockResolvedValue({
    id: "biz1",
    name: "Tenant",
    twilioAuthToken: AUTH_TOKEN,
    twilioAccountSid: SID,
    voiceAgentEnabled: false,
  });
  findFirstLead.mockResolvedValue({ id: "lead1" });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("voicemail recording fetch stays on Twilio", () => {
  it("does not fetch a RecordingUrl on another host, even from a correctly signed callback", async () => {
    const form = {
      From: "+15550001111",
      RecordingStatus: "completed",
      // "?x=" swallows the ".mp3" the helper appends.
      RecordingUrl: "http://169.254.169.254/latest/meta-data/iam/security-credentials/?x=",
    };
    const res = await POST(signedRequest(form), ctx);
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(transcribeAudio).not.toHaveBeenCalled();
  });

  it.each([
    "https://api.twilio.com.evil.example/2010-04-01/Accounts/X/Recordings/Y",
    "http://api.twilio.com/2010-04-01/Accounts/" + SID + "/Recordings/RE" + "b".repeat(32),
    "https://user@internal.local/2010-04-01/Accounts/" + SID + "/Recordings/RE" + "b".repeat(32),
    "https://api.twilio.com/admin?x=",
    "not a url",
  ])("fetchTwilioRecording refuses %s", async (url) => {
    await expect(fetchTwilioRecording(url, SID, AUTH_TOKEN)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still fetches a real Twilio recording URL", async () => {
    const real = `https://api.twilio.com/2010-04-01/Accounts/${SID}/Recordings/RE${"c".repeat(32)}`;
    const form = { From: "+15550001111", RecordingStatus: "completed", RecordingUrl: real };
    await POST(signedRequest(form), ctx);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe(`${real}.mp3`);
    expect(createMessage).toHaveBeenCalled();
  });
});
