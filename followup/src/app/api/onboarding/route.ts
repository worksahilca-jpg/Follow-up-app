import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";

const MAX_NAME_LENGTH = 120;

// POST /api/onboarding — completes signup for the caller's own business.
// This is the only place Business.onboarded flips to true.
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
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
      onboarded: true,
    },
  });

  return NextResponse.json({ success: true });
}
