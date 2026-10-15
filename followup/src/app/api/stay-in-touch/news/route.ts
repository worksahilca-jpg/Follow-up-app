import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { parseJsonBody } from "@/lib/validation";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { MAX_NEWS, MIN_NEWS, newsResultLines } from "@/lib/stayInTouch";
import { newsNotNow, writeStayNotes } from "@/lib/stayInTouchData";
import { NEXT_QUESTION_GAP_MS } from "@/lib/dailyQuestion";

/**
 * POST /api/stay-in-touch/news — the answer to Today's "Anything new for
 * the customers staying in touch?" (A-260).
 *
 * { text } writes one note for each customer staying in touch that it fits,
 * each held on Today for the owner's OK; nothing is sent from here.
 * { notNow: true } is "Not now". Either way Today's next question waits
 * about a day. Admin only, like the other daily questions, because the
 * notes go out in the business's name. Audited without the words.
 */
const schema = z.union([
  z.object({ text: z.string().trim().min(MIN_NEWS, "Add a little more, like what it is and where.").max(MAX_NEWS, `Keep it under ${MAX_NEWS} characters.`) }),
  z.object({ notNow: z.literal(true) }),
]);

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  // Each answer runs one AI note per customer staying in touch: a few an hour is plenty.
  if (await tooManyRecentActions(ctx.businessId, "stay_in_touch.news", { windowMinutes: 60, max: 6 })) {
    return NextResponse.json({ success: false, message: "That's a lot of news at once. Try again in an hour." }, { status: 429 });
  }
  const parsed = await parseJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;

  const nextQuestion = new Date(Date.now() + NEXT_QUESTION_GAP_MS);
  if ("notNow" in parsed.data) {
    await newsNotNow(ctx.businessId);
    await prisma.business.update({ where: { id: ctx.businessId }, data: { questionAfter: nextQuestion } });
    void recordAudit(ctx, "business.question", { targetType: "business", targetId: ctx.businessId, meta: { decision: "not_now", kind: "stay_in_touch" } });
    return NextResponse.json({ success: true });
  }

  const result = await writeStayNotes({ businessId: ctx.businessId, userId: ctx.userId }, parsed.data.text);
  await prisma.business.update({ where: { id: ctx.businessId }, data: { questionAfter: nextQuestion } });
  return NextResponse.json({ success: true, lines: newsResultLines(result), wrote: result.fit.length });
}
