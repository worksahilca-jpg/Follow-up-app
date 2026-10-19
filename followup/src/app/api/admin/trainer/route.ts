import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { getSessionContext } from "@/lib/session";
import { cleanedText, parseJsonBody } from "@/lib/validation";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { INDUSTRIES } from "@/lib/industries";
import { askTrainer, trainerReady } from "@/lib/trainer";

// One answer can test a few FollowUp replies at once (each a few model calls) before Claude answers.
export const maxDuration = 120;

/** Each answer is a paid Claude call plus a few FollowUp test replies: this keeps a stuck page from running up the bill. */
const ASKS_PER_DAY = 150;

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("ask"),
    message: cleanedText(4000),
    trade: z.enum(INDUSTRIES),
    channel: z.enum(["email", "instagram", "messenger"]),
    turns: z.array(z.object({ from: z.enum(["customer", "followup"]), text: cleanedText(1500) })).max(48),
    focus: z.number().int().min(0).max(47).nullish(),
  }),
]);

/**
 * POST /api/admin/trainer — "Claude on the Train page" (A-298), founder only: ask (one answer from Claude about the
 * Talk to it chat; it may test replies and propose or change rules, see src/lib/trainer.ts). Anyone else gets a 404.
 */
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx || !isPlatformAdmin(ctx.email)) return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site" || site === "same-site") {
    return NextResponse.json({ success: false, message: "Refused: this request came from another site." }, { status: 403 });
  }
  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  if (!body.message.trim()) return NextResponse.json({ success: false, message: "Write something first." }, { status: 400 });
  if (!trainerReady()) {
    return NextResponse.json({ success: false, message: "Claude isn't set up yet. Add the Anthropic key in Vercel first." }, { status: 503 });
  }
  if (await tooManyRecentActions(ctx.businessId, "admin.trainer.ask", { windowMinutes: 24 * 60, max: ASKS_PER_DAY })) {
    return NextResponse.json({ success: false, message: "That's a lot for one day. Try again tomorrow." }, { status: 429 });
  }
  const focus = body.focus ?? null;
  try {
    const turn = await askTrainer({
      businessId: ctx.businessId,
      userId: ctx.userId,
      message: body.message,
      talk: { trade: body.trade, channel: body.channel, turns: body.turns, focus: focus !== null && focus < body.turns.length ? focus : null },
    });
    return NextResponse.json({ success: true, turn });
  } catch {
    return NextResponse.json({ success: false, message: "Claude couldn't answer just now. Your message is kept; try again." }, { status: 502 });
  }
}
