import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, billingLockedMessage } from "@/lib/billing";
import { runSequencesForBusiness } from "@/lib/sequences";
import { tooManyRecentActions } from "@/lib/rateLimit";

// POST /api/sequences/run — manually runs due workflow steps for the
// signed-in user's own business. Same per-lead AI-draft + send work as
// /api/automation/run, just for enrolled leads instead of the silence
// rule; this also runs automatically once an hour via /api/cron/automation.
export const maxDuration = 120;

export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: await billingLockedMessage(ctx.businessId) }, { status: 402 });
  }
  // Same reasoning and ceiling as /api/automation/run: a manual trigger for
  // per-lead AI drafting, generous enough that no person meets it.
  if (await tooManyRecentActions(ctx.businessId, "sequences.run", { windowMinutes: 10, max: 10 })) {
    return NextResponse.json({ success: false, message: "Too many requests — try again in a few minutes." }, { status: 429 });
  }

  try {
    const result = await runSequencesForBusiness(ctx.businessId);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Workflow run failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
