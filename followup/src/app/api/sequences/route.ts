import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { getSequences, createSequence, type SequenceStepInput } from "@/lib/sequences";

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
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: BILLING_LOCKED_MESSAGE }, { status: 402 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name : "";
  const steps: SequenceStepInput[] = Array.isArray(body.steps) ? body.steps : [];

  const result = await createSequence(ctx.businessId, name, steps);
  if (!result.success) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}
