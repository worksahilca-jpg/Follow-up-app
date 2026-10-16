import Link from "next/link";
import ScrollTitle from "@/components/app/ScrollTitle";
import { Initials } from "@/components/app/canvasBits";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getActivityFeed, type ActivityItem } from "@/lib/activity";
import { activityLine, namesLine } from "@/lib/activityWords";

export const dynamic = "force-dynamic";

/**
 * Activity (A-256, simpler in A-270): a calm record of what FollowUp did on its own, newest first, by day. Nothing on
 * it needs the owner: replies waiting for their OK and problems to fix are on Today (research, 2026-10-16: every
 * product studied keeps "needs you" apart from history; repeats are what make people stop looking, R-116). Several
 * replies sent on one day fold into one line that opens to the list.
 */
const DAY = 24 * 60 * 60 * 1000;

type Row = { kind: "one"; item: ActivityItem } | { kind: "sends"; items: ActivityItem[] };

export default async function ActivityPage() {
  const ctx = await getSessionContext();
  if (!ctx) return null;

  const [items, business] = await Promise.all([
    getActivityFeed(ctx.businessId, ctx.userId),
    prisma.business.findUnique({ where: { id: ctx.businessId }, select: { timezone: true } }),
  ]);
  const timeZone = business?.timezone ?? "America/New_York";
  const now = new Date();

  const week = items.filter((i) => now.getTime() - Date.parse(i.occurredAt) < 7 * DAY);
  const answered = new Set(week.filter((i) => i.type === "automated_send").map((i) => i.leadId ?? i.id)).size;
  const stopped = week.filter((i) => i.type === "sequence_paused").length;
  const weekParts = [
    answered > 0 ? `answered ${answered} ${answered === 1 ? "person" : "people"}` : null,
    stopped > 0 ? `stopped ${stopped} check-in${stopped === 1 ? "" : "s"} because someone wrote back` : null,
  ].filter(Boolean);

  // Days in the business's own time zone.
  const dayOf = (d: Date) => d.toLocaleDateString("en-CA", { timeZone });
  const today = dayOf(now);
  const yesterday = dayOf(new Date(now.getTime() - DAY));
  const dayLabel = (iso: string) => {
    const k = dayOf(new Date(iso));
    if (k === today) return "Today";
    if (k === yesterday) return "Yesterday";
    return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone });
  };
  const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });

  // By day; a day's replies sent on its own fold into one row where the first of them was.
  const groups: { day: string; rows: Row[] }[] = [];
  for (const item of items) {
    const day = dayLabel(item.occurredAt);
    let g = groups[groups.length - 1];
    if (!g || g.day !== day) {
      g = { day, rows: [] };
      groups.push(g);
    }
    if (item.type === "automated_send") {
      const sends = g.rows.find((r): r is Extract<Row, { kind: "sends" }> => r.kind === "sends");
      if (sends) sends.items.push(item);
      else g.rows.push({ kind: "sends", items: [item] });
    } else g.rows.push({ kind: "one", item });
  }

  const person = (item: ActivityItem, first: boolean, quote: boolean) => {
    const body = (
      <>
        {item.leadName && <Initials name={item.leadName} size={40} />}
        <span className="min-w-0 flex-1">
          {item.leadName ? (
            <>
              <span className="flex justify-between gap-2.5">
                <span className="text-[15.5px] font-semibold">{item.leadName}</span>
                <span className="whitespace-nowrap text-[13px] tabular-nums text-ink-faint">{timeOf(item.occurredAt)}</span>
              </span>
              <span className="mt-px block text-[14px] leading-snug text-ink-soft">{activityLine(item)}</span>
            </>
          ) : (
            // About the account, not a customer (an inbox lost): the sentence is the row.
            <span className="flex justify-between gap-2.5">
              <span className="text-[15px] leading-snug">{activityLine(item)}</span>
              <span className="whitespace-nowrap text-[13px] tabular-nums text-ink-faint">{timeOf(item.occurredAt)}</span>
            </span>
          )}
          {quote && item.detail && (
            <span className="mt-0.5 line-clamp-2 block text-[14px] leading-snug text-ink-soft">“{item.detail.replace(/\s+/g, " ").trim()}”</span>
          )}
        </span>
      </>
    );
    const cls = "flex gap-3 py-3 " + (first ? "" : "border-t border-line");
    const href = item.leadId ? `/leads/${item.leadId}` : /\breconnect\b/i.test(item.message) ? "/settings#connections" : null;
    return href ? (
      <Link key={item.id} href={href} data-nav="push" className={cls}>
        {body}
      </Link>
    ) : (
      <div key={item.id} className={cls}>
        {body}
      </div>
    );
  };

  return (
    <div className="lg:max-w-[720px]">
      <ScrollTitle title="Activity" />
      <h1 className="title-serif text-[30px] leading-[1.12] lg:text-[34px]">Activity</h1>
      <p className="mt-2 text-[15.5px] leading-relaxed text-ink-soft">
        What FollowUp did on its own.{weekParts.length > 0 && ` This week it ${weekParts.join(" and ")}.`}
      </p>
      <p className="mt-1.5 text-[14px] text-ink-faint">
        Replies waiting for your OK are on{" "}
        <Link href="/dashboard" className="text-ink underline underline-offset-[3px]">
          Today
        </Link>
        .
      </p>

      {items.length === 0 ? (
        <p className="mt-6 text-[15px] text-ink-soft">Quiet so far. When FollowUp answers someone or stops a check-in on its own, it shows here.</p>
      ) : (
        <>
          {groups.map((g) => (
            <section key={g.day} className="mt-5">
              <h2 className="text-[14px] font-semibold">{g.day}</h2>
              {g.rows.map((r, i) => {
                if (r.kind === "one" || r.items.length === 1) return person(r.kind === "one" ? r.item : r.items[0], i === 0, r.kind !== "one" || r.item.type === "automated_send");
                // Several replies on one day: one line that opens to them.
                return (
                  <details key={r.items[0].id} className={"group " + (i === 0 ? "" : "border-t border-line")}>
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 [&::-webkit-details-marker]:hidden">
                      <span className="min-w-0">
                        <span className="block text-[15.5px] font-semibold">FollowUp sent {r.items.length} replies on its own</span>
                        <span className="mt-px block text-[14px] text-ink-soft">
                          To {namesLine([...new Map(r.items.map((x) => [x.leadId ?? x.id, x.leadName ?? "someone"])).values()])}
                        </span>
                      </span>
                      <span aria-hidden="true" className="text-[13px] text-ink-faint group-open:hidden">Show</span>
                      <span aria-hidden="true" className="hidden text-[13px] text-ink-faint group-open:inline">Hide</span>
                    </summary>
                    <div className="pb-1">{r.items.map((x, j) => person(x, j === 0, true))}</div>
                  </details>
                );
              })}
            </section>
          ))}
          {/* Never imply completeness the page doesn't have: the feed keeps the most recent events only. */}
          <p className="mt-6 text-[13px] text-ink-faint">Showing the last {items.length} things FollowUp did. Each customer&apos;s page has the rest.</p>
        </>
      )}
    </div>
  );
}
