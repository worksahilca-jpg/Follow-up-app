import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { getReactivationBatch } from "@/lib/reactivation";

/**
 * GET /api/reactivation/batch — the bucketed back-catalogue view for the
 * SIGNED-IN user's own business: what went cold, what we never replied to,
 * what looks finished, what moved off-platform, what couldn't be judged,
 * and how many are still waiting for a verdict.
 *
 * Authenticated member, not admin. Every one of these rows is a lead the
 * caller can already open in the leads list — this endpoint reorganises
 * leads they can see, it doesn't reveal anything new and it changes
 * nothing. Gating it on ADMIN would hide a rep's own dropped conversations
 * from the rep, which is the opposite of the point. The action that spends
 * money (and the sending that would follow it) is gated; the view is not.
 *
 * No billing gate either, matching every other read in this API
 * (/api/source-rules, /api/automation/settings, /api/billing/status): this
 * costs a handful of indexed counts and no OpenAI call, and a business
 * whose card just failed should still be able to see what it has rather
 * than be shown an error where its own leads used to be.
 *
 * Takes no parameters on purpose. The silence threshold is the one the
 * business configured on its dead-lead rule (resolved inside
 * getReactivationBatch), so this view and the classify pass can never
 * disagree about what "quiet" means — a client-supplied quietDays would
 * let the screen show a batch the classifier has never judged.
 *
 * Scoping: businessId comes only from the session, never from the
 * request. getReactivationBatch takes it as its first argument and every
 * query inside it is filtered on it.
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  try {
    const batch = await getReactivationBatch(ctx.businessId);
    return NextResponse.json({ success: true, batch });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load the reactivation batch.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
