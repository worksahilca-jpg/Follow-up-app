import Link from "next/link";
import { CalendarDays, Check, ChevronRight, MessageCircle, Phone } from "lucide-react";
import { dayParts } from "@/lib/todayWords";

/**
 * The parts of Today that make it the owner's whole day (A-244, after R-114:
 * "Today is the gist of everything ... How many calls do I need to do? How
 * many meetings?"). The work itself is the reply card and its list
 * (ApprovalQueue); these say how big the day is, how far through it the owner
 * is, what tomorrow holds and what is already done.
 */

/** One thing in the day: a reply, a call to make, or a booked time. */
export type TodayRow = {
  key: string;
  kind: "reply" | "call" | "booking" | "checkin";
  title: string;
  sub: string | null;
  /** "6:30 PM" when it happens at a time; otherwise the row shows a chevron. */
  time: string | null;
  href: string | null;
};

const ICON = { reply: MessageCircle, call: Phone, booking: CalendarDays, checkin: MessageCircle } as const;

export const DAY_BOX = "rounded-[18px] border border-line bg-card";

/** A section title in the day: a plain heading and, on the right, a short count or date. */
export function DayHeading({ title, aside }: { title: string; aside?: string | null }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-3 px-1">
      <h2 className="text-[18px] font-semibold tracking-[-0.01em]">{title}</h2>
      {aside && <span className="text-[13.5px] text-ink-soft">{aside}</span>}
    </div>
  );
}

/** One row: an icon, what to do, why, and a time or a chevron. The whole row opens it. */
export function DayRow({ row, first, onClick }: { row: TodayRow; first?: boolean; onClick?: () => void }) {
  const Icon = ICON[row.kind];
  const body = (
    <>
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card-2 text-ink">
        <Icon className="h-[17px] w-[17px]" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15.5px] font-semibold leading-snug">{row.title}</span>
        {row.sub && <span className="mt-0.5 block text-[13.5px] leading-snug text-ink-soft">{row.sub}</span>}
      </span>
      {row.time ? (
        <span className="shrink-0 text-[15px] font-semibold tabular-nums">{row.time}</span>
      ) : row.href || onClick ? (
        <ChevronRight className="h-[18px] w-[18px] shrink-0 text-ink-faint" aria-hidden="true" />
      ) : null}
    </>
  );
  const cls = `flex min-h-[60px] items-center gap-3 px-4 py-3 ${first ? "" : "border-t border-line"}`;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cls} w-full text-left hover:bg-paper`}>
        {body}
      </button>
    );
  }
  return row.href ? (
    <Link href={row.href} className={`${cls} hover:bg-paper`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/**
 * How big the day is, said once (A-250, 2026-10-14; was three number tiles
 * and a progress line, A-244): "4 things to do today", how many are done with
 * the bar, then one line saying what they are (dayParts). Nothing at all on a
 * day with nothing to do and nothing done: the "all caught up" card says it.
 */
export function DayNumbers({
  replies,
  calls,
  booked,
  nextBookedAt,
  lookBack = 0,
  progress,
}: {
  replies: number;
  calls: number;
  booked: number;
  /** Calls that are over and still to be answered "How did it go?" (A-263). */
  lookBack?: number;
  /** The next booked call's time today, "3:00 PM", or null when none is still to come. */
  nextBookedAt: string | null;
  progress: { done: number; total: number; toGo: number; pct: number } | null;
}) {
  if (!progress) return null;
  const title = progress.toGo === 0 ? "All done for today" : `${progress.toGo} ${progress.toGo === 1 ? "thing" : "things"} to do today`;
  const parts = progress.toGo > 0 ? dayParts({ replies, calls, booked, nextBookedAt, lookBack }) : null;
  return (
    <section aria-label="Your day in numbers">
      <div className={`${DAY_BOX} p-4`}>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[18px] font-semibold leading-snug tracking-[-0.01em]">{title}</p>
          <p className="shrink-0 text-[14px] text-ink-soft tabular-nums">{progress.done} done</p>
        </div>
        <div
          className="mt-2.5 h-[7px] overflow-hidden rounded-full bg-card-2"
          role="progressbar"
          aria-valuenow={progress.done}
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-label={`${progress.done} of ${progress.total} done today`}
        >
          <div className="h-full rounded-full" style={{ width: `${progress.pct}%`, background: "var(--sage)" }} />
        </div>
        {parts && <p className="mt-2.5 text-[14.5px] leading-snug text-ink-soft">{parts}</p>}
      </div>
    </section>
  );
}

/** Tomorrow: booked times, then what FollowUp will do on its own. A quiet line when nothing is planned. */
export function DayTomorrow({ date, rows }: { date: string; rows: TodayRow[] }) {
  return (
    <section aria-label="Tomorrow">
      <DayHeading title="Tomorrow" aside={date} />
      {rows.length > 0 ? (
        <div className={`${DAY_BOX} overflow-hidden`}>
          {rows.map((r, i) => (
            <DayRow key={r.key} row={r} first={i === 0} />
          ))}
        </div>
      ) : (
        <p className="px-1 text-[14.5px] text-ink-soft">Nothing booked or planned for tomorrow yet.</p>
      )}
    </section>
  );
}

/** Done today: ticks for what happened. A quiet line when the day hasn't started. */
export function DayDone({ lines }: { lines: string[] }) {
  return (
    <section aria-label="Done today">
      <DayHeading title="Done today" />
      {lines.length > 0 ? (
        <div className={`${DAY_BOX} flex flex-col gap-2.5 px-4 py-3.5`}>
          {lines.map((l) => (
            <p key={l} className="flex items-start gap-2.5 text-[15px] leading-snug">
              <Check className="mt-0.5 h-[17px] w-[17px] shrink-0" style={{ color: "var(--sage)" }} strokeWidth={2.2} aria-hidden="true" />
              {l}
            </p>
          ))}
        </div>
      ) : (
        <p className="px-1 text-[14.5px] text-ink-soft">Nothing yet. What you and FollowUp do today shows up here.</p>
      )}
    </section>
  );
}
