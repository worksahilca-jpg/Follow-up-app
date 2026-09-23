/**
 * POST /api/leads/bulk-automation — set the automation mode on every
 * lead at once, or on every lead from one source.
 *
 * The catch-up half of source routing: rules decide what NEW leads start
 * on, this moves the ones a business already has. See
 * @/lib/bulkAutomation for the guards it carries over from the
 * single-lead route, and why an enrolled lead is skipped rather than
 * failing the batch.
 *
 * Admin-only. The single-lead route is not, because changing one lead is
 * ordinary work for anyone on the team; changing all of them is a
 * business-wide decision about what reaches customers, so it sits with
 * whoever can already grant sending permission.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { requireActiveBilling, billingLockedMessage } from "@/lib/billing";
import { parseJsonBody } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { setAutomationTierInBulk } from "@/lib/bulkAutomation";
import { KNOWN_LEAD_SOURCES } from "@/lib/sourceRouting";
import { isAutonomousAllowed, AUTONOMOUS_NOT_ALLOWED_MESSAGE } from "@/lib/autonomousPermission";

const bulkSchema = z.object({
  tier: z.string().transform((v) => v.toUpperCase()).pipe(z.enum(["OFF", "ASSISTED", "AUTONOMOUS"])),
  // Checked against the sources the app itself writes, so a typo cannot
  // quietly match nothing and report "0 leads updated" as if that were
  // the answer.
  source: z.enum(KNOWN_LEAD_SOURCES).nullish(),
});

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) {
    return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  }
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: await billingLockedMessage(ctx.businessId) }, { status: 402 });
  }

  const parsed = await parseJsonBody(request, bulkSchema);
  if (!parsed.ok) return parsed.response;
  const { tier, source } = parsed.data;

  // Same refusal as the single-lead route, for the same reason: Free is
  // Assisted-only. Checked here rather than downstream so a business on
  // Free cannot reach autonomous send by going the bulk way round.
  if (tier === "AUTONOMOUS") {
    // Same permission as the single-lead route. Doing this to 600 leads
    // at once is the last place it should be easier than doing it to one.
    if (!(await isAutonomousAllowed(ctx.businessId))) {
      return NextResponse.json({ success: false, message: AUTONOMOUS_NOT_ALLOWED_MESSAGE }, { status: 403 });
    }
    const business = await prisma.business.findUnique({ where: { id: ctx.businessId }, select: { tier: true } });
    if (business?.tier === "free") {
      return NextResponse.json(
        { success: false, message: "Sending everything without review needs Plus or Pro — upgrade in Settings → Billing." },
        { status: 403 }
      );
    }
  }

  const result = await setAutomationTierInBulk({ businessId: ctx.businessId, tier, source: source ?? null });

  // How many, and to what — the question asked after a customer gets a
  // message nobody remembers authorising.
  void recordAudit(ctx, "leads.automation.bulk", {
    meta: { tier, source: source ?? null, updated: result.updated, skippedInWorkflow: result.skippedInWorkflow },
  });

  return NextResponse.json({ success: true, ...result });
}
