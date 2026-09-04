import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";

// PATCH /api/notifications/[id] — mark one notification read. Scoped to
// the signed-in user's own notifications, checked explicitly rather than
// trusting the id alone — a stray/guessed id belonging to someone else's
// notification should 404, not silently succeed.
export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== ctx.userId) {
    return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });
  }

  await prisma.notification.update({ where: { id }, data: { read: true } });
  return NextResponse.json({ success: true });
}
