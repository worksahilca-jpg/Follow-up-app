import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";

// POST /api/notifications/read-all — the bell dropdown's "Mark all read".
export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  await prisma.notification.updateMany({ where: { userId: ctx.userId, read: false }, data: { read: true } });
  return NextResponse.json({ success: true });
}
