import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { parseJsonBody } from "@/lib/validation";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { recordNoAnswer, undoNoAnswer } from "@/lib/calls";

const schema = z.object({ undo: z.boolean().optional() });

// POST /api/leads/[id]/no-answer — "No answer" on the Call box (design brain
// A-103, the realtor team pilot), and its Undo with { undo: true }. Records
// the call, plans the next one, and on the first unanswered call writes a
// short message asking for a good time. That message is held for a person
// to send; nothing is sent from here. Any teammate may tap it: it's their
// call. See src/lib/calls.ts.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  // A team of ten making 50 calls a day each stays well under this.
  if (await tooManyRecentActions(ctx.businessId, "leads.no_answer", { windowMinutes: 10, max: 300 })) {
    return NextResponse.json({ success: false, message: "Too many requests — try again in a few minutes." }, { status: 429 });
  }

  const { id } = await params;
  const parsed = await parseJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;

  const result = parsed.data.undo ? await undoNoAnswer(id, ctx.businessId, ctx.userId) : await recordNoAnswer(id, ctx.businessId, ctx.userId);
  const status = result.success ? 200 : "message" in result && result.message === "Lead not found." ? 404 : 400;
  return NextResponse.json(result, { status });
}
