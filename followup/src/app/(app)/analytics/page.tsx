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
import { countCustomersAnswered } from "@/lib/weeklyDigest";
import { sentAsWritten } from "@/lib/showTheWork";

export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;
const WEEKS = 8;

/**
 * Numbers, as drawn on the canvas (A-066). It reads like the Monday email
 * (A-038): the week's reply speed in one sentence (A-050), then answered,
 * came back and booked beside last week, then eight weeks of customers
 * answered, then everything else as a quiet list. Customers, never
 * messages. Only our own records; nothing estimated.
 *
 * Out of the menu since A-027; reached from Settings › Everything else.
 */
export default async function NumbersPage() {
  const ctx = await getSessionContext();
  if (!ctx) return null;
  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * DAY);
  const lastWeekStart = new Date(now.getTime() - 14 * DAY);

  const [data, leads, business, report, lastReport, written] = await Promise.all([
    getAnalytics(),
    getLeads(),
    prisma.business.findUnique({ where: { id: ctx.businessId }, select: { timezone: true } }),
    getRescueReport(ctx.businessId, 7, now),
    getRescueReport(ctx.businessId, 7, weekStart),
    sentAsWritten(ctx.businessId, weekStart),
  ]);
  if (!data) return null;
  const timeZone = business?.timezone ?? "America/New_York";

  // Eight weeks of customers answered, oldest first; the last is this week.
  const weeks = await Promise.all(
    Array.from({ length: WEEKS }, (_, i) => {
      const end = new Date(now.getTime() - (WEEKS - 1 - i) * 7 * DAY);
      const start = new Date(end.getTime() - 7 * DAY);
      return countCustomersAnswered(ctx.businessId, start, end).then((n) => ({ start, n }));
    })
  );
  const answered = weeks[WEEKS - 1].n;
  const answeredLast = weeks[WEEKS - 2].n;

  const heardBack = medianReplyMs(leads, weekStart, now);
  const heardBackLast = medianReplyMs(leads, lastWeekStart, weekStart);

  const fmtDay = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone });
  const three = [
    { label: "Answered", value: answered, last: answeredLast },
    { label: "Came back", value: report.rescued, last: lastReport.rescued },
    { label: "Booked", value: report.booked, last: lastReport.booked },
  ];
  const max = Math.max(1, ...weeks.map((w) => w.n));
  const rest: [string, string][] = [
    ["Customers", String(data.totalLeads)],
    ["On a follow-up plan", String(data.sequenceHealth.enrolledCount)],
    ["Sent as written this week", written.total > 0 ? `${written.asWritten} of ${written.total}` : "—"],
    ["Plans finished (30 days)", String(data.sequenceHealth.completedLast30Days)],
    ["Won", data.wonCount > 0 ? `${data.wonCount} · ${formatCurrency(data.totalRevenue)}` : "0"],
    ["Replied after a follow-up", data.followUpsSentTotal > 0 ? `${data.repliedCount} of ${data.followUpsSentTotal}` : "—"],
  ];

  return (
    <div>
      {/* Results is a place in the menu now (A-209), not a page under Settings: no way "back" to show. */}
      <div>
        <Eyebrow>
          This week · {fmtDay(weekStart)} to {fmtDay(now)}
        </Eyebrow>
      </div>
      <h1 className="title-serif mt-2 text-[28px] leading-[1.12] lg:text-[34px]">
        {heardBack != null ? `Customers heard back in ${formatSpan(heardBack)}.` : "Nobody wrote in this week yet."}
      </h1>
      <p className="mt-2 max-w-[640px] text-[15px] leading-relaxed text-ink-soft">
        {heardBack != null ? (
          <>
            <span className="hidden lg:inline">
              The middle time from a customer writing to their first reply, from your own records.{" "}
            </span>
            {heardBackLast != null ? `Last week it was ${formatSpan(heardBackLast)}.` : "Nothing to compare with last week."}
          </>
        ) : (
          "Once someone writes and gets an answer, how fast they heard back shows here."
        )}
      </p>

      {data.totalLeads === 0 && (
        <p className="mt-6 text-[15px] text-ink-soft">
          No customers yet. Connect where customers write to you in{" "}
          <Link href="/settings" className="underline underline-offset-[3px]">
            Settings
          </Link>
          : your inbox, website form, DMs or CRM. Your numbers fill in from there.
        </p>
      )}

      {/* The week's three numbers, beside last week (A-038). */}
      <div className="mt-6 overflow-hidden rounded-[18px] border border-line bg-card lg:grid lg:grid-cols-3">
        {three.map((t, i) => (
          <div
            key={t.label}
            className={
              "flex items-center justify-between px-[18px] py-4 lg:flex-col lg:items-start lg:justify-start lg:px-6 lg:py-5 " +
              (i ? "border-t border-line-2 lg:border-l lg:border-t-0" : "")
            }
          >
            <div>
              <div className="text-base lg:text-sm lg:text-ink-soft">{t.label}</div>
              <div className="mt-0.5 text-[13px] text-ink-faint lg:hidden">Last week: {t.last}</div>
            </div>
            <div className="text-[34px] font-light leading-none tracking-[-0.03em] tabular-nums lg:mt-1.5 lg:text-[44px]">
              {t.value}
            </div>
            <div className="mt-2 hidden text-[13px] text-ink-faint lg:block">Last week: {t.last}</div>
          </div>
        ))}
      </div>

      <div className="mt-7 grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start">
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
