import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { getSessionContext } from "@/lib/session";
import { parseJsonBody } from "@/lib/validation";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { INDUSTRIES } from "@/lib/industries";
import { startRound } from "@/lib/checkerRounds";

// Twenty test messages answered three times with the lessons in use, each reply checked: 60 drafts and 60 checks.
export const maxDuration = 300;

/** Each round is about 120 paid model calls; this keeps a stuck page from running up the bill. */
const ROUNDS_PER_DAY = 10;

const bodySchema = z.object({ trade: z.enum(INDUSTRIES) });

/**
 * POST /api/admin/train/mark — "Write 60 replies" on Admin → Train → Mark replies (plan step 4, A-321,
 * src/lib/checkerRounds.ts). Founder only, from this site only, like the rest of Train. Answers once the replies are
 * written; the page then shows the first one.
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
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ success: false, message: "FollowUp can't write replies on this copy of the app." }, { status: 503 });
  }
  if (await tooManyRecentActions(ctx.businessId, "admin.train.mark", { windowMinutes: 24 * 60, max: ROUNDS_PER_DAY })) {
    return NextResponse.json({ success: false, message: "That's a lot of rounds for one day. Try again tomorrow." }, { status: 429 });
  }
  const result = await startRound(parsed.data.trade, ctx.userId);
  if (result.ok) return NextResponse.json({ success: true, id: result.id, replies: result.replies });
  const message =
    result.message ??
    {
      no_test: "There are no test messages for this kind of business yet.",
      running: "FollowUp is already writing replies. It takes about 2 minutes.",
      failed: "FollowUp stopped before the replies were written. Try again.",
    }[result.reason];
  return NextResponse.json({ success: false, reason: result.reason, message }, { status: result.reason === "failed" ? 502 : 409 });
}
