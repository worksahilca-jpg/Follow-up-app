import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { runAutomationForBusiness } from "@/lib/automation";

// POST /api/automation/run — checks every automation-opted-in lead
// belonging to the SIGNED-IN user's own business (never anyone else's) and
// sends the ones that qualify. Wired to a manual "Run automation check
// now" button in Settings for testing; a real deploy would need a
// scheduler calling runAutomationForAllBusinesses() instead of this route.
export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  try {
    const result = await runAutomationForBusiness(ctx.businessId);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Automation run failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
