/**
 * GET /api/approvals/summary — the waiting pile, counted, for the last
 * onboarding screen ("12 people are waiting on a reply").
 *
 * Read-only and derived from the same queue and the same definition of
 * "safe to send in a batch" (isSafeToSendInBulk) that the one-tap button
 * uses, so the number on screen is the number the button will attempt.
 * The preview carries names and the written replies only — this business's
 * own drafts, to its own signed-in user.
 */
import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { getPendingApprovals } from "@/lib/pendingApprovals";
import { isSafeToSendInBulk } from "@/lib/approvalGroups";

const PREVIEW = 3;
const PREVIEW_CHARS = 220;

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const queue = await getPendingApprovals(ctx.businessId);
  const safe = queue.filter((a) => isSafeToSendInBulk(a));
  // Highest score first, the order the button sends in (bulkApprove.ts).
  safe.sort((a, b) => b.score - a.score);

  return NextResponse.json({
    success: true,
    safe: safe.length,
    needsYou: queue.length - safe.length,
    preview: safe.slice(0, PREVIEW).map((a) => ({
      leadId: a.leadId,
      leadName: a.leadName,
      channel: a.leadLastMessageChannel,
      theirMessage: a.leadLastMessage ? a.leadLastMessage.slice(0, PREVIEW_CHARS) : null,
      draftMessage: a.draftMessage.slice(0, PREVIEW_CHARS),
    })),
  });
}
