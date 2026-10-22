import Link from "next/link";
import { ChevronRight } from "lucide-react";
import ScrollTitle from "@/components/app/ScrollTitle";
import { Initials } from "@/components/app/canvasBits";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { callsWeek, type WhichWeek } from "@/lib/callsWeek";
import { loadCallsWeek } from "@/lib/callsWeekData";

export const dynamic = "force-dynamic";

const LINK = "relative text-[14.5px] text-ink underline underline-offset-[3px] before:absolute before:-inset-x-2 before:-inset-y-3.5 before:content-['']";

/**
 * Calls this week (A-317): FollowUp's own calendar as one page, opened from Today's "Calls this week" row. The calls
 * booked through the owner's link by day, time on the left (as Activity, A-307), who, and what the call is about;
 * the whole row opens the customer. One sentence names the days with nothing. "Next week" is the seven days after.
 */
export default async function CallsPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week: weekParam } = await searchParams;
  const week: WhichWeek = weekParam === "next" ? "next" : "this";
  const ctx = await getSessionContext();
  const business = ctx ? await prisma.business.findUnique({ where: { id: ctx.businessId }, select: { timezone: true } }) : null;
  const timeZone = business?.timezone ?? "America/New_York";
  const now = new Date();
  const data = callsWeek(ctx ? await loadCallsWeek(ctx.businessId, now, timeZone, week) : [], now, timeZone, week);
  const title = week === "this" ? "Calls this week" : "Calls next week";

  return (
    <div className="lg:max-w-[720px]">
      <Link href={week === "this" ? "/dashboard" : "/calls"} className="-my-3 inline-flex min-h-11 items-center text-[13px] text-ink-faint hover:text-ink">
        {week === "this" ? "← Today" : "← This week"}
      </Link>
      <ScrollTitle title={title} />
      <h1 className="title-serif ios-title1 mt-3">{title}</h1>
      <p className="mt-2 text-[15.5px] leading-relaxed text-ink-soft">{data.sentence}</p>

      {data.days.map((d) => (
        <section key={d.offset} className="mt-6">
          <h2 className="group-label mb-2 px-1">{d.label}</h2>
          <div className="list-group">
            {d.calls.map((c) => (
              <Link key={c.bookingId} href={`/leads/${c.leadId}`} data-nav="push" className="flex min-h-[64px] items-center gap-3 px-4 py-3 hover:bg-card-2">
                <span className="w-[66px] shrink-0 whitespace-nowrap text-[13.5px] tabular-nums text-ink-soft">{c.time}</span>
                <Initials name={c.name} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15.5px] font-semibold">{c.name}</span>
                  <span className="mt-px block text-[14px] leading-snug text-ink-soft">{c.about}</span>
                </span>
                <ChevronRight aria-hidden className="h-[15px] w-[15px] shrink-0 text-ink-faint opacity-70" strokeWidth={2.5} />
              </Link>
            ))}
          </div>
        </section>
      ))}

      <div className="mt-6 flex items-center justify-between gap-4 px-1">
        <Link href={week === "this" ? "/calls?week=next" : "/calls"} className={LINK}>
          {week === "this" ? "Next week" : "This week"}
        </Link>
        <Link href="/settings#booking" className={LINK}>
          Your free hours
        </Link>
      </div>
    </div>
  );
}

// Each view names itself in the browser tab (WCAG 2.4.2); the root template adds " — FollowUp".
export const metadata = { title: "Calls this week" };
