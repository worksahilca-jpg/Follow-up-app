import Link from "next/link";
import { getLeads } from "@/lib/leads-data";
import { getSessionContext } from "@/lib/session";
import { getPendingApprovals } from "@/lib/pendingApprovals";
import { loadComingUp } from "@/lib/comingUpData";
import { prisma } from "@/lib/db";
import { Initials } from "@/components/app/canvasBits";

export const dynamic = "force-dynamic";

/**
 * Coming up, on its own page (A-046; desktop as drawn in A-066): who
 * FollowUp writes to next, grouped by day, each with what it will send and
 * the condition it depends on ("unless Priya writes first").
 *
 * Days only, never a clock time, and no per-row "sends on its own": the
 * engine runs hourly within working hours, and whether a message is held
 * is decided when it's written. The one sentence under the title says
 * what waits for the owner.
 */
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
  const groups = data && data.total > 0 ? data.groups : [];

  return (
    <div>
      <Link href="/dashboard" className="text-[13px] text-ink-faint hover:text-ink">
        ← Today
      </Link>
      <h1 className="mt-2 text-[30px] leading-[1.12] lg:text-[34px]">Coming up</h1>
      <p className="mt-2 max-w-[640px] text-[15px] leading-relaxed text-ink-soft">
        {groups.length === 0
          ? "Nothing planned for the next seven days."
          : data?.holdAll
            ? "Who FollowUp writes to next. Each one waits for your OK."
            : "Who FollowUp writes to next. Anything that names a price or a date still waits for your OK."}
      </p>

      {groups.length > 0 && (
        <>
          {/* Desktop: one card, days as headings inside it. */}
          <div className="mt-6 hidden overflow-hidden rounded-[18px] border border-line bg-card lg:block">
            {groups.map((g, gi) => (
              <section key={g.day}>
                <h2 className={"px-5 pb-2 pt-3.5 text-[13px] font-medium text-ink-soft " + (gi ? "border-t border-line-2" : "")}>{g.day}</h2>
                {g.items.map((it) => {
                  const first = it.name.split(" ")[0] || it.name;
                  return (
                    <Link
                      key={it.leadId}
                      href={`/leads/${it.leadId}`}
                      className="grid grid-cols-[44px_200px_minmax(0,1fr)_88px] items-center gap-4 border-t border-line-2 px-5 py-3 hover:bg-paper"
                    >
                      <Initials name={it.name} size={32} />
                      <span className="truncate text-[14.5px] font-medium">{it.name}</span>
                      <span className="min-w-0">
                        <span className="block text-sm">{it.what}</span>
                        {it.unless && <span className="mt-0.5 block text-[13px] text-ink-faint">Unless {first} writes first.</span>}
                      </span>
                      <span className="justify-self-end text-[13.5px] text-ink-soft underline underline-offset-[3px]">See them</span>
                    </Link>
                  );
                })}
              </section>
            ))}
          </div>

          {/* Phone, as the ComingUpPhone board. */}
          <div className="lg:hidden">
            {groups.map((g) => (
              <section key={g.day} className="mt-5">
                <h2 className="text-sm font-semibold">{g.day}</h2>
                {g.items.map((it, i) => (
                  <Link
                    key={it.leadId}
                    href={`/leads/${it.leadId}`}
                    className={"flex min-h-[60px] items-center gap-3 " + (i ? "border-t border-line-2" : "")}
                  >
                    <Initials name={it.name} size={36} />
                    <span className="min-w-0">
                      <span className="block text-base font-medium">{it.name}</span>
                      <span className="block text-sm text-ink-faint">
                        {it.what}
                        {it.unless && `, unless ${it.name.split(" ")[0] || it.name} writes first`}
                      </span>
                    </span>
                  </Link>
                ))}
              </section>
            ))}
          </div>

          <p className="mt-4 text-[13.5px] text-ink-faint">The next seven days. A check-in is skipped the moment the customer writes.</p>
        </>
      )}
    </div>
  );
}
