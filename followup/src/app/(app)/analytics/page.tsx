import Link from "next/link";
import TeamPerformanceSection from "@/components/TeamPerformanceSection";
import { Eyebrow } from "@/components/app/canvasBits";
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
 * Results (A-220, the phone redesign, build 5): one number for the week,
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
    { label: "Won", value: String(won.length), note: "Customers you marked won" },
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
    <div>
      {/* Results is a place in the menu now (A-209), not a page under Settings: no way "back" to show. */}
      {/* Your week (A-226): the one number on the green wash, beside last week, and a dot for each customer on the
          day they first got an answer. */}
      <section className="rounded-[22px] border border-[var(--wash-edge)] bg-[var(--wash)] px-[18px] py-5 lg:px-8 lg:py-7">
        <Eyebrow green>
          This week · {fmtDay(weekStart)} to {fmtDay(now)}
        </Eyebrow>
        <h1 className="title-serif mt-1.5 flex items-baseline gap-2.5">
          <span className="text-[44px] leading-none tabular-nums lg:text-[56px]">{answered}</span>
          <span className="text-[22px] leading-tight lg:text-[28px]">
            {answered === 1 ? "customer" : "customers"} <em>answered</em>
          </span>
        </h1>
        <p className={"mt-1.5 text-[14px] " + (diff > 0 ? "font-medium text-sage" : "text-ink-faint")}>
          {diff > 0 ? `${diff} more than last week` : diff < 0 ? `${-diff} fewer than last week` : answered > 0 ? "The same as last week" : "Nobody to answer yet this week"}
        </p>
        {answered > 0 && <WeekDots days={byDay} />}
      </section>

      {data.totalLeads === 0 && (
        <p className="mt-6 text-[15px] text-ink-soft">
          No customers yet. Connect where customers write to you in{" "}
          <Link href="/settings" className="underline underline-offset-[3px]">
            Settings
          </Link>
          : your inbox, website form, DMs or CRM. Your numbers fill in from there.
        </p>
      )}

      {/* Booked, First reply, Won: rows on the phone, three columns on the desk. */}
      <div className="mt-5 overflow-hidden rounded-[18px] border border-line bg-card lg:grid lg:grid-cols-3">
        {three.map((t, i) => (
          <div
            key={t.label}
            className={
              "flex items-center justify-between gap-4 px-[18px] py-3.5 lg:flex-col lg:items-start lg:justify-start lg:px-6 lg:py-5 " +
              (i ? "border-t border-line-2 lg:border-l lg:border-t-0" : "")
            }
          >
            <div className="min-w-0">
              <div className="text-[15.5px] font-medium lg:text-sm lg:font-normal lg:text-ink-soft">{t.label}</div>
              <div className="mt-0.5 text-[13px] text-ink-faint lg:hidden">{t.note}</div>
            </div>
            <div className="shrink-0 text-[26px] font-light leading-none tracking-[-0.03em] tabular-nums lg:mt-1.5 lg:text-[44px]">{t.value}</div>
            <div className="mt-2 hidden text-[13px] text-ink-faint lg:block">{t.note}</div>
          </div>
        ))}
      </div>
      <Link href="/activity" className="mt-3.5 inline-flex min-h-11 items-center text-[14px] text-ink-soft underline underline-offset-[3px] hover:text-ink">
        See everything FollowUp did
      </Link>

      <div className="mt-5 grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start">
        {/* Eight weeks, as bars. Hidden on the phone (R-015). */}
        <section className="hidden lg:block">
          <h2 className="text-[15px]">Customers answered, by week</h2>
          <figure className="mt-3.5 rounded-[18px] border border-line bg-card px-5 pb-3.5 pt-4">
            <div
              role="img"
              aria-label={`Customers answered each week for eight weeks: ${weeks.map((w) => `${fmtDay(w.start)} ${w.n}`).join(", ")}.`}
              className="grid grid-cols-8 gap-2"
            >
              {weeks.map((w, i) => {
                const current = i === WEEKS - 1;
                return (
                  <div key={i} className="flex min-w-0 flex-col items-center gap-2">
                    <div className="flex h-[150px] w-full flex-col items-center justify-end gap-1.5">
                      <span className={"text-[12.5px] tabular-nums " + (current ? "font-semibold text-ink" : "text-ink-faint")}>{w.n}</span>
                      <span
                        className="block w-9 rounded-t-[6px] rounded-b-[2px]"
                        style={{
                          height: `${Math.round((w.n / max) * 120)}px`,
                          minHeight: w.n > 0 ? 3 : 0,
                          background: current ? "var(--ink)" : "var(--line)",
                        }}
                      />
                    </div>
                    <span className="whitespace-nowrap text-xs text-ink-faint">{fmtDay(w.start)}</span>
                  </div>
                );
              })}
            </div>
          </figure>
        </section>

        <section>
          <h2 className="text-[15px]">Everything else</h2>
          <dl className="mt-1.5">
            {rest.map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-line-2 py-[11px] text-sm">
                <dt className="text-ink-soft">{k}</dt>
                <dd className="tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
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

/** Up to this many dots in a day; a busier day shows its number above them. */
const MAX_DOTS = 6;

/** One dot per customer answered, on the day they first heard back (A-226). One column per day, today last. */
function WeekDots({ days }: { days: { day: string; n: number }[] }) {
  return (
    <div
      role="img"
      aria-label={`Customers answered each day: ${days.map((d) => `${d.day} ${d.n}`).join(", ")}.`}
      className="mt-4 grid max-w-[300px] grid-cols-7 items-end gap-x-1.5 gap-y-1.5 lg:mt-5 lg:max-w-[360px]"
    >
      {/* The dots stand on one line, as tall as the busiest day; the letters sit in a row under them. */}
      {days.map((d, i) => (
        <div key={i} className="flex flex-col-reverse items-center gap-0.5">
          {Array.from({ length: Math.min(d.n, MAX_DOTS) }, (_, k) => (
            <span key={k} className="h-[7px] w-[7px] rounded-full bg-[var(--green-ink)]" />
          ))}
          {d.n > MAX_DOTS && <span className="text-xs font-medium leading-none text-[var(--green-ink)] tabular-nums">{d.n}</span>}
        </div>
      ))}
      {days.map((d, i) => (
        <span key={`l${i}`} className="text-center text-xs text-ink-faint">
          {d.day}
        </span>
      ))}
    </div>
  );
}
