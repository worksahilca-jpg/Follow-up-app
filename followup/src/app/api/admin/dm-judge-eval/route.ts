import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { runDmJudgeEval } from "@/lib/dmJudgeEval";

// About thirty cases (src/lib/dmJudgeEval.ts), up to two model calls each, two at a time.
export const maxDuration = 300;

/** Same rule as /api/admin/classifier-eval: a request started by another site is refused. */
function fromAnotherSite(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  return site === "cross-site" || site === "same-site";
}

// POST /api/admin/dm-judge-eval — run the DM "is this a customer?" check against the real model on a
// fixed set of invented cases with known answers. Platform admins only,
// POST only, never from another site: the same locks as
// /api/admin/qualification-eval, because each run is about sixty paid model calls.
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
  const result = await runDmJudgeEval();
  return NextResponse.json({ success: result.customersSetAside === 0, ...result });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isPlatformAdmin(session?.user?.email)) {
    return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ success: false, message: "This runs on POST only. Use the Run button on /admin." }, { status: 405, headers: { Allow: "POST" } });
}
