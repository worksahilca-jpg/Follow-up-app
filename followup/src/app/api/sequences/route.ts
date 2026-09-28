import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { requireActiveBilling, billingLockedMessage } from "@/lib/billing";
import { getSequences, createSequence } from "@/lib/sequences";
import { parseJsonBody, sequenceStepSchema } from "@/lib/validation";

const createSequenceSchema = z.object({
  name: z.string().max(200),
  steps: z.array(sequenceStepSchema).default([]),
});

// GET /api/sequences — every workflow belonging to the signed-in user's
// own business. POST /api/sequences — create a new one with its full step
// list in one call (the builder saves everything at once, not per-step).
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const sequences = await getSequences(ctx.businessId);
  return NextResponse.json({ success: true, sequences });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  // Follow-up plans are a business-wide decision about what reaches
  // customers, so only an admin creates, changes or deletes one (founder,
  // 2026-09-27). Before this a teammate could write a plan and enrol
  // customers in it, which sidestepped "Only admins send" (A-041).
  if (!(await requireAdmin(ctx))) {
    return NextResponse.json({ success: false, message: "Only an admin can change follow-up plans." }, { status: 403 });
  }
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: await billingLockedMessage(ctx.businessId) }, { status: 402 });
  }

  const parsed = await parseJsonBody(request, createSequenceSchema);
  if (!parsed.ok) return parsed.response;
  const { name, steps } = parsed.data;

  const result = await createSequence(ctx.businessId, name, steps);
  if (!result.success) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}
