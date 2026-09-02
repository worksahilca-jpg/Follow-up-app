import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { getSequenceById, updateSequence, deleteSequence, type SequenceStepInput } from "@/lib/sequences";

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
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: BILLING_LOCKED_MESSAGE }, { status: 402 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const updates: { name?: string; active?: boolean; steps?: SequenceStepInput[] } = {};
  if (typeof body.name === "string") updates.name = body.name;
  if (typeof body.active === "boolean") updates.active = body.active;
  if (Array.isArray(body.steps)) updates.steps = body.steps;

  const result = await updateSequence(id, ctx.businessId, updates);
  if (!result.success) {
    return NextResponse.json(result, { status: result.message === "Workflow not found." ? 404 : 400 });
  }
  return NextResponse.json(result);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const result = await deleteSequence(id, ctx.businessId);
  if (!result.success) return NextResponse.json(result, { status: 404 });
  return NextResponse.json(result);
}
