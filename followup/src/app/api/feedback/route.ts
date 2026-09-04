import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";

const MAX_MESSAGE = 2000;

// POST /api/feedback — one message from a signed-in user about FollowUp
// itself, not a support ticket and not customer feedback from a lead. No
// GET route to list these here on purpose: this is written to be read by
// whoever's building FollowUp (directly in the DB, for now), not surfaced
// back inside the product — see the quiet, optional form in Settings.
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE) : "";
  if (!message) {
    return NextResponse.json({ success: false, message: "Say a little more before sending." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });

  await prisma.productFeedback.create({
    data: {
      businessId: ctx.businessId,
      userId: ctx.userId,
      userName: user?.name ?? ctx.email.split("@")[0],
      message,
    },
  });

  return NextResponse.json({ success: true });
}
