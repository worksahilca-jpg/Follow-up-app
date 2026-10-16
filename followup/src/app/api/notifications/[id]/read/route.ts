import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";

// POST /api/notifications/[id]/read: "Got it" on a problem at the top of Today (A-270). Only the viewer's own
// notice, in their own business; anything else changes nothing.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  const { id } = await params;
  if (!id || id.length > 64) return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });
  const done = await prisma.notification.updateMany({ where: { id, userId: ctx.userId, user: { businessId: ctx.businessId } }, data: { read: true } });
  if (done.count === 0) return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });
  return NextResponse.json({ success: true });
}
