import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { QUAL_EVAL_CASES, runQualificationEval } from "@/lib/qualificationEval";
import { runTest } from "@/lib/testRuns";

// About fifty cases (src/lib/qualificationEval.ts), one model call each,
// three at a time, with rate-limit refusals waited out and retried.
export const maxDuration = 300;

/** Same rule as /api/admin/classifier-eval: a request started by another site is refused. */
function fromAnotherSite(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  return site === "cross-site" || site === "same-site";
}

// POST /api/admin/qualification-eval — run the realtor checklist reader
// against the real model on a fixed set of invented conversations with
// known answers, and report what it made up and what it missed.
//
// POST only, for the reason /api/admin/classifier-eval gives: each run is
// about fifty paid model calls, and a GET can be started by any page a
// signed-in admin visits.
//
// To run it: signed in as a platform admin, in the browser console on the
// app's own origin:
//   await (await fetch("/api/admin/qualification-eval", { method: "POST" })).json()
//
// Anyone who isn't a platform admin gets a 404, so the route doesn't
// confirm it exists.
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

  // Every case, or only the ones named; saved with its cost (src/lib/testRuns.ts).
  const out = await runTest("qualifying", await request.json().catch(() => null), QUAL_EVAL_CASES, (cases) => runQualificationEval(undefined, cases), (r) => r.errors);
  if (!out.ok) return NextResponse.json({ success: false, message: out.error }, { status: 400 });
  const { result, saved } = out;
  // "Success" is nothing made up and nothing broken. Misses are reported
  // but don't fail it: a missed item is asked about once more, while a
  // made-up one is shown to the owner as fact.
  return NextResponse.json({ success: result.items.madeUp === 0 && result.errors === 0, ...result, saved });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isPlatformAdmin(session?.user?.email)) {
    return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });
  }
  return NextResponse.json(
    {
      success: false,
      message:
        'This runs on POST only. From the browser console on this site: await (await fetch("/api/admin/qualification-eval", { method: "POST" })).json()',
    },
    { status: 405, headers: { Allow: "POST" } }
  );
}
