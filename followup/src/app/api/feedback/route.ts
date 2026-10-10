import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { parseJsonBody } from "@/lib/validation";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { tellFounderAboutHelp } from "@/lib/helpAlert";

const MAX_MESSAGE = 2000;
const feedbackSchema = z.object({ message: z.string().trim().min(1, "Say a little more before sending.").max(MAX_MESSAGE) });

// POST /api/feedback — one message from a signed-in user about FollowUp
// itself (the Help window), not customer feedback from a lead. No GET route
// to list these here on purpose: this is written to be read by whoever's
// building FollowUp, not surfaced back inside the product. Since 2026-10-10
// the founder hears it at once, by email and a buzz (src/lib/helpAlert.ts).
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  // Per person, 10 per 10 minutes: far more than anyone writes by hand, and
  // it keeps a script holding one session from filling the table — every
  // row is later read into the founder's office notes (src/lib/office).
  if (await tooManyRecentActions(ctx.businessId, `feedback:${ctx.userId}`, { windowMinutes: 10, max: 10 })) {
    return NextResponse.json({ success: false, message: "Too many requests — try again in a few minutes." }, { status: 429 });
  }

  const parsed = await parseJsonBody(request, feedbackSchema);
  if (!parsed.ok) return parsed.response;
  const { message } = parsed.data;

  const [user, business] = await Promise.all([
    prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } }),
    prisma.business.findUnique({ where: { id: ctx.businessId }, select: { name: true } }),
  ]);
  const userName = user?.name ?? ctx.email.split("@")[0];

  const row = await prisma.productFeedback.create({
    data: { businessId: ctx.businessId, userId: ctx.userId, userName, message },
    select: { id: true },
  });

  // After the answer: the tester's "Sent" never waits on, or fails because of, the founder's email or buzz.
  after(() =>
    tellFounderAboutHelp({ id: row.id, message, fromEmail: ctx.email, fromName: userName, businessName: business?.name || "a business" }).catch((err) =>
      console.error("Help alert to the founder failed:", err)
    )
  );

  return NextResponse.json({ success: true });
}
