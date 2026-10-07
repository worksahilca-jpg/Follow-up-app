import { NextResponse } from "next/server";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getTeamWeek } from "@/lib/calls";

// GET /api/team/week — "This week" on the Team page (design brain A-103):
// each person's calls, who they reached, and meetings booked. Admins only:
// it is a manager's view of the team. Counts and first names only.
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can see this." }, { status: 403 });
  const business = await prisma.business.findUnique({ where: { id: ctx.businessId }, select: { timezone: true } });
  const week = await getTeamWeek(ctx.businessId, business?.timezone ?? "America/New_York");
  return NextResponse.json({ success: true, week });
}
