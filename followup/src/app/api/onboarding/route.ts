import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";

const MAX_NAME_LENGTH = 120;

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

  const body = await request.json().catch(() => ({}));

  if (body.finish === true) {
    await prisma.business.update({ where: { id: ctx.businessId }, data: { onboarded: true } });
    return NextResponse.json({ success: true });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, MAX_NAME_LENGTH) : "";
  const industry = typeof body.industry === "string" ? body.industry.trim() : "";
  const teamSize = Number.isFinite(body.teamSize) ? Math.max(1, Math.round(body.teamSize)) : null;

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
