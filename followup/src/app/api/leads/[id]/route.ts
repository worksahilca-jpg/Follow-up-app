import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { deleteLeadCascade } from "@/lib/leads-admin";
import { recordAudit } from "@/lib/audit";

// DELETE /api/leads/[id] — permanently removes a lead and everything under
// it (conversations, messages, deals, follow-ups, tasks, AI insights).
// Used to clean up a lead that shouldn't have existed in the first place —
// e.g. a personal email or newsletter Gmail sync mistook for a sales
// conversation before the AI prospect check was added. There's no undo.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead || lead.businessId !== ctx.businessId) {
    return NextResponse.json({ success: false, message: "Lead not found." }, { status: 404 });
  }

  // The tenant goes with it even though ownership was checked just above:
  // deleteLeadCascade re-checks inside, right before the rows go, which is
  // the guard that still holds if the check above is ever refactored away
  // (audits 2026-09-16 L-2, 2026-09-26).
  await deleteLeadCascade(id, ctx.businessId);
  void recordAudit(ctx, "lead.delete", { targetType: "lead", targetId: id });

  return NextResponse.json({ success: true });
}
