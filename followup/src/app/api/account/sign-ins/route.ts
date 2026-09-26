import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { isAlertEmailConfigured } from "@/lib/alertEmail";

// GET /api/account/sign-ins — the signed-in person's own recent sign-ins
// (A-041), newest first. Never anyone else's: an admin sees their own list,
// like everyone else.
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  const rows = await prisma.signIn.findMany({
    where: { userId: ctx.userId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { device: true, place: true, createdAt: true },
  });
  return NextResponse.json({
    success: true,
    signIns: rows.map((r) => ({ device: r.device, place: r.place, at: r.createdAt.toISOString() })),
    // Whether new-sign-in emails can actually go out, so Settings never
    // promises one that the missing Resend key would silently drop.
    emailsOn: isAlertEmailConfigured(),
  });
}
