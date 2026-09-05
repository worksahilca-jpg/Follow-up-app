import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { KNOWN_LEAD_SOURCES } from "@/lib/sourceRouting";
import type { AutomationTier } from "@prisma/client";

const TIERS: AutomationTier[] = ["OFF", "ASSISTED", "AUTONOMOUS"];

// GET /api/source-rules — every source the app actually creates leads
// from, with whatever rule (if any) the business has set for it. Always
// returns one row per KNOWN_LEAD_SOURCES entry, ruleless sources included,
// so Settings can render a full table rather than only the configured ones.
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const [rules, sequences] = await Promise.all([
    prisma.sourceRule.findMany({ where: { businessId: ctx.businessId } }),
    prisma.sequence.findMany({ where: { businessId: ctx.businessId }, select: { id: true, name: true, active: true } }),
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

  return NextResponse.json({ success: true, rules: table, sequences });
}

// POST /api/source-rules — upsert the rule for one source. Passing both
// sequenceId and automationTierDefault as null clears the rule back to
// "do nothing special" rather than deleting the row outright — simpler to
// always upsert than to branch on whether a row already exists.
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: BILLING_LOCKED_MESSAGE }, { status: 402 });
  }

  const body = await request.json().catch(() => ({}));
  const source = typeof body.source === "string" ? body.source : "";
  if (!KNOWN_LEAD_SOURCES.includes(source as (typeof KNOWN_LEAD_SOURCES)[number])) {
    return NextResponse.json({ success: false, message: "Unknown lead source." }, { status: 400 });
  }

  // A rule is exactly one of routeToPool / sequenceId / automationTierDefault,
  // never more than one — enrolling in a sequence already takes
  // automationTier to OFF (see sequences.ts), so a saved tier default would
  // just be dead data sitting next to it, and a pool-routed lead isn't
  // meant to also run a workflow or automation tier yet (see
  // src/lib/sourceRouting.ts) until someone claims it.
  const routeToPool = body.routeToPool === true;
  const sequenceId = !routeToPool && typeof body.sequenceId === "string" && body.sequenceId ? body.sequenceId : null;
  const automationTierDefault: AutomationTier | null =
    !routeToPool && !sequenceId && TIERS.includes(body.automationTierDefault) ? body.automationTierDefault : null;

  if (sequenceId) {
    const sequence = await prisma.sequence.findUnique({ where: { id: sequenceId } });
    if (!sequence || sequence.businessId !== ctx.businessId) {
      return NextResponse.json({ success: false, message: "Workflow not found." }, { status: 404 });
    }
  }

  await prisma.sourceRule.upsert({
    where: { businessId_source: { businessId: ctx.businessId, source } },
    update: { sequenceId, automationTierDefault, routeToPool },
    create: { businessId: ctx.businessId, source, sequenceId, automationTierDefault, routeToPool },
  });

  return NextResponse.json({ success: true });
}
