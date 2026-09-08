import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { syncOutlookForBusiness } from "@/lib/outlookSync";
import { tooManyRecentActions } from "@/lib/rateLimit";

// Mirrors /api/integrations/gmail/sync's maxDuration reasoning — a full
// pull plus classification plus scoring easily exceeds a default
// serverless timeout.
export const maxDuration = 300;

// POST /api/integrations/outlook/sync — manual "Sync now" for the
// signed-in user's own business. The automatic version is
// /api/cron/outlook-sync (src/lib/outlookSync.ts), same code path.
export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: BILLING_LOCKED_MESSAGE }, { status: 402 });
  }
  if (await tooManyRecentActions(ctx.businessId, "outlook-sync", { windowMinutes: 10, max: 5 })) {
    return NextResponse.json({ success: false, message: "Too many syncs right now — try again in a few minutes." }, { status: 429 });
  }

  try {
    const { count, scored, repliesDetected, leads } = await syncOutlookForBusiness(ctx.businessId);
    return NextResponse.json({ success: true, count, scored, repliesDetected, leads });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Outlook sync failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
