import Link from "next/link";
import ScrollTitle from "@/components/app/ScrollTitle";
import TeamPerformanceSection from "@/components/TeamPerformanceSection";
import { ChevronRight } from "lucide-react";
import { GROUP } from "@/components/app/IosList";
import { getAnalytics } from "@/lib/analytics-data";
import { getLeads } from "@/lib/leads-data";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/demo-data";
import { formatSpan } from "@/lib/activation";
import { medianReplyMs } from "@/lib/waitingOn";
import { getRescueReport } from "@/lib/rescued";
import { countCustomersAnswered, customersAnsweredByDay } from "@/lib/weeklyDigest";
import { sentAsWritten } from "@/lib/showTheWork";
import { startOfLocalDay } from "@/lib/calmToday";

export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;
const WEEKS = 8;

/**
 * Results (A-220, the phone redesign, build 5; laid out like a Mac app, A-285): one number for the week,
 * customers answered, beside last week; then Booked, First reply and Won;
 * then a way to see everything FollowUp did. Below, as before (A-066): eight
 * weeks of customers answered on the desk, and everything else as a quiet
 * list. Customers, never messages. Only our own records; nothing estimated.
 */
export default async function NumbersPage() {
  const ctx = await getSessionContext();
  if (!ctx) return null;
  const now = new Date();
  const business = await prisma.business.findUnique({ where: { id: ctx.businessId }, select: { timezone: true } });
  const timeZone = business?.timezone ?? "America/New_York";
  // This week is the last seven days on the owner's calendar, today included (A-226): each dot sits under the
  // day it happened, and the date line names the days the number covers.
  const weekStart = startOfLocalDay(new Date(now.getTime() - 6 * DAY), timeZone);

  const [data, leads, report, written, booked, won] = await Promise.all([
    getAnalytics(),
    getLeads(),
    getRescueReport(ctx.businessId, 7, now),
    sentAsWritten(ctx.businessId, weekStart),
    // Booked: every call or visit booked through FollowUp this week, not only the ones that came back.
    prisma.booking.count({ where: { businessId: ctx.businessId, status: "confirmed", createdAt: { gte: weekStart, lt: now } } }),
    // Won: the customers you marked won this week (the stage route stamps Deal.wonAt).
    prisma.deal.findMany({ where: { wonAt: { gte: weekStart, lt: now }, lead: { businessId: ctx.businessId } }, select: { leadId: true }, distinct: ["leadId"] }),
  ]);
  if (!data) return null;

  // Eight weeks of customers answered, oldest first; the last is this week so far.
  const weeks = await Promise.all(
    Array.from({ length: WEEKS }, (_, i) => {
      const start = new Date(weekStart.getTime() - (WEEKS - 1 - i) * 7 * DAY);
      const end = i === WEEKS - 1 ? now : new Date(start.getTime() + 7 * DAY);
      return countCustomersAnswered(ctx.businessId, start, end).then((n) => ({ start, n }));
    })
  );
  const [byDay, answeredLast] = await Promise.all([
    // This week's customers, each on the day of their first answer (A-226): the dots under the number.
    customersAnsweredByDay(ctx.businessId, weekStart, now, timeZone),
    // Last week up to this same moment, so a Monday morning isn't measured against a whole week.
    countCustomersAnswered(ctx.businessId, new Date(weekStart.getTime() - 7 * DAY), new Date(now.getTime() - 7 * DAY)),
  ]);
  const answered = weeks[WEEKS - 1].n;

  const heardBack = medianReplyMs(leads, weekStart, now);
  const diff = answered - answeredLast;

  const fmtDay = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone });
  // The three under the number (A-220): what it is in your words, and one line that explains it.
  const three = [
    { label: "Booked", value: String(booked), note: "Calls and visits booked through FollowUp" },
    { label: "First reply", value: heardBack != null ? formatSpan(heardBack) : "—", note: heardBack != null ? "Half of your customers heard back faster" : "Nobody has written in yet" },
    { label: "Won", value: String(won.length), note: "Customers you marked won this week" },
  ];
  const max = Math.max(1, ...weeks.map((w) => w.n));
  const rest: [string, string][] = [
    ["Customers", String(data.totalLeads)],
    ["Came back after a follow-up this week", String(report.rescued)],
    ["On a follow-up plan", String(data.sequenceHealth.enrolledCount)],
    ["Sent as written this week", written.total > 0 ? `${written.asWritten} of ${written.total}` : "—"],
    ["Plans finished (30 days)", String(data.sequenceHealth.completedLast30Days)],
    ["Won, all time", data.wonCount > 0 ? `${data.wonCount} · ${formatCurrency(data.totalRevenue)}` : "0"],
    ["Replied after a follow-up", data.followUpsSentTotal > 0 ? `${data.repliedCount} of ${data.followUpsSentTotal}` : "—"],
  ];

  return (
    <div className="lg:max-w-[1120px]">
      {/* Results is a place in the menu now (A-209), not a page under Settings: no way "back" to show. */}
      <ScrollTitle title="Results" />
      <h1 className="title-serif ios-title1">Results</h1>
      {/* Laid out like a Mac app (A-285; founder: "I dont feel mac desing in this", then "keep building"): small grey
          headings over white grouped panels, hairlines inside, charcoal only. The week on the left with the eight
          weeks under it; everything else on the right. On the phone it is one column, the eight weeks left out (R-015). */}
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start lg:gap-x-6">
        <div className="flex min-w-0 flex-col gap-6">
          <section>
            <h2 className={HEAD}>Customers answered</h2>
            <div className={GROUP + " mt-1.5 px-[18px] pb-4 pt-3.5"}>
              <div className="text-[13px] text-ink-faint">
                This week · {fmtDay(weekStart)} to {fmtDay(now)}
              </div>
              <p className="mt-0.5 flex items-baseline gap-2">
                <span className="text-[34px] font-semibold leading-tight tracking-[-0.02em] tabular-nums">{answered}</span>
                <span className="text-[15px] font-medium text-ink-soft">{answered === 1 ? "customer" : "customers"}</span>
              </p>
              <p className={"text-[13px] " + (diff > 0 ? "font-medium text-ink" : "text-ink-faint")}>
                {diff > 0 ? `${diff} more than last week` : diff < 0 ? `${-diff} fewer than last week` : answered > 0 ? "The same as last week" : "Nobody to answer yet this week"}
              </p>
              {answered > 0 && <WeekBars days={byDay} />}
            </div>
          </section>

          {data.totalLeads === 0 && (
            <p className="-mt-2 px-4 text-[15px] text-ink-soft">
              No customers yet. Connect where customers write to you in{" "}
              <Link href="/settings" className="underline underline-offset-[3px]">
                Settings
              </Link>
              : your inbox, website form, DMs or CRM. Your numbers fill in from there.
            </p>
          )}

          {/* Booked, First reply, Won: rows on the phone, three columns on the desk. */}
          <div className={GROUP + " lg:grid lg:grid-cols-3"}>
            {three.map((t, i) => (
              <div
                key={t.label}
                className={
                  "flex items-center justify-between gap-4 px-[18px] py-3 lg:flex-col lg:items-start lg:justify-start lg:gap-0 lg:py-3.5 " +
                  (i ? "border-t border-line-2 lg:border-l lg:border-t-0" : "")
                }
              >
                <div className="min-w-0">
                  <div className="text-[15px] lg:text-[13px] lg:text-ink-faint">{t.label}</div>
                  <div className="mt-0.5 text-[13px] text-ink-faint lg:hidden">{t.note}</div>
                </div>
                <div className="shrink-0 text-[22px] font-semibold leading-tight tracking-[-0.02em] tabular-nums lg:mt-0.5 lg:text-[24px]">{t.value}</div>
                <div className="mt-0.5 hidden text-[12px] text-ink-faint lg:block">{t.note}</div>
              </div>
            ))}
          </div>

          {/* Eight weeks, as bars. Hidden on the phone (R-015). */}
          <section className="hidden lg:block">
            <h2 className={HEAD}>By week</h2>
            <figure className={GROUP + " mt-1.5 px-[18px] pb-3 pt-4"}>
              <div
                role="img"
                aria-label={`Customers answered each week for eight weeks: ${weeks.map((w) => `${fmtDay(w.start)} ${w.n}`).join(", ")}.`}
                className="grid grid-cols-8 gap-2.5"
              >
                {weeks.map((w, i) => {
                  const current = i === WEEKS - 1;
                  return (
                    <div key={i} className="flex min-w-0 flex-col items-center gap-1.5">
                      <div className="flex h-[124px] w-full flex-col items-center justify-end gap-1">
                        {w.n > 0 && <span className={"text-[12px] tabular-nums " + (current ? "font-semibold text-ink" : "text-ink-faint")}>{w.n}</span>}
                        <span
                          className="block w-full max-w-[28px] rounded-[4px]"
                          style={{
                            height: w.n > 0 ? `${Math.max(4, Math.round((w.n / max) * 96))}px` : "3px",
                            background: w.n === 0 ? "var(--line)" : current ? "var(--ink)" : "var(--ink-faint)",
                          }}
                        />
                      </div>
                      <span className="whitespace-nowrap text-[12px] text-ink-faint">{fmtDay(w.start)}</span>
                    </div>
                  );
                })}
              </div>
            </figure>
          </section>
        </div>

        {/* An iOS grouped list (A-273): the label on the left, the value in grey on the right. */}
        <section className="min-w-0">
          <h2 className={HEAD}>Everything else</h2>
          <dl className={GROUP + " mt-1.5"}>
            {rest.map(([k, v], i) => (
              <div key={k} className="flex items-center pl-4">
                <div className={"flex min-h-[44px] flex-1 items-center justify-between gap-3 pr-4 lg:min-h-[38px]" + (i ? " border-t border-line-2" : "")}>
                  <dt className="ios-subhead text-ink lg:text-[14px]">{k}</dt>
                  <dd className="ios-subhead tabular-nums text-ink-faint lg:text-[14px]">{v}</dd>
                </div>
              </div>
            ))}
          </dl>
          <Link href="/activity" className="ml-4 mt-1 inline-flex min-h-11 items-center gap-1 text-[14px] text-ink-soft hover:text-ink">
            See everything FollowUp did
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      </div>

      {data.teamBreakdown.length > 1 && (
        <section className="mt-10">
          <h2 className="text-[15px]">Your team</h2>
          <p className="mt-1 text-sm text-ink-soft">Who&apos;s carrying what, and how much of it has gone quiet.</p>
          <div className="mt-4">
            <TeamPerformanceSection members={data.teamBreakdown} />
          </div>
        </section>
      )}
    </div>
  );
}

