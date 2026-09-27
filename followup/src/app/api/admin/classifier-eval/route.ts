import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { runClassifierEval } from "@/lib/classifierEval";

// Two dozen cases, each one or two model calls, four at a time.
export const maxDuration = 300;

// GET /api/admin/classifier-eval — run the lead check against the real
// model on a fixed set of invented emails with known answers (see
// src/lib/classifierEval.ts), and report which it got wrong.
//
// Open it in the browser while signed in as a platform admin. Gated by
// PLATFORM_ADMIN_EMAILS like /api/office/run; anyone else gets a 404, so
// the route doesn't confirm it exists. Costs roughly 25–50 small model
// calls per run.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isPlatformAdmin(session?.user?.email)) {
    return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ success: false, message: "OPENAI_API_KEY is not set on this deployment." }, { status: 503 });
  }

  const result = await runClassifierEval();
  return NextResponse.json({ success: result.failed === 0 && result.errors === 0, ...result });
}
