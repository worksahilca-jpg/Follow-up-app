import Link from "next/link";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getActivityFeed, type ActivityItem, type ActivityType } from "@/lib/activity";

export const dynamic = "force-dynamic";

/**
 * What FollowUp did, as drawn on the canvas (A-066): grouped by day, one
 * sentence per action with the customer's name, and the state at the end.
 * Tabs narrow it to what was sent, what stopped itself because someone
 * wrote, and what was held for the owner.
 *
 * Out of the menu since A-027; each person's own page carries the same
 * record for that person ("What FollowUp did").
 */
const WHAT: Record<ActivityType, { verb: string; state: string }> = {
  automated_send: { verb: "Sent on its own", state: "Sent" },
  sequence_paused: { verb: "Stopped the check-ins", state: "Stopped" },
  rapid_engagement: { verb: "Needs you now", state: "Needs you" },
  sequence_completed: { verb: "Finished the plan", state: "Done" },
  held: { verb: "Held a reply for you", state: "Held for you" },
};

type Tab = "all" | "sent" | "stopped" | "held";
const TABS: { id: Tab; label: string; types: ActivityType[] | null }[] = [
  { id: "all", label: "All", types: null },
  { id: "sent", label: "Sent", types: ["automated_send"] },
  { id: "stopped", label: "Stopped", types: ["sequence_paused"] },
  { id: "held", label: "Held for you", types: ["held"] },
];

const DAY = 24 * 60 * 60 * 1000;

