/**
 * /api/admin/dm-judge-eval and /api/admin/reply-eval: paid model calls on
 * every run, so admins only, POST only, never from another site (the
 * locks /api/admin/classifier-eval set, backlog b004).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getServerSession } = vi.hoisted(() => ({ getServerSession: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

const { runDmJudgeEval, runReplyEval } = vi.hoisted(() => ({
  runDmJudgeEval: vi.fn(async () => ({ cases: 2, right: 2, customersSetAside: 0, chatsLetThrough: 0, failures: [] })),
  runReplyEval: vi.fn(async () => ({ cases: 2, passed: 2, errors: 0, problems: {}, failures: [] })),
}));
vi.mock("@/lib/dmJudgeEval", () => ({ runDmJudgeEval, DM_JUDGE_CASES: [{ name: "a" }, { name: "b" }] }));
// The reply test drafts with the realtor rules and examples in use (A-319): none here.
vi.mock("@/lib/replyEval", () => ({
  runReplyEval,
  gradeReply: vi.fn(),
  REPLY_CASES: [],
  REPLY_EVAL_TRADE: "Real estate",
  isTryModel: (v: unknown) => v === "gpt-5.4-mini" || v === "gpt-5.4",
  tradeLessons: vi.fn(async () => ({ examples: [], rules: [] })),
}));
vi.mock("@/lib/dmDrafting", () => ({ draftDm: vi.fn() }));
// Each run is kept (src/lib/testRuns.ts); here the table answers with what it was given.
vi.mock("@/lib/db", () => ({
  prisma: { testRun: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "run-1", createdAt: new Date("2026-10-31T08:00:00Z"), ...data })) } },
}));


const ADMIN = { user: { email: "founder@example.com" } };
const post = (secFetchSite?: string) =>
  new NextRequest("https://app.example.com/api/admin/x", { method: "POST", headers: secFetchSite ? { "sec-fetch-site": secFetchSite } : {} });

const routes = [
  { name: "dm-judge-eval", load: () => import("@/app/api/admin/dm-judge-eval/route"), run: runDmJudgeEval },
  { name: "reply-eval", load: () => import("@/app/api/admin/reply-eval/route"), run: runReplyEval },
];

describe.each(routes)("/api/admin/$name", ({ load, run }) => {
  beforeEach(() => {
    vi.stubEnv("PLATFORM_ADMIN_EMAILS", "founder@example.com");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.resetModules();
    getServerSession.mockReset();
    run.mockClear();
  });

  it("runs for a platform admin on a same-origin POST", async () => {
    getServerSession.mockResolvedValue(ADMIN);
    const { POST } = await load();
    const res = await POST(post("same-origin"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("answers 404 to anyone else, refuses another site, and a GET never runs it", async () => {
    getServerSession.mockResolvedValue({ user: { email: "owner@somebusiness.com" } });
    let route = await load();
    expect((await route.POST(post("same-origin"))).status).toBe(404);
    getServerSession.mockResolvedValue(ADMIN);
    vi.resetModules();
    route = await load();
    expect((await route.POST(post("cross-site"))).status).toBe(403);
    expect((await route.GET()).status).toBe(405);
    expect(run).not.toHaveBeenCalled();
  });
});

describe("/api/admin/reply-eval with a bigger model", () => {
  const ask = (body: unknown) =>
    new NextRequest("https://app.example.com/api/admin/reply-eval", {
      method: "POST",
      headers: { "sec-fetch-site": "same-origin", "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  beforeEach(() => {
    vi.stubEnv("PLATFORM_ADMIN_EMAILS", "founder@example.com");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.resetModules();
    getServerSession.mockResolvedValue(ADMIN);
    runReplyEval.mockClear();
  });

  it("writes the replies with the model asked for, when it's one the test can try", async () => {
    const { POST } = await import("@/app/api/admin/reply-eval/route");
    expect((await POST(ask({ model: "gpt-5.4-mini" }))).status).toBe(200);
    expect(runReplyEval).toHaveBeenCalledWith(expect.anything(), expect.anything(), [], expect.objectContaining({ writeWith: "gpt-5.4-mini" }));
  });

  it("refuses any other model, and runs nothing", async () => {
    const { POST } = await import("@/app/api/admin/reply-eval/route");
    expect((await POST(ask({ model: "o9-ultra" }))).status).toBe(400);
    expect(runReplyEval).not.toHaveBeenCalled();
  });

  it("uses the usual model when no body is sent", async () => {
    const { POST } = await import("@/app/api/admin/reply-eval/route");
    await POST(post("same-origin"));
    expect((runReplyEval.mock.calls[0] as unknown[])[3]).not.toHaveProperty("writeWith");
  });
});
