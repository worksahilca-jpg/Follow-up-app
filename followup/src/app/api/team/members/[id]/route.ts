import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { updateMemberRole, removeMember } from "@/lib/team";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";

const roleSchema = z.object({
  role: z.string().transform((v) => v.toUpperCase()).pipe(z.enum(["ADMIN", "SALES"])),
});

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
  const parsed = await parseJsonBody(request, roleSchema);
  if (!parsed.ok) return parsed.response;
  const { role } = parsed.data;

  const result = await updateMemberRole(id, ctx.businessId, ctx.userId, role);
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
