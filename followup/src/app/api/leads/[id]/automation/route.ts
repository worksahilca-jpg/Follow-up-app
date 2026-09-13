import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { parseJsonBody } from "@/lib/validation";

const automationTierSchema = z.object({
  tier: z.string().transform((v) => v.toUpperCase()).pipe(z.enum(["OFF", "ASSISTED", "AUTONOMOUS"])),
});

// POST /api/leads/[id]/automation — sets the per-lead automation trust
// tier. ASSISTED by default since 2026-09-06 (CEO decision, see schema.prisma's
// AutomationTier comment and git history on Lead.automationTier) — a fresh
// lead is already eligible for the risk-gated auto-send path unless an owner
// dials it down to OFF; this route is how a lead moves between any of the
// three tiers, one at a time. See src/lib/automation.ts for what each tier
// actually does.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: BILLING_LOCKED_MESSAGE }, { status: 402 });
  }

  const { id } = await params;
  const owned = await prisma.lead.findFirst({ where: { id, businessId: ctx.businessId }, select: { id: true, sequenceId: true } });
  if (!owned) return NextResponse.json({ success: false, message: "Lead not found." }, { status: 404 });

  const parsed = await parseJsonBody(request, automationTierSchema);
  if (!parsed.ok) return parsed.response;

  // A lead actively enrolled in a workflow (src/lib/sequences.ts) must not
  // also be turned on for the separate silence-based automation path —
  // enrollLead() forces automationTier to OFF specifically to keep these
  // two systems from both messaging the same lead on the same day (see
  // sequences.ts's own module comment), but nothing enforced the other
  // direction: this route would happily flip an enrolled lead to
  // ASSISTED/AUTONOMOUS, since sequenceId isn't excluded anywhere in
  // automation.ts's own candidate query. Refuse instead of silently
  // risking a double-send.
  if (parsed.data.tier !== "OFF" && owned.sequenceId) {
    return NextResponse.json(
      { success: false, message: "This lead is enrolled in a workflow — remove it from the workflow first, or it could get messaged twice." },
      { status: 409 }
    );
  }

  // Autonomous send is a Plus/Pro capability (research/market/2026-09-11-
  // tier-pricing-recommendation.md: Free is "Assisted only... No
  // autonomous send") — refused here rather than left to fail silently
  // downstream, since automation.ts's own defense against a stale
  // AUTONOMOUS lead on a downgraded business only covers leads already
  // set that way, not new opt-ins.
  if (parsed.data.tier === "AUTONOMOUS") {
    const business = await prisma.business.findUnique({ where: { id: ctx.businessId }, select: { tier: true } });
    if (business?.tier === "free") {
      return NextResponse.json(
        { success: false, message: "Autonomous send needs Plus or Pro — upgrade in Settings → Billing." },
        { status: 403 }
      );
    }
  }

  const lead = await prisma.lead.update({
    where: { id },
    data: { automationTier: parsed.data.tier },
  });

  return NextResponse.json({ success: true, automationTier: lead.automationTier.toLowerCase() });
}
