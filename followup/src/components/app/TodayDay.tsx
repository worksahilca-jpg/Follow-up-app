import Link from "next/link";
import { CalendarDays, ChevronRight, MessageCircle, Phone } from "lucide-react";
import { Initials } from "@/components/app/canvasBits";

/**
 * The parts of Today that make it the owner's whole day (A-244, after R-114:
 * "Today is the gist of everything ... How many calls do I need to do? How
 * many meetings?"). The work itself is the reply card and its list
 * (ApprovalQueue); these are its rows and "Later": tomorrow, what is already
 * done, and what FollowUp does on its own (A-266).
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
  /** The customer's name: the row shows their initials instead of an icon (A-266, friendlier than a symbol). */
  person?: string | null;
};

const ICON = { reply: MessageCircle, call: Phone, booking: CalendarDays, checkin: MessageCircle } as const;

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
export function DayRow({ row, first, onClick, expanded }: { row: TodayRow; first?: boolean; onClick?: () => void; expanded?: boolean }) {
  const Icon = ICON[row.kind];
  const body = (
    <>
      {row.person ? (
        <Initials name={row.person} size={36} />
      ) : (
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card-2 text-ink">
          <Icon className="h-[17px] w-[17px]" strokeWidth={2} />
        </span>
      )}
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
  // The hairline between rows starts where the words start (A-264): 16px padding + 36px icon + 12px gap.
  const cls = `flex min-h-[60px] items-center gap-3 px-4 py-3 ${first ? "" : "ios-sep"}`;
  const sep = { "--sep-inset": "64px" } as React.CSSProperties;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-expanded={expanded} style={sep} className={`${cls} w-full text-left hover:bg-paper`}>
        {body}
      </button>
    );
  }
  return row.href ? (
    <Link href={row.href} data-nav="push" style={sep} className={`${cls} hover:bg-paper`}>
      {body}
    </Link>
  ) : (
    <div style={sep} className={cls}>
      {body}
    </div>
  );
}

/** One line of "Later": what it is on the left, what it holds on the right. */
export type LaterLine = { label: string; value: string; href?: string | null };

/**
 * "Later" (A-266, 2026-10-16; was Tomorrow and Done today as two sections with boxes, A-244): one plain line each
 * for tomorrow, what is already done, and what FollowUp does on its own. A line opens its page when there is one.
 */
export function DayLater({ lines }: { lines: LaterLine[] }) {
  if (lines.length === 0) return null;
  return (
    <section aria-label="Later">
      <DayHeading title="Later" />
      <ul className="px-1">
        {lines.map((l) => {
          const inner = (
            <>
              <span className="shrink-0 text-[15px]">{l.label}</span>
              <span className="min-w-0 text-right text-[14.5px] leading-snug text-ink-soft">{l.value}</span>
            </>
          );
          const cls = "flex min-h-[52px] items-center justify-between gap-4 py-3";
          return (
            <li key={l.label}>
              {l.href ? (
                <Link href={l.href} className={cls + " hover:text-ink"}>
                  {inner}
                </Link>
              ) : (
                <div className={cls}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
