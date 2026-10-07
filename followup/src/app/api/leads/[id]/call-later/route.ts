import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { parseJsonBody } from "@/lib/validation";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { callLater } from "@/lib/calls";

const schema = z.object({ undo: z.boolean().optional() });

// POST /api/leads/[id]/call-later — "Later" on a call card on Today (design
// brain A-103): the call comes back in three hours. { undo: true } puts it back.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (await tooManyRecentActions(ctx.businessId, "leads.call_later", { windowMinutes: 10, max: 300 })) {
    return NextResponse.json({ success: false, message: "Too many requests — try again in a few minutes." }, { status: 429 });
  }
  const { id } = await params;
  const parsed = await parseJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;
  const result = await callLater(id, ctx.businessId, ctx.userId, parsed.data.undo ?? false);
  return NextResponse.json(result, { status: result.success ? 200 : result.message === "Lead not found." ? 404 : 400 });
}
