import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { getSessionContext } from "@/lib/session";
import { parseJsonBody } from "@/lib/validation";
import { markReply } from "@/lib/checkerRounds";

const bodySchema = z.object({
  id: z.string().min(1).max(64),
  verdict: z.enum(["send", "fix", "skip"]),
  marked: z.array(z.string().max(32)).max(10).default([]),
});

/**
 * POST /api/admin/train/mark/reply — the founder's answer about one reply on Mark replies (plan step 4, A-321): would
 * they send it as it is, and if not, what's wrong. Founder only, from this site only. No model call.
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
  const { id, verdict, marked } = parsed.data;
  if (verdict === "fix" && marked.length === 0) {
    return NextResponse.json({ success: false, message: "Pick what's wrong with it, or Something else." }, { status: 400 });
  }
  if (!(await markReply(id, verdict, marked))) {
    return NextResponse.json({ success: false, message: "That reply isn't there any more. Reload the page." }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
