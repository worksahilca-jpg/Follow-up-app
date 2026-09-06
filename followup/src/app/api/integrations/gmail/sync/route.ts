import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { syncGmailForBusiness } from "@/lib/gmailSync";
import { tooManyRecentActions } from "@/lib/rateLimit";

// A full sync (up to 30 Gmail threads, each possibly classified, plus two
// OpenAI calls per resulting lead for scoring/drafting) comfortably exceeds
// a default serverless timeout even with the concurrency below. Needs a
// Vercel plan that honors maxDuration above the Hobby tier's 10s cap.
export const maxDuration = 300;

// POST /api/integrations/gmail/sync — pulls recent inbox threads for the
// signed-in user's own business, upserts them as real Lead/Conversation/
// Message rows, then (if OPENAI_API_KEY is set) scores each one and drafts
// a follow-up message. Triggered by the "Sync now" button on Settings once
// Gmail is connected. The automatic every-few-minutes version of this
// is /api/cron/gmail-sync — same code path (src/lib/gmailSync.ts), just
// narrowed to what's new.
export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: BILLING_LOCKED_MESSAGE }, { status: 402 });
  }
  // 5 per 10 minutes — a full sync is already expensive (up to 30 threads,
  // two OpenAI calls per resulting lead); this is a manual "Sync now"
  // button, not something a real user needs to hit repeatedly.
  if (await tooManyRecentActions(ctx.businessId, "gmail-sync", { windowMinutes: 10, max: 5 })) {
    return NextResponse.json({ success: false, message: "Too many syncs right now — try again in a few minutes." }, { status: 429 });
  }

  try {
    const { count, scored, repliesDetected, leads } = await syncGmailForBusiness(ctx.businessId);
    return NextResponse.json({ success: true, count, scored, repliesDetected, leads });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gmail sync failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
