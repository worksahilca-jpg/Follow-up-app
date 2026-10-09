/**
 * POST /api/demo/reply — the home page's "Try it yourself". Over any limit,
 * or on any failure, the visitor still gets a success with `fallback: true`
 * (the page plays its fixed reply), and no OpenAI call is made past a limit.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ claim: vi.fn(), write: vi.fn(), key: vi.fn() }));

vi.mock("@/lib/demoReply", () => ({
  DEMO_MAX_QUESTION: 140,
  claimDemoTry: h.claim,
  writeDemoReply: h.write,
  demoVisitorKey: h.key,
  requestIp: (headers: Headers) => headers.get("x-forwarded-for"),
}));

import { POST } from "@/app/api/demo/reply/route";
import type { NextRequest } from "next/server";

function post(body: unknown) {
  return new Request("https://example.test/api/demo/reply", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.7" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.key.mockReturnValue("hashed-visitor");
  h.claim.mockResolvedValue(null);
  h.write.mockResolvedValue({ reply: "Yes, it is!", kind: "reply", language: null, englishLetters: false, story: null });
});

describe("POST /api/demo/reply", () => {
  it("answers live when the limits have room", async () => {
    const res = await POST(post({ text: "Is it still available?" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, reply: expect.objectContaining({ reply: "Yes, it is!" }) });
    expect(h.key).toHaveBeenCalledWith("198.51.100.7");
    expect(h.claim).toHaveBeenCalledWith("hashed-visitor");
  });

  it("past a limit: the fixed reply, and no OpenAI call", async () => {
    h.claim.mockResolvedValue("visitor");
    const res = await POST(post({ text: "One more?" }));
    expect(await res.json()).toEqual({ success: true, fallback: true, limited: "visitor" });
    expect(h.write).not.toHaveBeenCalled();
  });

  it("no way to count the visitor: the fixed reply, nothing claimed or called", async () => {
    h.key.mockReturnValue(null);
    const res = await POST(post({ text: "Hi" }));
    expect(await res.json()).toEqual({ success: true, fallback: true });
    expect(h.claim).not.toHaveBeenCalled();
    expect(h.write).not.toHaveBeenCalled();
  });

  it("the answer couldn't be written: the fixed reply", async () => {
    h.write.mockResolvedValue(null);
    expect(await (await POST(post({ text: "Hi" }))).json()).toEqual({ success: true, fallback: true });
  });

  it("only the first 140 characters reach the writer", async () => {
    await POST(post({ text: "x".repeat(500) }));
    expect(h.write).toHaveBeenCalledWith("x".repeat(140));
  });

  it("an empty question is refused before any limit is used", async () => {
    const res = await POST(post({ text: "   " }));
    expect(res.status).toBe(400);
    expect(h.claim).not.toHaveBeenCalled();
  });
});
