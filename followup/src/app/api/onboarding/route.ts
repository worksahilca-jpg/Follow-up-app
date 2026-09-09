import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { parseJsonBody } from "@/lib/validation";

const MAX_NAME_LENGTH = 120;

const onboardingSchema = z.object({
  finish: z.boolean().optional(),
  name: z.string().trim().max(MAX_NAME_LENGTH).optional(),
  industry: z.string().trim().optional(),
  teamSize: z.coerce.number().optional(),
});

// POST /api/onboarding — saves onboarding progress for the caller's own
// business. Two-step flow, both handled here:
//   1. Business info (name/industry/teamSize) — saved but Business.onboarded
//      stays false, so a user who closes the tab here picks up on this same
//      step next sign-in instead of landing in a half-configured dashboard.
//   2. { finish: true } — sent when the onboarding UI's second step (connect
//      Gmail, or skip) is done. This is the only place onboarded flips to
//      true, which is what actually unlocks the rest of the app (see
//      src/app/(app)/layout.tsx).
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  // This is the only endpoint that can ever change the business's own
  // profile fields (name/industry/teamSize) outside the onboarding wizard
  // itself, and it's reachable at any time, not just during first-run —
  // same "account-wide setting" bar billing checkout/portal and team
  // management already gate on admin.
  if (!(await requireAdmin(ctx))) {
    return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  }

  const parsed = await parseJsonBody(request, onboardingSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  if (body.finish === true) {
    await prisma.business.update({ where: { id: ctx.businessId }, data: { onboarded: true } });
    return NextResponse.json({ success: true });
  }

  if (body.name !== undefined && !body.name) {
    return NextResponse.json({ success: false, message: "Business name is required." }, { status: 400 });
  }

  // Patch only the fields actually present in this request — the previous
  // version always wrote a full { name, industry, teamSize } record built
  // from `?? ""`/`?? null` defaults, so a call that only intended to
  // update one field (e.g. just `name`) silently reset the other two to
  // empty/null instead of leaving them alone.
  const data: { name?: string; industry?: string | null; teamSize?: number | null } = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.industry !== undefined) data.industry = body.industry || null;
  if (body.teamSize !== undefined) {
    data.teamSize = Number.isFinite(body.teamSize) ? Math.max(1, Math.round(body.teamSize)) : null;
  }

  await prisma.business.update({ where: { id: ctx.businessId }, data });

  return NextResponse.json({ success: true });
}
