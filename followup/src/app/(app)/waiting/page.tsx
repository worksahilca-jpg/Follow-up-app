import Link from "next/link";
import { getLeads } from "@/lib/leads-data";
import { getSessionContext } from "@/lib/session";
import { getPendingApprovals } from "@/lib/pendingApprovals";
import { getBusinessAutomationRules } from "@/lib/automationStatus";
import { getWaitingOn } from "@/lib/waitingOn";
import WaitingList from "@/components/WaitingList";
import { prisma } from "@/lib/db";
import { countHandledToday } from "@/lib/handledToday";
import { startOfLocalDay } from "@/lib/calmToday";

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
  const title = items.length === 1 ? "Waiting on 1 customer." : `Waiting on ${items.length} customers.`;
  // The three places (A-050), with this one underlined.
  const handled = ctx ? await countHandledToday(ctx.businessId, startOfLocalDay(now, timeZone)) : 0;

  return (
    <div>
      <Link href="/dashboard" className="text-[13px] text-ink-faint hover:text-ink">
        ← Today
      </Link>
      <h1 className="mt-2 text-[28px] leading-[1.12] lg:text-[34px]">{title}</h1>
      <p className="mt-2 max-w-[640px] text-[15px] leading-relaxed text-ink-soft">
        <span className="hidden lg:inline">You answered; they haven’t yet. </span>Nothing to do here. Each one comes back to Needs you the
        moment the customer writes.
      </p>
      <p className="mt-4 hidden text-sm text-ink-soft tabular-nums lg:block">
        <Link href="/dashboard" className="hover:underline underline-offset-4">
          Needs you <span className="font-semibold text-ink">{approvals.length}</span>
        </Link>
        <span aria-hidden="true" className="text-ink-faint"> · </span>
        <span className="text-ink underline underline-offset-4">
          Waiting on customers <span className="font-semibold">{items.length}</span>
        </span>
        <span aria-hidden="true" className="text-ink-faint"> · </span>
        Handled today <span className="font-semibold text-ink">{handled}</span>
      </p>
      {items.length === 0 ? (
        <p className="mt-5 text-[15px] text-ink-soft">Nobody right now. Everyone you answered has written back, or is closed.</p>
      ) : (
        <WaitingList items={items} now={now} timeZone={timeZone} />
      )}
    </div>
  );
}
