import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runAutomation } from "@/lib/automation";

// POST /api/automation/run — checks every automation-opted-in lead and
// sends the ones that qualify. Nothing calls this on a schedule yet; it's
// wired to a manual "Run automation check now" button in Settings for
// testing. In production this is what a cron job (e.g. Vercel Cron) would
// hit on a schedule.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  try {
    const result = await runAutomation();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Automation run failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
