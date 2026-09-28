import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { requireActiveBilling, billingLockedMessage } from "@/lib/billing";
import { getSequenceById, updateSequence, deleteSequence } from "@/lib/sequences";
import { parseJsonBody, sequenceStepSchema } from "@/lib/validation";

const updateSequenceSchema = z.object({
  name: z.string().max(200).optional(),
  active: z.boolean().optional(),
  steps: z.array(sequenceStepSchema).optional(),
});

// GET one workflow (with its steps), PATCH to rename/rewrite its steps/
// toggle active, DELETE to remove it — all scoped to the signed-in user's
// own business.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const sequence = await getSequenceById(id, ctx.businessId);
  if (!sequence) return NextResponse.json({ success: false, message: "Workflow not found." }, { status: 404 });
  return NextResponse.json({ success: true, sequence });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params;
  const parsed = await parseJsonBody(request, updateSequenceSchema);
  if (!parsed.ok) return parsed.response;

  const result = await updateSequence(id, ctx.businessId, parsed.data);
  if (!result.success) {
    return NextResponse.json(result, { status: result.message === "Workflow not found." ? 404 : 400 });
  }
  return NextResponse.json(result);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  // Follow-up plans are a business-wide decision about what reaches
  // customers, so only an admin creates, changes or deletes one (founder,
  // 2026-09-27). Before this a teammate could write a plan and enrol
  // customers in it, which sidestepped "Only admins send" (A-041).
  if (!(await requireAdmin(ctx))) {
    return NextResponse.json({ success: false, message: "Only an admin can change follow-up plans." }, { status: 403 });
  }

  const { id } = await params;
  const result = await deleteSequence(id, ctx.businessId);
  if (!result.success) return NextResponse.json(result, { status: 404 });
  return NextResponse.json(result);
}
