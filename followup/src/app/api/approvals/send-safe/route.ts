/**
 * POST /api/approvals/send-safe — release the routine half of the
 * approval queue in one press.
 *
 * See @/lib/bulkApprove for what "safe" is allowed to mean and why this
 * never claims a human read each message. The short version: the list is
 * re-derived server-side from the same queue the screen was built from,
 * never taken from the request, and Meta's DM window is enforced by the
 * send path rather than bypassed.
 *
 * Admin-only, like the bulk automation route and for the same reason:
 * approving one draft is ordinary work for anyone on the team, releasing
 * the whole queue at once is a business-wide decision about what reaches
 * customers.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { requireActiveBilling, billingLockedMessage } from "@/lib/billing";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { parseJsonBody } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";
import { sendSafeApprovals } from "@/lib/bulkApprove";
import { KNOWN_LEAD_SOURCES } from "@/lib/sourceRouting";

// A press can take a while: a few hundred sends at concurrency 3, each
// waiting on a real provider call.
export const maxDuration = 300;

const schema = z.object({
  // Checked against the sources the app itself writes, so a typo cannot
  // quietly match nothing and report "0 sent" as though that were the
  // answer.
  source: z.enum(KNOWN_LEAD_SOURCES).nullish(),
});

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) {
    return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  }
  // Tighter than the single-send route's limit, because each call here is
  // worth up to a whole day's automated volume. Bounds repeated presses,
  // which the per-press ceiling on its own does not.
  if (await tooManyRecentActions(ctx.businessId, "approvals.send_safe", { windowMinutes: 10, max: 5 })) {
    return NextResponse.json({ success: false, message: "That's a lot of sending at once — give it a few minutes." }, { status: 429 });
  }
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: await billingLockedMessage(ctx.businessId) }, { status: 402 });
  }

  const parsed = await parseJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;

  const result = await sendSafeApprovals({ businessId: ctx.businessId, source: parsed.data.source ?? null });

  // How many went out, to what, and what was refused — the question asked
  // after a customer gets a message nobody remembers authorising.
  void recordAudit(ctx, "approvals.send_safe", {
    meta: {
      source: parsed.data.source ?? null,
      sent: result.sent,
      skipped: result.skipped.length,
      remaining: result.remaining,
    },
  });

  return NextResponse.json({ success: true, ...result });
}
