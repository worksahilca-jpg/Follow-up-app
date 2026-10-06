import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { decideHabit, findHabitSuggestion, getHabits, HABIT_KINDS } from "@/lib/habits";

/**
 * GET/POST /api/business/habits — "FollowUp learns what you do" (A-099,
 * src/lib/habits.ts).
 *
 * GET: the habits this business has said yes to (Settings → Your business →
 * "How you work"), and the one question Today should ask, if any. Only an
 * admin is asked, because a yes changes what FollowUp does for everyone.
 *
 * POST { kind, decision }: "on" / "declined" from Today, "off" from Undo in
 * Settings. Admin only, audited.
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  const isAdmin = await requireAdmin(ctx);
  const [habits, suggestion] = await Promise.all([getHabits(ctx.businessId), isAdmin ? findHabitSuggestion(ctx.businessId) : null]);
  return NextResponse.json({
    success: true,
    isAdmin,
    habits: habits.filter((h) => h.status === "on").map((h) => ({ kind: h.kind, evidence: h.evidence, decidedAt: h.decidedAt })),
    suggestion,
  });
}

const decisionSchema = z.object({
  kind: z.enum(HABIT_KINDS),
  decision: z.enum(["on", "declined", "off"]),
});

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can change this." }, { status: 403 });
  if (await tooManyRecentActions(ctx.businessId, "business.habit", { windowMinutes: 60, max: 60 })) {
    return NextResponse.json({ success: false, message: "Too many changes. Wait a few minutes and try again." }, { status: 429 });
  }
  const parsed = await parseJsonBody(request, decisionSchema);
  if (!parsed.ok) return parsed.response;
  const { kind, decision } = parsed.data;
  await decideHabit(ctx.businessId, ctx.userId, kind, decision);
  void recordAudit(ctx, "business.habit", { targetType: "business", targetId: ctx.businessId, meta: { kind, decision } });
  return NextResponse.json({ success: true });
}
