/**
 * /api/business/tell/talk, "Talk to FollowUp about your business" (A-318): a recording is written down, read against
 * the meeting's questions, and what it took waits in the meeting's draft with the words; nothing is used before "Looks
 * right"; a value not in the words is dropped; the recording is never stored; admins only, from this app only; limited
 * and audited without the words.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getSessionContext, requireAdmin } = vi.hoisted(() => ({ getSessionContext: vi.fn(), requireAdmin: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));
const { tooManyRecentActions } = vi.hoisted(() => ({ tooManyRecentActions: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions }));
const { recordAudit } = vi.hoisted(() => ({ recordAudit: vi.fn<(ctx: unknown, action: string, details: { meta?: unknown }) => Promise<boolean>>(async () => true) }));
vi.mock("@/lib/audit", () => ({ recordAudit }));
const { transcribeAudio, proposeTellTalk, wordTellQuestion, summarizeTellProfile } = vi.hoisted(() => ({
  transcribeAudio: vi.fn(),
  proposeTellTalk: vi.fn(),
  wordTellQuestion: vi.fn(),
  summarizeTellProfile: vi.fn(),
}));
vi.mock("@/lib/integrations/openai", () => ({ transcribeAudio, proposeTellTalk, wordTellQuestion, summarizeTellProfile }));
vi.mock("@/lib/scoring", () => ({ AI_RUNS_PER_BUSINESS_PER_DAY: { windowMinutes: 1440, max: 500 } }));
const { prismaMock, biz } = vi.hoisted(() => ({
  prismaMock: { business: { findUnique: vi.fn(), update: vi.fn() }, businessFact: { findMany: vi.fn() } },
  biz: { current: {} as Record<string, unknown> },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { POST } from "../route";

const SAID =
  "So I'm a realtor in Mississauga and Oakville, mostly first-time buyers. My commission is 2.5% of the sale price. " +
  "I don't do rentals.";

function req(opts: { type?: string; seconds?: string; size?: number; headers?: Record<string, string>; again?: boolean } = {}) {
  const form = new FormData();
  form.append("audio", new Blob([new Uint8Array(opts.size ?? 2048)], { type: opts.type ?? "audio/webm;codecs=opus" }), "talk");
  form.append("seconds", opts.seconds ?? "134");
  form.append("again", opts.again ? "1" : "0");
  return new NextRequest("http://localhost/api/business/tell/talk", { method: "POST", body: form, headers: opts.headers });
}
const call = async (opts: Parameters<typeof req>[0] = {}) => {
  const res = await POST(req(opts));
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "u1" });
  requireAdmin.mockResolvedValue(true);
  tooManyRecentActions.mockResolvedValue(false);
  transcribeAudio.mockResolvedValue(SAID);
  proposeTellTalk.mockResolvedValue([
    { label: "What you do", value: "I'm a realtor in Mississauga and Oakville" },
    { label: "Commission", value: "2.5% of the sale price" },
    { label: "What you don't do", value: "I don't do rentals" },
  ]);
  wordTellQuestion.mockResolvedValue(null);
  summarizeTellProfile.mockResolvedValue(null);
  biz.current = { industry: "Real estate", questionsSkipped: [], tellCardClosedAt: null, tellDraft: null };
  prismaMock.business.findUnique.mockImplementation(async () => ({ ...biz.current }));
  prismaMock.business.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    biz.current = { ...biz.current, ...data };
    return biz.current;
  });
  prismaMock.businessFact.findMany.mockResolvedValue([]);
});

describe("a talk", () => {
  it("goes into the meeting's draft with the words, and comes back as the play-back", async () => {
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(biz.current.tellDraft).toEqual({
      rows: [
        { label: "What you do", value: "I'm a realtor in Mississauga and Oakville" },
        { label: "Commission", value: "2.5% of the sale price" },
        { label: "What you don't do", value: "I don't do rentals" },
      ],
      talk: { text: SAID, seconds: 134 },
    });
    expect(body.playback.talk).toEqual({ text: SAID, seconds: 134 });
    expect(body.playback.rows.map((r: { label: string }) => r.label)).toEqual(["What you do", "Commission", "What you don't do"]);
    // Questions the talk didn't cover stay open, for "Not in what you said".
    expect(body.state.open.length).toBeGreaterThan(0);
    expect(body.state.open).not.toContain("Commission");
  });

  it("names the recording for the transcription by its kind, and never stores it", async () => {
    await call({ type: "audio/mp4" });
    expect(transcribeAudio).toHaveBeenCalledWith(expect.any(Buffer), "talk.mp4");
    expect(JSON.stringify(prismaMock.business.update.mock.calls)).not.toContain("audio");
  });

  it("drops a value that isn't in the words", async () => {
    proposeTellTalk.mockResolvedValue([
      { label: "Commission", value: "2% flat" },
      { label: "What you do", value: "I'm a realtor in Mississauga and Oakville" },
    ]);
    await call();
    expect((biz.current.tellDraft as { rows: unknown[] }).rows).toEqual([{ label: "What you do", value: "I'm a realtor in Mississauga and Oakville" }]);
  });

  it("keeps nothing when nothing usable was said, or the words couldn't be read", async () => {
    proposeTellTalk.mockResolvedValue([]);
    expect((await call()).status).toBe(422);
    proposeTellTalk.mockRejectedValue(new Error("boom"));
    expect((await call()).status).toBe(422);
    expect(biz.current.tellDraft).toBeNull();
  });

  it("says so when it couldn't be written down", async () => {
    transcribeAudio.mockRejectedValue(new Error("down"));
    const { status, body } = await call();
    expect(status).toBe(502);
    expect(body.message).toMatch(/type instead/);
    transcribeAudio.mockResolvedValue("   ");
    expect((await call()).status).toBe(422);
    expect(biz.current.tellDraft).toBeNull();
  });

  it("rests the daily question and is audited without the words", async () => {
    await call();
    expect((biz.current.questionAfter as Date).getTime()).toBeGreaterThan(Date.now());
    expect(biz.current.tellCardClosedAt).toBeInstanceOf(Date);
    const audit = JSON.stringify(recordAudit.mock.calls);
    expect(audit).toContain('"talked"');
    expect(audit).not.toContain("Oakville");
  });
});

describe("what it refuses", () => {
  it("anyone but an admin, and a post from another site", async () => {
    requireAdmin.mockResolvedValue(false);
    expect((await call()).status).toBe(403);
    requireAdmin.mockResolvedValue(true);
    expect((await call({ headers: { "sec-fetch-site": "cross-site" } })).status).toBe(403);
    expect(transcribeAudio).not.toHaveBeenCalled();
  });

  it("a slip of the thumb, a recording too long, and anything that isn't a recording", async () => {
    expect((await call({ seconds: "2" })).status).toBe(400);
    expect((await call({ seconds: "900" })).status).toBe(413);
    expect((await call({ headers: { "content-length": String(10 * 1024 * 1024) } })).status).toBe(413);
    expect((await call({ type: "text/plain" })).status).toBe(415);
    expect(transcribeAudio).not.toHaveBeenCalled();
  });

  it("too many talks", async () => {
    tooManyRecentActions.mockResolvedValueOnce(true);
    expect((await call()).status).toBe(429);
    expect(transcribeAudio).not.toHaveBeenCalled();
  });
});
