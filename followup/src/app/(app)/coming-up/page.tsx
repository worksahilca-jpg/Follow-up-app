import { PageHeader } from "@/components/PageHeader";
import { ComingUpList } from "@/components/ComingUp";
import { getLeads } from "@/lib/leads-data";
import { getSessionContext } from "@/lib/session";
import { getPendingApprovals } from "@/lib/pendingApprovals";
import { loadComingUp } from "@/lib/comingUpData";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** "Coming up" on its own page: where the phone's one line on Today leads (A-046). */
export default async function ComingUpPage() {
  const ctx = await getSessionContext();
  const leads = await getLeads();
  const [approvals, business] = ctx
    ? await Promise.all([
        getPendingApprovals(ctx.businessId),
        prisma.business.findUnique({ where: { id: ctx.businessId }, select: { timezone: true } }),
      ])
    : [[], null];
  const data = ctx
    ? await loadComingUp(ctx.businessId, leads, new Set(approvals.map((a) => a.leadId)), business?.timezone ?? "America/New_York")
    : null;
  return (
    <div>
      <PageHeader back={{ href: "/dashboard", label: "Today" }} title="Coming up" />
      {data && data.total > 0 ? (
        <ComingUpList groups={data.groups} holdAll={data.holdAll} />
      ) : (
        <p className="mt-2 text-sm text-ink-soft">Nothing planned for the next seven days.</p>
      )}
    </div>
  );
}
