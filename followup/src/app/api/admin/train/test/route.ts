import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { getSessionContext } from "@/lib/session";
import { parseJsonBody } from "@/lib/validation";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { INDUSTRIES } from "@/lib/industries";
import { runLessonTest } from "@/lib/lessonTest";

// Twenty test messages, answered three times without and three times with the waiting lessons: about 120 drafts and
// 120 checks.
export const maxDuration = 300;

/** Each test is about 250 paid model calls; this keeps a stuck page from running up the bill. */
const TESTS_PER_DAY = 20;

const bodySchema = z.object({ trade: z.enum(INDUSTRIES) });

/**
 * POST /api/admin/train/test — "Test them" on Admin → Train → Talk to it (A-319, src/lib/lessonTest.ts). Founder only,
 * from this site only, like the rest of Train. Answers when the test has finished; the page reads the result back.
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
  if (await tooManyRecentActions(ctx.businessId, "admin.train.test", { windowMinutes: 24 * 60, max: TESTS_PER_DAY })) {
    return NextResponse.json({ success: false, message: "That's a lot of tests for one day. Try again tomorrow." }, { status: 429 });
  }
  const result = await runLessonTest(parsed.data.trade, ctx.userId);
  if (result.ok) return NextResponse.json({ success: true, id: result.id });
  const message =
    result.message ??
    {
      no_test: "There's no reply test for this kind of business yet.",
      nothing: "Nothing is waiting for a test.",
      running: "A test is already running. It takes about 2 minutes.",
      failed: "The test stopped before it finished. Test again.",
    }[result.reason];
  return NextResponse.json({ success: false, reason: result.reason, message }, { status: result.reason === "failed" ? 502 : 409 });
}
