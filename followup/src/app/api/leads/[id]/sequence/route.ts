import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { enrollLead, unenrollLead, getLeadEnrollment } from "@/lib/sequences";

// GET /api/leads/[id]/sequence — this lead's current workflow enrollment,
// if any. POST — enroll it in a workflow (body: { sequenceId }). DELETE —
// unenroll it, whatever step it's on.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const enrollment = await getLeadEnrollment(id, ctx.businessId);
  if (!enrollment) return NextResponse.json({ success: false, message: "Lead not found." }, { status: 404 });
  return NextResponse.json({ success: true, ...enrollment });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: BILLING_LOCKED_MESSAGE }, { status: 402 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const sequenceId = typeof body.sequenceId === "string" ? body.sequenceId : "";
  if (!sequenceId) return NextResponse.json({ success: false, message: "sequenceId is required." }, { status: 400 });

  const result = await enrollLead(id, ctx.businessId, sequenceId);
  if (!result.success) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const result = await unenrollLead(id, ctx.businessId);
  if (!result.success) return NextResponse.json(result, { status: 404 });
  return NextResponse.json(result);
}
