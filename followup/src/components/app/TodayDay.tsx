import Link from "next/link";
import { CalendarDays, Check, ChevronRight, MessageCircle, Phone } from "lucide-react";

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

/** "5 replies to send · 2 calls to make · 1 booked today", then "3 of 11 done today" with its bar. */
export function DayNumbers({
  replies,
  calls,
  booked,
  progress,
}: {
  replies: number;
  calls: number;
  booked: number;
  progress: { done: number; total: number; toGo: number; pct: number } | null;
}) {
  const cells: [number, string][] = [
    [replies, replies === 1 ? "reply to send" : "replies to send"],
    [calls, calls === 1 ? "call to make" : "calls to make"],
    [booked, "booked for today"],
  ];
  return (
    <section aria-label="Your day in numbers">
      <div className={`${DAY_BOX} grid grid-cols-3`}>
        {cells.map(([n, label], i) => (
          <div key={label} className={`px-2 pb-3 pt-3.5 text-center ${i > 0 ? "border-l border-line" : ""}`}>
            <div className="title-serif text-[32px] leading-none tabular-nums">{n}</div>
            <div className="mt-1.5 text-[13px] leading-tight text-ink-soft">{label}</div>
          </div>
        ))}
      </div>
      {progress && (
        <div className="mt-3.5 px-1">
          <div className="flex justify-between text-[14px] text-ink-soft tabular-nums">
            <span>
              <b className="font-semibold text-ink">
                {progress.done} of {progress.total}
              </b>{" "}
              done today
            </span>
            <span>{progress.toGo === 0 ? "All done" : `${progress.toGo} to go`}</span>
          </div>
          <div
            className="mt-2 h-[7px] overflow-hidden rounded-full bg-card-2"
            role="progressbar"
            aria-valuenow={progress.done}
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-label={`${progress.done} of ${progress.total} done today`}
          >
            <div className="h-full rounded-full" style={{ width: `${progress.pct}%`, background: "var(--sage)" }} />
          </div>
        </div>
      )}
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
