import { NextRequest, NextResponse } from "next/server";
import { runAutomationForAllBusinesses } from "@/lib/automation";

// GET /api/cron/automation — invoked automatically once a day by Vercel
// Cron (see vercel.json). Runs the auto-send check across every business
// with automation enabled, in one pass, in place of the manual "Run
// automation check now" button in Settings.
//
// Protected by CRON_SECRET: when that env var is set, Vercel signs its own
// cron requests with an `Authorization: Bearer <CRON_SECRET>` header, so
// this rejects anyone hitting the URL directly without it. Set CRON_SECRET
// in the deployment's environment variables (any long random string) —
// without it, this route refuses every request, cron included.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await runAutomationForAllBusinesses();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Automation run failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
