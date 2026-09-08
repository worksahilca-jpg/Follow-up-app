/**
 * GET /api/twilio/voice-agent-auth/[secret] — the fix for
 * research/audit/2026-09-08-newer-surface-audit.md finding #1: the
 * voice-agent bridge has no DB access, so this endpoint is how it
 * confirms a WebSocket connection's secret is a real business with the
 * voice agent enabled and active billing BEFORE opening a billed OpenAI
 * Realtime session. Every branch here must fail closed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { recordAuthFailure } = vi.hoisted(() => ({ recordAuthFailure: vi.fn() }));
const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
const { requireActiveBilling } = vi.hoisted(() => ({ requireActiveBilling: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: { business: { findUnique } } }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn() }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://followupbase.io" }));
vi.mock("@/lib/monitoring", () => ({ recordAuthFailure }));
vi.mock("@/lib/billing", () => ({ requireActiveBilling }));

import { GET } from "@/app/api/twilio/voice-agent-auth/[secret]/route";

function fakeRequest(authHeader: string | null): Request {
  return new Request("https://followupbase.io/api/twilio/voice-agent-auth/sec_123", {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

function ctx(secret: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { params: Promise.resolve({ secret }) } as any;
}

beforeEach(() => {
  vi.unstubAllEnvs();
  findUnique.mockReset();
  requireActiveBilling.mockReset();
  recordAuthFailure.mockReset();
});

describe("GET /api/twilio/voice-agent-auth/[secret]", () => {
  it("rejects when the bridge's bearer secret is missing or wrong", async () => {
    vi.stubEnv("VOICE_AGENT_CALLBACK_SECRET", "bridge-secret");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await GET(fakeRequest("Bearer wrong") as any, ctx("sec_123"));
    expect(res.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("rejects when VOICE_AGENT_CALLBACK_SECRET was never configured — fails closed, not open", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await GET(fakeRequest(null) as any, ctx("sec_123"));
    expect(res.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("rejects a secret that doesn't match any business", async () => {
    vi.stubEnv("VOICE_AGENT_CALLBACK_SECRET", "bridge-secret");
    findUnique.mockResolvedValue(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await GET(fakeRequest("Bearer bridge-secret") as any, ctx("junk-secret"));
    expect(res.status).toBe(404);
    expect(requireActiveBilling).not.toHaveBeenCalled();
  });

  it("rejects a real business that doesn't have the voice agent enabled", async () => {
    vi.stubEnv("VOICE_AGENT_CALLBACK_SECRET", "bridge-secret");
    findUnique.mockResolvedValue({ id: "biz1", name: "Acme", twilioAuthToken: "tok", twilioAccountSid: "sid", voiceAgentEnabled: false });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await GET(fakeRequest("Bearer bridge-secret") as any, ctx("sec_123"));
    expect(res.status).toBe(404);
    expect(requireActiveBilling).not.toHaveBeenCalled();
  });

  it("rejects a voice-agent-enabled business whose billing has lapsed", async () => {
    vi.stubEnv("VOICE_AGENT_CALLBACK_SECRET", "bridge-secret");
    findUnique.mockResolvedValue({ id: "biz1", name: "Acme", twilioAuthToken: "tok", twilioAccountSid: "sid", voiceAgentEnabled: true });
    requireActiveBilling.mockResolvedValue(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await GET(fakeRequest("Bearer bridge-secret") as any, ctx("sec_123"));
    expect(res.status).toBe(403);
  });

  it("authorizes a real, voice-agent-enabled, actively-billed business", async () => {
    vi.stubEnv("VOICE_AGENT_CALLBACK_SECRET", "bridge-secret");
    findUnique.mockResolvedValue({ id: "biz1", name: "Acme", twilioAuthToken: "tok", twilioAccountSid: "sid", voiceAgentEnabled: true });
    requireActiveBilling.mockResolvedValue(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await GET(fakeRequest("Bearer bridge-secret") as any, ctx("sec_123"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});
