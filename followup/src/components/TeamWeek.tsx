"use client";

import { useEffect, useState } from "react";
import type { TeamWeek as Week } from "@/lib/calls";

/**
 * "This week" on the Team page (design brain A-103, the realtor team pilot).
 * A manager's view in one box: one sentence for the whole team, then each
 * person's calls, who they reached, and meetings booked. Only the person
 * who is behind gets the orange dot, with what is behind. No charts (R-001:
 * a dashboard is not what this product is).
 *
 * Admins only (the API refuses everyone else), and only while "Your team
 * calls customers" is on; otherwise it renders nothing.
 */
export default function TeamWeek() {
  const [week, setWeek] = useState<Week | null>(null);

  useEffect(() => {
    fetch("/api/team/week")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setWeek(d?.week ?? null))
      .catch(() => {});
  }, []);

  if (!week) return null;
  const since = new Date(week.weekStart).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  return (
    <section className="box p-5" aria-label="This week">
      <p className="text-lg font-medium">This week</p>
      <p className="text-[13px] text-ink-faint">{since} to today · only admins see this</p>
      <p className="mt-3 text-[15px] text-ink-soft tabular-nums">
        The team made {plural(week.calls, "call", "calls")}, spoke with {plural(week.spoke, "person", "people")} and booked{" "}
        <b className="font-semibold text-ink">{plural(week.meetings, "meeting", "meetings")}</b>. Same time last week: {week.meetingsLastWeek}.
      </p>

      {/* Desktop: a plain table. */}
      <div className="mt-4 hidden sm:block">
        <div className="grid grid-cols-[minmax(0,1fr)_90px_110px_150px] gap-4 pb-2 text-[12.5px] text-ink-faint">
          <span>Person</span>
          <span className="text-right">Calls</span>
          <span className="text-right">Spoke with</span>
          <span className="text-right">Meetings booked</span>
        </div>
        {week.people.map((p) => (
          <div key={p.userId} className="grid grid-cols-[minmax(0,1fr)_90px_110px_150px] items-baseline gap-4 border-t border-line py-3.5">
            <p className="truncate font-medium">{p.name}</p>
            <p className="text-right tabular-nums">{p.calls}</p>
            <p className="text-right tabular-nums">{p.spoke}</p>
            <p className="text-right font-semibold tabular-nums">{p.meetings}</p>
            {p.behind && <Behind name={p.name} late={p.lateCalls} className="col-span-4 -mt-1" />}
          </div>
        ))}
      </div>

      {/* Phone: one row per person, meetings first. */}
      <div className="mt-2 sm:hidden">
        {week.people.map((p, i) => (
          <div key={p.userId} className={"py-3.5" + (i ? " border-t border-line" : "")}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate font-medium">{p.name}</p>
              <p className="shrink-0 text-[15px] tabular-nums">
                <b className="font-semibold">{p.meetings}</b> {p.meetings === 1 ? "meeting" : "meetings"}
              </p>
            </div>
            <p className="mt-0.5 text-[13.5px] text-ink-soft tabular-nums">
              {plural(p.calls, "call", "calls")} · spoke with {p.spoke}
            </p>
            {p.behind && <Behind name={p.name} late={p.lateCalls} className="mt-2" />}
          </div>
        ))}
      </div>

      <p className="mt-3 text-[12.5px] text-ink-faint">
        Calls are the ones marked No answer or Already spoke. Meetings are times booked through your booking link on that person&apos;s customers.
      </p>
    </section>
  );
}

function Behind({ name, late, className }: { name: string; late: number; className: string }) {
  const first = name.split(" ")[0] || name;
  return (
    <p className={"text-[14px] " + className}>
      <span aria-hidden className="mr-2 inline-block h-[7px] w-[7px] rounded-full align-[2px]" style={{ background: "var(--state-needs)" }} />
      No meetings yet this week.{late > 0 ? ` ${late} of ${first}'s calls ${late === 1 ? "is" : "are"} more than a day late.` : ""}
    </p>
  );
}
