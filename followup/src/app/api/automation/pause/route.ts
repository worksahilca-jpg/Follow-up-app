import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { parseJsonBody } from "@/lib/validation";
import { requireActiveBilling, billingLockedMessage } from "@/lib/billing";
import { pauseSending, resumeSending } from "@/lib/sendingControl";
import { recordAudit } from "@/lib/audit";

const schema = z.object({ paused: z.boolean() });

// POST /api/automation/pause — "Pause all sending" and "Resume" (A-041).
//
// Anyone on the team may pause: it only ever holds messages, and the
// person who notices something wrong shouldn't have to find an admin
// first. Only an admin may resume, because resuming lets FollowUp send
// on the business's behalf again, the same decision as the permission in
// Settings, which is admin-only too.
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const parsed = await parseJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;

  if (parsed.data.paused) {
    // No billing check on the way in: stopping must never be harder than
    // starting, and a lapsed account is the last one to trap in "sending".
    const result = await pauseSending(ctx.businessId);
    if (!result.ok) return NextResponse.json({ success: false, message: result.message }, { status: result.status });
    void recordAudit(ctx, "sending.paused");
    return NextResponse.json({ success: true, paused: true });
  }

  if (!(await requireAdmin(ctx))) {
    return NextResponse.json({ success: false, message: "Only an admin can resume sending." }, { status: 403 });
  }
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: await billingLockedMessage(ctx.businessId) }, { status: 402 });
  }
  const result = await resumeSending(ctx.businessId);
  if (!result.ok) return NextResponse.json({ success: false, message: result.message }, { status: result.status });
  void recordAudit(ctx, "sending.resumed");
  return NextResponse.json({ success: true, paused: false });
}
