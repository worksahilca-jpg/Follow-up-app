import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { parseJsonBody } from "@/lib/validation";

const MAX_MESSAGE = 2000;
const feedbackSchema = z.object({ message: z.string().trim().min(1, "Say a little more before sending.").max(MAX_MESSAGE) });

// POST /api/feedback — one message from a signed-in user about FollowUp
// itself, not a support ticket and not customer feedback from a lead. No
// GET route to list these here on purpose: this is written to be read by
// whoever's building FollowUp (directly in the DB, for now), not surfaced
// back inside the product — see the quiet, optional form in Settings.
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const parsed = await parseJsonBody(request, feedbackSchema);
  if (!parsed.ok) return parsed.response;
  const { message } = parsed.data;

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
