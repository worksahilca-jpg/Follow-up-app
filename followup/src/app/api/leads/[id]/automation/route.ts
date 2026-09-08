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
// tier. OFF by default (Lead.automationTier defaults to OFF in the
// schema); this is the only way it changes for a given lead, one at a
// time. See src/lib/automation.ts for what each tier actually does.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: BILLING_LOCKED_MESSAGE }, { status: 402 });
  }

  const { id } = await params;
  const owned = await prisma.lead.findFirst({ where: { id, businessId: ctx.businessId }, select: { id: true } });
  if (!owned) return NextResponse.json({ success: false, message: "Lead not found." }, { status: 404 });

  const parsed = await parseJsonBody(request, automationTierSchema);
  if (!parsed.ok) return parsed.response;

  const lead = await prisma.lead.update({
    where: { id },
    data: { automationTier: parsed.data.tier },
  });

  return NextResponse.json({ success: true, automationTier: lead.automationTier.toLowerCase() });
}
