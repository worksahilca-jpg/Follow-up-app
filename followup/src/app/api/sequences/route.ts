import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { getSequences, createSequence } from "@/lib/sequences";
import { parseJsonBody, sequenceStepSchema } from "@/lib/validation";

const createSequenceSchema = z.object({
  name: z.string(),
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
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: BILLING_LOCKED_MESSAGE }, { status: 402 });
  }

  const parsed = await parseJsonBody(request, createSequenceSchema);
  if (!parsed.ok) return parsed.response;
  const { name, steps } = parsed.data;

  const result = await createSequence(ctx.businessId, name, steps);
  if (!result.success) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}
