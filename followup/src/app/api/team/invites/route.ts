import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { inviteMember } from "@/lib/team";
import type { TeamRole } from "@prisma/client";

const VALID_ROLES: TeamRole[] = ["ADMIN", "SALES"];

// POST /api/team/invites — admin-only, invites an email to the signed-in
// user's own business. The email doesn't need a User row yet; it's
// consumed the moment that address signs in (see src/lib/auth.ts).
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: BILLING_LOCKED_MESSAGE }, { status: 402 });
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email : "";
  const role = typeof body.role === "string" ? body.role.toUpperCase() : "SALES";
  if (!VALID_ROLES.includes(role as TeamRole)) {
    return NextResponse.json({ success: false, message: "Invalid role." }, { status: 400 });
  }

  const result = await inviteMember(ctx.businessId, ctx.userId, email, role as TeamRole);
  if (!result.success) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}
