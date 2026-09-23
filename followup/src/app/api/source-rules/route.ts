import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { requireActiveBilling, billingLockedMessage } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { KNOWN_LEAD_SOURCES } from "@/lib/sourceRouting";
import { isAutonomousAllowed, AUTONOMOUS_NOT_ALLOWED_MESSAGE } from "@/lib/autonomousPermission";
import { parseJsonBody } from "@/lib/validation";
import type { AutomationTier } from "@prisma/client";

const sourceRuleSchema = z.object({
  source: z.string(),
  routeToPool: z.boolean().optional(),
  sequenceId: z.string().nullable().optional(),
  automationTierDefault: z.enum(["OFF", "ASSISTED", "AUTONOMOUS"]).nullable().optional(),
});

// GET /api/source-rules — every source the app actually creates leads
// from, with whatever rule (if any) the business has set for it. Always
// returns one row per KNOWN_LEAD_SOURCES entry, ruleless sources included,
// so Settings can render a full table rather than only the configured ones.
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const [rules, sequences, autonomousAllowed] = await Promise.all([
    prisma.sourceRule.findMany({ where: { businessId: ctx.businessId } }),
    prisma.sequence.findMany({ where: { businessId: ctx.businessId }, select: { id: true, name: true, active: true } }),
    // Returned so Settings can stop offering a choice the POST below now
    // refuses, and can say plainly when a saved rule cannot act on what
    // it says. Without it the table has no way to know, which is how the
    // rule and the leads came to disagree in silence.
    isAutonomousAllowed(ctx.businessId),
  ]);
  const bySource = new Map(rules.map((r) => [r.source, r]));

  const table = KNOWN_LEAD_SOURCES.map((source) => {
    const rule = bySource.get(source);
    return {
      source,
      sequenceId: rule?.sequenceId ?? null,
      automationTierDefault: rule?.automationTierDefault ?? null,
      routeToPool: rule?.routeToPool ?? false,
    };
  });

  return NextResponse.json({ success: true, rules: table, sequences, autonomousAllowed });
}

// POST /api/source-rules — upsert the rule for one source. Passing both
// sequenceId and automationTierDefault as null clears the rule back to
// "do nothing special" rather than deleting the row outright — simpler to
// always upsert than to branch on whether a row already exists.
//
// Admin-only, matching POST /api/automation/settings. A source rule is an
// automation default for the whole business, not per-lead work: it decides
// what happens to EVERY future lead from a channel the moment it is created
// (src/lib/sourceRouting.ts), including silently setting automationTier to
// AUTONOMOUS — unreviewed sending — for all of them. That is the same class
// of account-level decision requireAdmin() already guards for the automation
// master switch; GET stays open to everyone so a SALES rep can still see
// what the rules are.
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) {
    return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  }
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: await billingLockedMessage(ctx.businessId) }, { status: 402 });
  }

  const parsed = await parseJsonBody(request, sourceRuleSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  if (!KNOWN_LEAD_SOURCES.includes(body.source as (typeof KNOWN_LEAD_SOURCES)[number])) {
    return NextResponse.json({ success: false, message: "Unknown lead source." }, { status: 400 });
  }
  const source = body.source;

  // A rule is exactly one of routeToPool / sequenceId / automationTierDefault,
  // never more than one — enrolling in a sequence already takes
  // automationTier to OFF (see sequences.ts), so a saved tier default would
  // just be dead data sitting next to it, and a pool-routed lead isn't
  // meant to also run a workflow or automation tier yet (see
  // src/lib/sourceRouting.ts) until someone claims it.
  const routeToPool = body.routeToPool === true;
  const sequenceId = !routeToPool && body.sequenceId ? body.sequenceId : null;
  const automationTierDefault: AutomationTier | null = !routeToPool && !sequenceId ? (body.automationTierDefault ?? null) : null;

  if (sequenceId) {
    const sequence = await prisma.sequence.findUnique({ where: { id: sequenceId } });
    if (!sequence || sequence.businessId !== ctx.businessId) {
      return NextResponse.json({ success: false, message: "Workflow not found." }, { status: 404 });
    }
  }

  /**
   * The third way to Auto, and until now the only one that did not ask.
   *
   * `POST /api/leads/[id]/automation` refuses with 403 when the account
   * has not granted the permission. `POST /api/leads/bulk-automation`
   * refuses with the same message. This route accepted — and then
   * `applySourceRouting` quietly started every lead the rule touched on
   * ASSISTED instead. The rule row went on reading "Autonomous" forever.
   *
   * So the owner picked a mode, was told nothing, and got another one.
   * Two sibling paths refuse out loud; this one accepted and then
   * disagreed with itself, which is worse than either refusing or
   * obeying. Nothing in the product ever connected the rule to what the
   * leads actually did.
   *
   * `requireAdmin` above is not this check and never was — it asks WHO
   * is making the change, not whether the account has said yes to
   * unreviewed sending. An admin without the permission is exactly the
   * person who hit this.
   *
   * The downgrade in `applySourceRouting` deliberately stays: the
   * permission can be revoked after a rule was legitimately saved, and
   * new leads must not land on a mode the owner has taken back.
   */
  if (automationTierDefault === "AUTONOMOUS" && !(await isAutonomousAllowed(ctx.businessId))) {
    return NextResponse.json({ success: false, message: AUTONOMOUS_NOT_ALLOWED_MESSAGE }, { status: 403 });
  }

  await prisma.sourceRule.upsert({
    where: { businessId_source: { businessId: ctx.businessId, source } },
    update: { sequenceId, automationTierDefault, routeToPool },
    create: { businessId: ctx.businessId, source, sequenceId, automationTierDefault, routeToPool },
  });

  return NextResponse.json({ success: true });
}
