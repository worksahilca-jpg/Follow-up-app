import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { inviteMember } from "@/lib/team";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";

const inviteSchema = z.object({
  email: z.string(),
  // Absent entirely defaults to SALES; present-but-invalid is rejected —
  // matches the pre-existing behavior this replaces.
  role: z
    .string()
    .optional()
    .transform((v) => (v ?? "SALES").toUpperCase())
    .pipe(z.enum(["ADMIN", "SALES"])),
});

// POST /api/team/invites — admin-only, invites an email to the signed-in
// user's own business. The email doesn't need a User row yet; it's
// consumed the moment that address signs in (see src/lib/auth.ts).
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: BILLING_LOCKED_MESSAGE }, { status: 402 });
  }

  const parsed = await parseJsonBody(request, inviteSchema);
  if (!parsed.ok) return parsed.response;
  const { email, role } = parsed.data;

  const result = await inviteMember(ctx.businessId, ctx.userId, email, role);
  if (!result.success) return NextResponse.json(result, { status: 400 });
  void recordAudit(ctx, "team.invite", { meta: { role } });
  return NextResponse.json(result, { status: 201 });
}
