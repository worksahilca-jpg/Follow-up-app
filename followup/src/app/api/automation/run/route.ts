import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, billingLockedMessage } from "@/lib/billing";
import { runAutomationForBusiness } from "@/lib/automation";
import { publicErrorMessage } from "@/lib/publicError";
import { tooManyRecentActions } from "@/lib/rateLimit";

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
    return NextResponse.json({ success: false, message: await billingLockedMessage(ctx.businessId) }, { status: 402 });
  }
  // A whole-business pass of AI drafting and sending on the shared OpenAI
  // key, behind one button. 10 per 10 minutes per business is far more than
  // anyone presses it; it stops a script (or a stuck double-click loop) from
  // turning it into an uncapped spend. The hourly cron is unaffected.
  if (await tooManyRecentActions(ctx.businessId, "automation.run", { windowMinutes: 10, max: 10 })) {
    return NextResponse.json({ success: false, message: "Too many requests — try again in a few minutes." }, { status: 429 });
  }

  try {
    const result = await runAutomationForBusiness(ctx.businessId);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = publicErrorMessage(err, "Automation run failed.", "automation/run");
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
