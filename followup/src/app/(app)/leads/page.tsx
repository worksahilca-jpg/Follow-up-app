import { getLeads } from "@/lib/leads-data";
import { getSessionContext } from "@/lib/session";
import { getPendingApprovals } from "@/lib/pendingApprovals";
import { getBusinessAutomationRules } from "@/lib/automationStatus";
import { getWaitingOn } from "@/lib/waitingOn";
import { getAtRiskLeads } from "@/lib/rescue";
import { prisma } from "@/lib/db";
import Link from "next/link";
import LeadsPageClient from "./LeadsPageClient";
import PersonPanel from "@/components/app/PersonPanel";
import { sendLockedForSession } from "@/lib/sendingControl";
import { restingState, type StateKey } from "@/components/app/canvasBits";

export const dynamic = "force-dynamic";

/**
 * Customers (canvas App board, "People"): the table plus the canvas's four
 * places, All · Needs you · Going quiet · Waiting. Each place is worked out
 * here from the same sources Today uses, so the counts always agree:
 * Needs you is the approval queue, Waiting is the Waiting-on-customers
 * list, Going quiet is About to be lost (minus anyone already needing you).
 */
export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const ctx = await getSessionContext();
  const leads = await getLeads();
  if (!ctx) return <LeadsPageClient leads={leads} places={{ needs: [], quiet: [], waiting: [] }} />;

  const now = new Date();
  const [approvals, business, rules, sendLocked] = await Promise.all([
    getPendingApprovals(ctx.businessId),
    prisma.business.findUnique({ where: { id: ctx.businessId }, select: { timezone: true } }),
    getBusinessAutomationRules(ctx.businessId),
    sendLockedForSession(),
  ]);
  const timeZone = business?.timezone ?? "America/New_York";
  const needs = new Set(approvals.map((a) => a.leadId));
  const waiting = rules
    ? getWaitingOn(leads, rules, now, timeZone, needs).map((w) => w.leadId)
    : [];
  const quiet = getAtRiskLeads(leads, now)
    .map((l) => l.id)
    .filter((id) => !needs.has(id));

  const places = { needs: [...needs], quiet, waiting };

  // A customer opened beside the list (A-025, the canvas App board). Only
  // one of this business's own customers: getLeads is already scoped.
  const open = p ? leads.find((l) => l.id === p) ?? null : null;
  if (!open) return <LeadsPageClient leads={leads} places={places} />;

  const approval = approvals.find((a) => a.leadId === open.id) ?? null;
  const place: { state: StateKey; label: string } = needs.has(open.id)
    ? { state: "needs", label: "Needs you" }
    : quiet.includes(open.id)
      ? { state: "quiet", label: "Going quiet" }
      : waiting.includes(open.id)
        ? { state: "waiting", label: "Waiting" }
        : restingState(open);

  return (
    // Desktop: full height, the list on the left and the customer docked on
    // the right edge, the Inbox's frame (A-025). Phone: the customer alone.
    <div className="app-bleed lg:grid lg:h-screen lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="hidden min-w-0 lg:block lg:overflow-y-auto lg:px-7 lg:pb-12 lg:pt-9">
        <LeadsPageClient leads={leads} places={places} openId={open.id} />
      </div>
      <aside aria-label={open.name} className="lg:overflow-y-auto lg:border-l lg:border-line lg:bg-card">
        <Link href="/leads" className="mb-3 inline-block text-[13px] text-ink-faint lg:hidden">
          ← Customers
        </Link>
        <div className="overflow-hidden rounded-[18px] border border-line bg-card lg:overflow-visible lg:rounded-none lg:border-0">
          <PersonPanel lead={open} approval={approval} place={place} timeZone={timeZone} now={now} sendLocked={sendLocked} />
        </div>
      </aside>
    </div>
  );
}
