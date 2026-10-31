import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { CHAT_CASES, OTHER_KIND_CHAT_CASES, REALTOR_CHAT_CASES, runConversationEval } from "@/lib/conversationEval";
import { REPLY_EVAL_TRADE, tradeLessons } from "@/lib/replyEval";
import { runTest } from "@/lib/testRuns";

// About forty chats (src/lib/conversationEval.ts), up to three model calls each, three at a time, on the best model.
export const maxDuration = 300;

/** Same rule as /api/admin/reply-eval: a request started by another site is refused. */
function fromAnotherSite(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  return site === "cross-site" || site === "same-site";
}

// POST /api/admin/conversation-eval — run FollowUp's real writers and its "no" check on a fixed set of invented
// realtor conversations: follow-ups after they went quiet, objections, long chats, and the "no" that must stop
// everything. Platform admins only, POST only, never from another site: each run is over a hundred paid model calls.
// The Run button on /admin calls it.
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isPlatformAdmin(session?.user?.email)) {
    return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });
  }
  if (fromAnotherSite(request)) {
    return NextResponse.json({ success: false, message: "Refused: this request came from another site." }, { status: 403 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ success: false, message: "OPENAI_API_KEY is not set on this deployment." }, { status: 503 });
  }
  // Written with the realtor rules and examples in use, as a live message is (A-319).
  const body = (await request.json().catch(() => null)) as { kinds?: unknown; only?: unknown } | null;
  // Realtors are the usual run; { kinds: "other" } runs every other kind of business (night plan A2). Named cases
  // (a rerun of what failed, or a rule's tests) can come from either.
  const other = body?.kinds === "other";
  const all = body?.only ? CHAT_CASES : other ? OTHER_KIND_CHAT_CASES : REALTOR_CHAT_CASES;
  const lessons = await tradeLessons(REPLY_EVAL_TRADE);
  // Every chat, or only the ones named; saved with its cost (src/lib/testRuns.ts).
  const out = await runTest(other ? "conversations-other-kinds" : "conversations", body, all, async (cases) => {
    // Each kind is written with its own rules and examples in use, as a live message for it is.
    const kinds = [...new Set(cases.map((c) => c.trade).filter((t): t is string => !!t && t !== REPLY_EVAL_TRADE))];
    const lessonsByTrade = Object.fromEntries(await Promise.all(kinds.map(async (t) => [t, await tradeLessons(t)] as const)));
    return runConversationEval(cases, { lessons, lessonsByTrade });
  }, (r) => r.errors);
  if (!out.ok) return NextResponse.json({ success: false, message: out.error }, { status: 400 });
  const { result, saved } = out;
  return NextResponse.json({ success: result.passed === result.cases, ...result, saved });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isPlatformAdmin(session?.user?.email)) {
    return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ success: false, message: "This runs on POST only. Use the Run button on /admin." }, { status: 405, headers: { Allow: "POST" } });
}
