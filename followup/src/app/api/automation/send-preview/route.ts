/**
 * GET /api/automation/send-preview — what is waiting, split by whether
 * the approval setting is the only thing holding it.
 *
 * Its own route, and deliberately NOT folded into
 * /api/automation/settings, for one reason: `getPendingApprovals` scans
 * up to 500 audit events. Settings is loaded every time anyone opens it;
 * this answer is only wanted at the moment someone is deciding whether
 * to let FollowUp send. So the panel fetches it when the confirmation
 * opens, and an owner who never opens that block never pays for it.
 *
 * Admin-only, like the decision it informs — the counts describe the
 * whole business's queue.
 */
import { NextResponse } from "next/server";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { getSendPreview } from "@/lib/sendPreview";

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false }, { status: 401 });
  if (!(await requireAdmin(ctx))) {
    return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  }

  try {
    const preview = await getSendPreview(ctx.businessId);
    return NextResponse.json({ success: true, ...preview });
  } catch (err) {
    // A failed count must not block the decision or, worse, imply the
    // queue is empty — the panel falls back to describing the rules
    // without numbers rather than showing a confident zero.
    console.error("Send preview failed:", err);
    return NextResponse.json({ success: false, message: "Couldn't read your approvals queue." }, { status: 500 });
  }
}
