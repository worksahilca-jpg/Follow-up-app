import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { runSequencesForBusiness } from "@/lib/sequences";

// POST /api/sequences/run — manually runs due workflow steps for the
// signed-in user's own business. Same per-lead AI-draft + send work as
// /api/automation/run, just for enrolled leads instead of the silence
// rule; this also runs automatically once a day via /api/cron/automation.
export const maxDuration = 120;

export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: BILLING_LOCKED_MESSAGE }, { status: 402 });
  }

  try {
    const result = await runSequencesForBusiness(ctx.businessId);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Workflow run failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
