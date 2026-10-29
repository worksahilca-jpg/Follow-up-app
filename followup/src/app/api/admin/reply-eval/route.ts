import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { draftDm } from "@/lib/dmDrafting";
import { gradeReply, isTryModel, REPLY_CASES, REPLY_EVAL_TRADE, runReplyEval, tradeLessons } from "@/lib/replyEval";

// Twenty cases (src/lib/replyEval.ts), up to three model calls each (a draft, a retry, a grade), two at a time.
export const maxDuration = 300;

/** Same rule as /api/admin/classifier-eval: a request started by another site is refused. */
function fromAnotherSite(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  return site === "cross-site" || site === "same-site";
}

// POST /api/admin/reply-eval — run the Instagram/Messenger reply drafter against the real model on a
// fixed set of invented cases with known answers. Platform admins only,
// POST only, never from another site: the same locks as
// /api/admin/qualification-eval, because each run is about forty paid model calls.
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
  // No body: the usual model. { model } names a bigger one to write the replies with, side by side (TRY_MODELS).
  const asked = ((await request.json().catch(() => null)) as { model?: unknown } | null)?.model;
  if (asked !== undefined && !isTryModel(asked)) {
    return NextResponse.json({ success: false, message: "That model isn't one this test can try." }, { status: 400 });
  }
  // Drafted with the realtor rules and examples in use, as a live reply is (A-319).
  const result = await runReplyEval(draftDm, gradeReply, REPLY_CASES, {
    lessons: await tradeLessons(REPLY_EVAL_TRADE),
    ...(asked ? { writeWith: asked } : {}),
  });
  return NextResponse.json({ success: result.passed === result.cases, ...result });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isPlatformAdmin(session?.user?.email)) {
    return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ success: false, message: "This runs on POST only. Use the Run button on /admin." }, { status: 405, headers: { Allow: "POST" } });
}