/** The small grey heading over each group, as Mac and iPhone settings put it (A-285). */
const HEAD = "px-4 text-[12px] font-semibold uppercase tracking-[0.03em] text-ink-faint";

/** One bar per day for this week's customers answered (A-285 replaces A-226's dots), today last. */
function WeekBars({ days }: { days: { day: string; n: number }[] }) {
  const most = Math.max(1, ...days.map((d) => d.n));
  return (
    <div
      role="img"
      aria-label={`Customers answered each day: ${days.map((d) => `${d.day} ${d.n}`).join(", ")}.`}
      className="mt-3.5 grid max-w-[360px] grid-cols-7 gap-x-2"
    >
      {days.map((d, i) => (
        <div key={i} className="flex h-[76px] flex-col items-center justify-end gap-1">
          {d.n > 0 && <span className="text-[12px] leading-none text-ink-faint tabular-nums">{d.n}</span>}
          <span
            className="block w-full max-w-[26px] rounded-[4px]"
            style={{ height: d.n > 0 ? `${Math.max(4, Math.round((d.n / most) * 56))}px` : "3px", background: d.n > 0 ? "var(--ink)" : "var(--line)" }}
          />
        </div>
      ))}
      {days.map((d, i) => (
        <span key={`l${i}`} className="mt-1.5 text-center text-[12px] text-ink-faint">
          {d.day}
        </span>
      ))}
    </div>
  );
}

// Each view names itself in the browser tab (WCAG 2.4.2); the root template adds " — FollowUp".
export const metadata = { title: "Results" };
