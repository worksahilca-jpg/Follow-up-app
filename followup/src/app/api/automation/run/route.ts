import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { runAutomationForBusiness } from "@/lib/automation";

// Same per-lead AI drafting + Gmail send work as the cron route, just
// scoped to one business — can still take a while with a large opted-in
// lead list.
export const maxDuration = 120;

// POST /api/automation/run — checks every automation-opted-in lead
// belonging to the SIGNED-IN user's own business (never anyone else's) and
// sends the ones that qualify. Wired to a manual "Run automation check
// now" button in Settings for testing; a real deploy would need a
// scheduler calling runAutomationForAllBusinesses() instead of this route.
export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: BILLING_LOCKED_MESSAGE }, { status: 402 });
  }

  try {
    const result = await runAutomationForBusiness(ctx.businessId);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Automation run failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
