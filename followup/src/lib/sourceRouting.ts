/**
 * Per-source lead routing — what happens automatically the moment a NEW
 * lead is created from a given source (Lead.source: "Gmail",
 * "Gmail (spam)", "SMS", "Phone call", "WhatsApp", "Webhook", "Website form",
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
import { isAutonomousAllowed } from "@/lib/autonomousPermission";
import { recordAudit } from "@/lib/audit";
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
    // The quietest path to Auto in the whole product, and until
    // 2026-09-23 the only one with no gate at all: this runs when a lead
    // is CREATED, so one rule could put every new lead from a channel
    // onto unreviewed sending without a human seeing anything, ever. The
    // lead page's confirmation dialog never appears here.
    //
    // A rule that asks for more than the account has permitted is
    // honoured as far as it legitimately can be — the lead lands on
    // ASSISTED rather than being left on whatever it had — so turning the
    // permission on later does not require re-running anything, and
    // turning it off does not quietly strand new leads on a mode the
    // owner has revoked.
    const requested = rule.automationTierDefault;
    const downgraded = requested === "AUTONOMOUS" && !(await isAutonomousAllowed(businessId));
    const tier = downgraded ? "ASSISTED" : requested;
    await prisma.lead.update({ where: { id: leadId }, data: { automationTier: tier } });

    /**
     * A downgrade used to happen in complete silence.
     *
     * `POST /api/source-rules` now refuses to SAVE a rule asking for
     * AUTONOMOUS without the permission, so the ordinary way into this
     * branch is closed. One way in remains and always will: a rule saved
     * legitimately while the permission was on, and the permission later
     * revoked. That is the case this downgrade exists for, and it is the
     * right behaviour — new leads must not land on a mode the owner has
     * taken back.
     *
     * What was wrong was not the downgrade. It was that nothing
     * anywhere recorded it: the rule row went on reading "Autonomous",
     * the leads ran on Assisted, and there was no third thing that knew
     * both. Settings now says so on the rule itself, for the standing
     * state; this is the per-lead trail, which is what answers "when did
     * this start" months later.
     *
     * ## Why this cannot knock a lead out of the approval queue
     *
     * `getPendingApprovals` treats a lead as pending when its MOST
     * RECENT AuditEvent is `ai.hold`, so an event written at the wrong
     * moment would silently empty the queue — the exact shape of bug
     * this file's neighbours have been bitten by before. It is safe
     * here because `applySourceRouting` runs once, immediately after the
     * lead is created (see this file's header), which is strictly before
     * anything can have drafted or held a reply for it. This event can
     * never be the newest one on a held lead.
     */
    if (downgraded) {
      await recordAudit({ businessId }, "automation.downgraded", {
        targetType: "lead",
        targetId: leadId,
        meta: {
          source,
          requested,
          applied: tier,
          reason: "the account has not permitted sending without review",
        },
      });
    }
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
  "WhatsApp",
  "Instagram",
  "Website form",
  "Webhook",
  "Manual entry",
] as const;
