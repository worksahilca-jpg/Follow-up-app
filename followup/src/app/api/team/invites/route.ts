import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, billingLockedMessage } from "@/lib/billing";
import { inviteMember } from "@/lib/team";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import { tooManyRecentActions } from "@/lib/rateLimit";

const inviteSchema = z.object({
  // 320 is the longest a real address can be (64 local + @ + 255 domain).
  email: z.string().max(320),
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
    return NextResponse.json({ success: false, message: await billingLockedMessage(ctx.businessId) }, { status: 402 });
  }
  // An invite can send an email from the business's connected mailbox
  // (src/lib/team.ts). 30 an hour is a whole team onboarding at once; it
  // stops the endpoint being used as a bulk mailer.
  if (await tooManyRecentActions(ctx.businessId, "team.invite", { windowMinutes: 60, max: 30 })) {
    return NextResponse.json({ success: false, message: "Too many requests — try again in a few minutes." }, { status: 429 });
  }

  const parsed = await parseJsonBody(request, inviteSchema);
  if (!parsed.ok) return parsed.response;
  const { email, role } = parsed.data;

  const result = await inviteMember(ctx.businessId, ctx.userId, email, role);
  if (!result.success) return NextResponse.json(result, { status: 400 });
  void recordAudit(ctx, "team.invite", { meta: { role } });
  return NextResponse.json(result, { status: 201 });
}
