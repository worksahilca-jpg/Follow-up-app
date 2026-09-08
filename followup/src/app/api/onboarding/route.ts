import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
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

  const parsed = await parseJsonBody(request, onboardingSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  if (body.finish === true) {
    await prisma.business.update({ where: { id: ctx.businessId }, data: { onboarded: true } });
    return NextResponse.json({ success: true });
  }

  const name = body.name ?? "";
  const industry = body.industry ?? "";
  const teamSize = body.teamSize !== undefined && Number.isFinite(body.teamSize) ? Math.max(1, Math.round(body.teamSize)) : null;

  if (!name) {
    return NextResponse.json({ success: false, message: "Business name is required." }, { status: 400 });
  }

  await prisma.business.update({
    where: { id: ctx.businessId },
    data: {
      name,
      industry: industry || null,
      teamSize,
    },
  });

  return NextResponse.json({ success: true });
}
