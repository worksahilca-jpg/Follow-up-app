/**
 * GET /api/automation/rule-records — "This week: wrote · sent · waiting"
 * for each follow-up rule in Settings (design brain A-044).
 *
 * Its own route rather than part of /api/automation/settings, like
 * send-preview: it reads the approvals queue, and the settings read should
 * stay cheap. A failed count is a 500, never a row of zeros, so the cards
 * show no record rather than a wrong one.
 */
import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { getRuleRecords } from "@/lib/ruleRecords";

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false }, { status: 401 });
  try {
    const records = await getRuleRecords(ctx.businessId);
    return NextResponse.json({ success: true, records });
  } catch (err) {
    console.error("Rule records failed:", err);
    return NextResponse.json({ success: false, message: "Couldn't count this week's messages." }, { status: 500 });
  }
}
