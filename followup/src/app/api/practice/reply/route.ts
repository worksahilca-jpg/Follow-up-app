import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, billingLockedMessage } from "@/lib/billing";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { parseJsonBody, cleanedText } from "@/lib/validation";
import { practiceReply } from "@/lib/practiceReply";

/** One practice conversation: long enough to reach a booking, short enough to stay cheap. */
const MAX_TURNS = 24;
/** Each practice message costs up to three AI calls; this caps what one business can spend on practice in a day. */
const PRACTICE_PER_DAY = 60;

const bodySchema = z.object({
  turns: z
    .array(z.object({ from: z.enum(["customer", "followup"]), text: cleanedText(1500) }))
    .min(1)
    .max(MAX_TURNS),
  qualification: z.unknown().optional(),
});

/**
 * POST /api/practice/reply — "Practise with FollowUp" (A-288). The owner writes as a customer; this returns what
 * FollowUp would answer and whether it would go out by itself, using the real reply path (src/lib/practiceReply.ts).
 * Stores nothing and sends nothing.
 */
export async function POST(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: await billingLockedMessage(ctx.businessId) }, { status: 402 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ success: false, message: "Practice isn't available right now." }, { status: 503 });
  }

  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { turns, qualification } = parsed.data;
  const last = turns[turns.length - 1];
  if (last.from !== "customer" || !last.text) {
    return NextResponse.json({ success: false, message: "Write something as the customer first." }, { status: 400 });
  }

  if (await tooManyRecentActions(ctx.businessId, "practice.reply", { windowMinutes: 24 * 60, max: PRACTICE_PER_DAY })) {
    return NextResponse.json({ success: false, message: "That's a lot of practice for one day. Try again tomorrow." }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });
  try {
    const result = await practiceReply(ctx.businessId, user?.name || "there", turns, qualification);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("Practice reply failed:", err);
    return NextResponse.json({ success: false, message: "FollowUp couldn't answer just now. Try again." }, { status: 500 });
  }
}
