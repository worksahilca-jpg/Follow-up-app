import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";

// GET /api/notifications — the signed-in user's own notifications, most
// recent first. Scoped to userId, not businessId, since a notification is
// about who it's assigned to, not the business as a whole (see
// src/lib/engagement.ts, the one thing that creates these today).
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.notification.count({ where: { userId: ctx.userId, read: false } }),
  ]);

  return NextResponse.json({
    success: true,
    unreadCount,
    notifications: notifications.map((n) => ({
      id: n.id,
      leadId: n.leadId,
      message: n.message,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    })),
  });
}
