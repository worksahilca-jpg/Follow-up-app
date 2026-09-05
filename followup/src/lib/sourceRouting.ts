/**
 * Per-source lead routing — what happens automatically the moment a NEW
 * lead is created from a given source (Lead.source: "Gmail",
 * "Gmail (spam)", "SMS", "Phone call", "Webhook", "Website form",
 * "Manual entry", "Instagram"). A business sets these rules once in
 * Settings (see SourceRule in schema.prisma); every real-time lead-creation
 * call site below calls this exactly once, right after creating the lead —
 * never on a resync/update of an existing one.
 *
 * Deliberately narrow: this routes by WHERE a lead came from, not by what
 * KIND of lead it is or who should work it — that's the more complex
 * "smart routing to the right salesperson" idea, parked until there's a
 * real team to route between. Per-source routing needs no team at all.
 *
 * routeToPool is the one exception worth calling out: it's not about
 * automation at all, just who (if anyone) a new lead starts assigned to —
 * see the shared claimable pool ("Ponds",
 * research/market/2026-09-05-competitor-feature-gaps.md #1.1). Every
 * creation call site already runs pickAssignee() before calling here, so
 * rather than teaching each of them about pools too, this just undoes
 * that assignment for a pool-routed source, in the one place all of them
 * already funnel through.
 */

import { prisma } from "@/lib/db";
import { enrollLead } from "@/lib/sequences";

export async function applySourceRouting(businessId: string, leadId: string, source: string | null | undefined): Promise<void> {
  if (!source) return;

  const rule = await prisma.sourceRule.findUnique({
    where: { businessId_source: { businessId, source } },
  });
  if (!rule) return;

  // routeToPool, sequenceId and automationTierDefault are mutually
  // exclusive — the Settings UI only ever sets one of the three — so this
  // early-returns the same way the sequence branch below does.
  if (rule.routeToPool) {
    await prisma.lead.update({ where: { id: leadId }, data: { assignedToId: null } });
    return;
  }
  // A sequence takes over the lead's automated cadence entirely (see
  // sequences.ts) — mutually exclusive with automationTier, so a rule
  // carrying both only ever acts on the sequence. The Settings UI never
  // actually sets both at once; this is just the same invariant enforced
  // here too rather than trusted to the caller.
  if (rule.sequenceId) {
    await enrollLead(leadId, businessId, rule.sequenceId);
    return;
  }
  if (rule.automationTierDefault) {
    await prisma.lead.update({ where: { id: leadId }, data: { automationTier: rule.automationTierDefault } });
  }
}

// The fixed set of sources real leads can actually carry today — used by
// the Settings UI so a business configures rules against sources that
// exist, not a free-text field that could typo-mismatch what the app
// itself writes. Kept here, next to the routing logic that reads
// Lead.source verbatim, so the two never drift apart.
export const KNOWN_LEAD_SOURCES = [
  "Gmail",
  "Gmail (spam)",
  "SMS",
  "Phone call",
  "Instagram",
  "Website form",
  "Webhook",
  "Manual entry",
] as const;
