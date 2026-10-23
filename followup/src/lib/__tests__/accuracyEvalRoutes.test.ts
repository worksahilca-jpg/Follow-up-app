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
vi.mock("@/lib/dmJudgeEval", () => ({ runDmJudgeEval }));
// The reply test drafts with the realtor rules and examples in use (A-319): none here.
vi.mock("@/lib/replyEval", () => ({
  runReplyEval,
  gradeReply: vi.fn(),
  REPLY_CASES: [],
  REPLY_EVAL_TRADE: "Real estate",
  tradeLessons: vi.fn(async () => ({ examples: [], rules: [] })),
}));
vi.mock("@/lib/dmDrafting", () => ({ draftDm: vi.fn() }));

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
