import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { parseJsonBody } from "@/lib/validation";
import { businessDisplayName } from "@/lib/leadName";

const MAX_NAME_LENGTH = 120;

const onboardingSchema = z.object({
  finish: z.boolean().optional(),
  name: z.string().trim().max(MAX_NAME_LENGTH).optional(),
  industry: z.string().trim().max(200).optional(),
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
/**
 * GET /api/onboarding — the business's own profile, for Settings.
 *
 * The POST below has always accepted a partial update "at any time, not
 * just during first-run" (see its comment), but nothing ever offered the
 * owner a way to make one: name and industry were asked once in the
 * onboarding wizard and then unreachable forever.
 *
 * That is why four real people received "Thank you for contacting My
 * Business" on 2026-09-20 — the founder's own workspace still carried
 * auth.ts's placeholder name, and there was no screen on which to change
 * it. `industry` was null for the same reason, and it is the single most
 * important input to classifyAsProspect.
 *
 * Not admin-gated, unlike POST: reading your own business's name is not
 * a privileged act, and the Settings section that calls this renders for
 * everyone while only admins get the save button.
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { name: true, industry: true, teamSize: true },
  });
  if (!business) return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });

  return NextResponse.json({
    success: true,
    name: business.name,
    industry: business.industry,
    teamSize: business.teamSize,
    // Whether the name is still a stand-in. The Settings section says so
    // plainly rather than leaving the owner to notice — see
    // businessDisplayName in src/lib/leadName.ts for why it matters and
    // where it leaks.
    namePlaceholder: businessDisplayName(business.name) === "",
    isAdmin: await requireAdmin(ctx),
  });
}

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
