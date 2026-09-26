import { PageHeader } from "@/components/PageHeader";
import { getLeads } from "@/lib/leads-data";
import { getSessionContext } from "@/lib/session";
import { getPendingApprovals } from "@/lib/pendingApprovals";
import { getBusinessAutomationRules } from "@/lib/automationStatus";
import { getWaitingOn } from "@/lib/waitingOn";
import WaitingList from "@/components/WaitingList";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * "Waiting on customers" (design brain A-050, the Close study): everyone
 * answered who hasn't answered back, with what happens next for each.
 * Nothing to do here; each one moves back to Needs you the moment the
 * customer writes.
 */
export default async function WaitingPage() {
  const ctx = await getSessionContext();
  const leads = await getLeads();
  const [approvals, business, rules] = ctx
    ? await Promise.all([
        getPendingApprovals(ctx.businessId),
        prisma.business.findUnique({ where: { id: ctx.businessId }, select: { timezone: true } }),
        getBusinessAutomationRules(ctx.businessId),
      ])
    : [[], null, null];
  const timeZone = business?.timezone ?? "America/New_York";
  const now = new Date();
  const items = rules ? getWaitingOn(leads, rules, now, timeZone, new Set(approvals.map((a) => a.leadId))) : [];
  const title = items.length === 1 ? "Waiting on 1 customer" : `Waiting on ${items.length} customers`;

  return (
    <div>
      <PageHeader
        back={{ href: "/dashboard", label: "Today" }}
        title={title}
        subtitle="You answered; they haven’t yet. Nothing to do here. Each one moves back to Needs you the moment the customer writes."
      />
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">Nobody right now. Everyone you answered has written back, or is closed.</p>
      ) : (
        <WaitingList items={items} now={now} timeZone={timeZone} />
      )}
    </div>
  );
}
