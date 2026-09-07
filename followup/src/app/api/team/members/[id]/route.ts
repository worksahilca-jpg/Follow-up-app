import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { updateMemberRole, removeMember } from "@/lib/team";
import type { TeamRole } from "@prisma/client";
import { recordAudit } from "@/lib/audit";

const VALID_ROLES: TeamRole[] = ["ADMIN", "SALES"];

// PATCH /api/team/members/[id] — admin-only, changes another member's
// role (body: { role }). DELETE — admin-only, removes them from the team
// (their leads are unassigned, not deleted; see removeMember() in
// src/lib/team.ts for the guardrails — can't remove yourself or the only
// admin).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: BILLING_LOCKED_MESSAGE }, { status: 402 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const role = typeof body.role === "string" ? body.role.toUpperCase() : "";
  if (!VALID_ROLES.includes(role as TeamRole)) {
    return NextResponse.json({ success: false, message: "Invalid role." }, { status: 400 });
  }

  const result = await updateMemberRole(id, ctx.businessId, ctx.userId, role as TeamRole);
  if (!result.success) return NextResponse.json(result, { status: 400 });
  void recordAudit(ctx, "team.role.update", { targetType: "user", targetId: id, meta: { role } });
  return NextResponse.json(result);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: BILLING_LOCKED_MESSAGE }, { status: 402 });
  }

  const { id } = await params;
  const result = await removeMember(id, ctx.businessId, ctx.userId);
  if (!result.success) return NextResponse.json(result, { status: 400 });
  void recordAudit(ctx, "team.member.remove", { targetType: "user", targetId: id });
  return NextResponse.json(result);
}