function detailFor(item: ActivityItem): string | null {
  if (item.type === "automated_send") return item.detail ? `“${item.detail.replace(/\s+/g, " ").trim()}”` : null;
  if (item.type === "held") return item.detail;
  if (item.type === "sequence_paused") return item.leadName ? `${item.leadName.split(" ")[0]} wrote back.` : "They wrote back.";
  if (item.type === "rapid_engagement") return item.message;
  return null;
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return null;
  const { show } = await searchParams;
  const tab = TABS.find((t) => t.id === show) ?? TABS[0];

  const [items, business] = await Promise.all([
    getActivityFeed(ctx.businessId),
    prisma.business.findUnique({ where: { id: ctx.businessId }, select: { timezone: true } }),
  ]);
  const timeZone = business?.timezone ?? "America/New_York";
  const now = new Date();

  const count = (t: (typeof TABS)[number]) => (t.types ? items.filter((i) => t.types!.includes(i.type)).length : items.length);
  const shown = tab.types ? items.filter((i) => tab.types!.includes(i.type)) : items;

  // "This week: 23 sent on its own · 5 stopped · 6 held for you", only the
  // parts above zero.
  const week = items.filter((i) => now.getTime() - Date.parse(i.occurredAt) < 7 * DAY);
  const weekParts = [
    [week.filter((i) => i.type === "automated_send").length, "sent on its own"],
    [week.filter((i) => i.type === "sequence_paused").length, "stopped"],
    [week.filter((i) => i.type === "held").length, "held for you"],
  ]
    .filter(([n]) => (n as number) > 0)
    .map(([n, w]) => `${n} ${w}`);

  // Days in the business's own time zone.
  const dayOf = (d: Date) => d.toLocaleDateString("en-CA", { timeZone });
  const today = dayOf(now);
  const yesterday = dayOf(new Date(now.getTime() - DAY));
  const dayLabel = (iso: string) => {
    const d = new Date(iso);
    const k = dayOf(d);
    if (k === today) return "Today";
    if (k === yesterday) return "Yesterday";
    return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone });
  };
  const timeOf = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone }).toLowerCase();
  const groups: { day: string; items: ActivityItem[] }[] = [];
  for (const item of shown) {
    const day = dayLabel(item.occurredAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }

  return (
    <div>
      <Link href="/settings" className="text-[13px] text-ink-faint hover:text-ink">
        ← Settings
      </Link>
      <h1 className="title-serif mt-2 text-[30px] leading-[1.12] lg:text-[34px]">What FollowUp did</h1>
      <p className="mt-2 hidden max-w-[640px] text-[15px] leading-relaxed text-ink-soft lg:block">
        Every message it sent, every time it stopped because someone wrote, and every reply it held for you.
        {weekParts.length > 0 && ` This week: ${weekParts.join(" · ")}.`}
      </p>

      <div role="tablist" aria-label="Show" className="mt-5 flex gap-5 overflow-x-auto border-b border-line lg:gap-[22px]">
        {TABS.map((t) => {
          const on = t.id === tab.id;
          return (
            <Link
              key={t.id}
              role="tab"
              aria-selected={on}
              href={t.id === "all" ? "/activity" : `/activity?show=${t.id}`}
              className="-mb-px whitespace-nowrap border-b-2 pb-2.5 text-[14.5px] lg:text-sm"
              style={{ borderColor: on ? "var(--ink)" : "transparent", color: on ? "var(--ink)" : "var(--ink-soft)", fontWeight: on ? 500 : 400 }}
            >
              {t.label} <span className="tabular-nums text-ink-faint">{count(t)}</span>
            </Link>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 text-[15px] text-ink-soft">
          {items.length === 0 ? "Nothing yet. This fills in as FollowUp sends, stops and holds." : "Nothing of this kind yet."}
        </p>
      ) : (
        <>
          {/* Desktop: one card, days as headings inside it. */}
          <div className="mt-4 hidden overflow-hidden rounded-[18px] border border-line bg-card lg:block">
            {groups.map((g, gi) => (
              <section key={g.day}>
                <h2 className={"px-5 pb-2 pt-3.5 text-[13px] font-medium text-ink-soft " + (gi ? "border-t border-line-2" : "")}>{g.day}</h2>
                {g.items.map((item) => {
                  const w = WHAT[item.type];
                  const detail = detailFor(item);
                  return (
                    <div key={item.id} className="grid grid-cols-[76px_minmax(0,1fr)_120px] items-baseline gap-4 border-t border-line-2 px-5 py-[11px]">
                      <span className="text-[13px] tabular-nums text-ink-faint">{timeOf(item.occurredAt)}</span>
                      <span className="min-w-0">
                        <span className="text-[14.5px]">
                          {w.verb}
                          {item.leadName && (
                            <>
                              {" · "}
                              {item.leadId ? (
                                <Link href={`/leads/${item.leadId}`} className="font-medium hover:underline">
                                  {item.leadName}
                                </Link>
                              ) : (
                                <span className="font-medium">{item.leadName}</span>
                              )}
                            </>
                          )}
                        </span>
                        {detail && <span className="mt-0.5 block truncate text-[13.5px] text-ink-soft">{detail}</span>}
                      </span>
                      <span
                        className="text-right text-[13px]"
                        style={{ color: item.type === "held" || item.type === "rapid_engagement" ? "var(--ink)" : "var(--ink-soft)", fontWeight: item.type === "held" || item.type === "rapid_engagement" ? 500 : 400 }}
                      >
                        {w.state}
                      </span>
                    </div>
                  );
                })}
              </section>
            ))}
          </div>

          {/* Phone: a plain list under each day, first names only. */}
          <div className="lg:hidden">
            {groups.map((g) => (
              <section key={g.day} className="mt-[18px]">
                <h2 className="text-sm font-semibold">{g.day}</h2>
                {g.items.map((item, i) => {
                  const w = WHAT[item.type];
                  const detail = detailFor(item);
                  const first = item.leadName?.split(" ")[0];
                  const row = (
                    <>
                      <span className="flex justify-between gap-2.5">
                        <span className="text-[15.5px]">
                          {w.verb}
                          {first && (
                            <>
                              {" · "}
                              <span className="font-medium">{first}</span>
                            </>
                          )}
                        </span>
                        <span className="whitespace-nowrap text-[13px] tabular-nums text-ink-faint">{timeOf(item.occurredAt)}</span>
                      </span>
                      {detail && <span className="mt-0.5 line-clamp-2 block text-[13.5px] leading-snug text-ink-soft">{detail}</span>}
                    </>
                  );
                  const cls = "block py-[11px] " + (i ? "border-t border-line-2" : "");
                  return item.leadId ? (
                    <Link key={item.id} href={`/leads/${item.leadId}`} className={cls}>
                      {row}
                    </Link>
                  ) : (
                    <div key={item.id} className={cls}>
                      {row}
                    </div>
                  );
                })}
              </section>
            ))}
          </div>

          {/* Never imply completeness the page doesn't have: the feed keeps
              the most recent events only (lib/activity.ts). */}
          <p className="mt-5 text-[13px] text-ink-faint">Showing the last {items.length} events.</p>
        </>
      )}
    </div>
  );
}
