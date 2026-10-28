import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { requireActiveBilling, billingLockedMessage } from "@/lib/billing";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { parseJsonBody } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";
import { practiceReply } from "@/lib/practiceReply";
import { todaysPractice } from "@/lib/dailyPracticeData";
import { NEXT_QUESTION_GAP_MS } from "@/lib/dailyQuestion";

/** A reload or a second device asks again; each ask is up to three AI calls, so a day has a ceiling. */
const REPLIES_PER_DAY = 6;

const bodySchema = z.object({ step: z.enum(["reply", "done"]) });

/**
 * POST /api/practice/daily — the practice card on Today (A-330, src/lib/dailyPractice.ts).
 *
 * { step: "reply" } writes the reply FollowUp would send today's made-up customer, with the real reply writer and the
 * owner's facts, voice, examples and rules (src/lib/practiceReply.ts). The customer is picked here, never taken from
 * the request. Nothing is stored and nothing is sent.
 * { step: "done" } closes the daily slot for about a day, as the daily question does (A-101): after Looks right, a
 * saved change or Not now. A change itself is kept by POST /api/practice/teach (A-290).
 *
 * Admin only, like the daily question: the card changes how replies sent in the business's name are written.
 */
export async function POST(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  if (parsed.data.step === "done") {
    await prisma.business.update({ where: { id: ctx.businessId }, data: { questionAfter: new Date(Date.now() + NEXT_QUESTION_GAP_MS) } });
    void recordAudit(ctx, "practice.daily", { targetType: "business", targetId: ctx.businessId, meta: { decision: "done" } });
    return NextResponse.json({ success: true });
  }

  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: await billingLockedMessage(ctx.businessId) }, { status: 402 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ success: false, message: "This isn't available right now." }, { status: 503 });
  }
  const practice = await todaysPractice(ctx.businessId);
  if (!practice) return NextResponse.json({ success: false, message: "No practice today." }, { status: 409 });
  if (await tooManyRecentActions(ctx.businessId, "practice.daily", { windowMinutes: 24 * 60, max: REPLIES_PER_DAY })) {
    return NextResponse.json({ success: false, message: "That's enough practice for today. Another one tomorrow." }, { status: 429 });
  }
  try {
    const result = await practiceReply(ctx.businessId, practice.name, [{ from: "customer", text: practice.text }], null, "email", false, { answerFirst: true });
    return NextResponse.json({ success: true, name: practice.name, text: practice.text, reply: result.reply });
  } catch (err) {
    console.error("Daily practice reply failed:", err);
    return NextResponse.json({ success: false, message: "FollowUp couldn't write one just now." }, { status: 500 });
  }
}
