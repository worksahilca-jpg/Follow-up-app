import Link from "next/link";
import { CalendarDays, ChevronRight, MessageCircle, Phone } from "lucide-react";
import { Initials } from "@/components/app/canvasBits";
import { ChannelIcon, hasChannelIcon } from "@/components/app/ChannelIcon";

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
  /** A quiet word beside the name, where they stand: "Ready", "Warm" (A-286, A-310): an outline, no colour. */
  tag?: string | null;
  /** The time as a quiet fact on the right ("8:12 AM" in grey, A-336's "FollowUp did"), not a calendar time in bold. */
  quietTime?: boolean;
  /** A plain line with no face or icon, indented to the words ("Tomorrow · Nothing booked"). */
  noIcon?: boolean;
  /** The title may take two lines instead of cutting off: "FollowUp did" rows carry the fact in the title. */
  wrap?: boolean;
  /** Where they wrote ("instagram", "email"…): the app's own small mark on the corner of their face (A-338). */
  channel?: string | null;
  /** The time is a deadline ("3 h left to reply", A-338): said in ink and a little heavier, never in colour. */
  due?: boolean;
};

/**
 * A customer's face with where they wrote on its corner (A-338, A-276's rule for rows): the app's own mark, an envelope
 * for email, a globe for the website form. No mark when the channel is unknown.
 */
export function Face({ name, size, channel }: { name: string; size: number; channel?: string | null }) {
  const mark = hasChannelIcon(channel) ? <ChannelIcon channel={channel} className="h-[9.5px] w-[9.5px] text-ink-soft" /> : null;
  return (
    <span className="relative inline-flex shrink-0">
      <Initials name={name} size={size} />
      {mark && (
        <span className="absolute -right-[5px] -bottom-[5px] flex h-4 w-4 items-center justify-center rounded-full border border-line bg-card" style={{ boxShadow: "0 0 0 1.5px var(--card)" }}>
          {mark}
        </span>
      )}
    </span>
  );
}

const ICON = { reply: MessageCircle, call: Phone, booking: CalendarDays, checkin: MessageCircle } as const;

/**
 * Where a customer stands, as one quiet word beside their name: "Ready", "Warm", "Later", "Has an agent" (A-286,
 * FollowUp's call A-310). An outline, no colour (A-281): status colours are for broken or done.
 */
export function TierTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-full border px-[7px] text-[12px] font-semibold leading-[18px] text-ink" style={{ borderColor: "var(--line-strong)" }}>
      {children}
    </span>
  );
}

/** A section title in the day: a plain heading and, on the right, a short count or date. */
export function DayHeading({ title, aside, quiet = false }: { title: string; aside?: string | null; /** The aside as plain words, not a count. */ quiet?: boolean }) {
  return (
    // A small uppercase label over the section's white group (A-307).
    <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
      <h2 className="group-label shrink-0">{title}</h2>
      {aside && <span className={"min-w-0 truncate text-[12.5px] text-ink-faint" + (quiet ? "" : " font-semibold tabular-nums")}>{aside}</span>}
    </div>
  );
}

/**
 * One row: an icon, what to do, why, and a time or a chevron. The whole row opens it. `plain` is the owner's side of
 * Today (A-337): a hairline above, no white group, their words on one line under the name.
 */
export function DayRow({
  row,
  onClick,
  expanded,
  plain = false,
}: {
  row: TodayRow;
  /** No longer changes anything (A-282 dropped the line above rows). */
  first?: boolean;
  onClick?: () => void;
  expanded?: boolean;
  plain?: boolean;
}) {
  const Icon = ICON[row.kind];
  const body = (
    <>
      {row.person ? (
        <Face name={row.person} size={plain ? 34 : 36} channel={row.channel} />
      ) : row.noIcon ? (
        <span aria-hidden="true" className={(plain ? "w-[34px]" : "w-9") + " shrink-0"} />
      ) : (
        <span aria-hidden="true" className={(plain ? "h-[34px] w-[34px]" : "h-9 w-9") + " flex shrink-0 items-center justify-center rounded-full bg-card-2 text-ink"}>
          <Icon className="h-[17px] w-[17px]" strokeWidth={2} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={(row.wrap ? "line-clamp-2" : "truncate") + (plain ? " text-[15px] font-semibold leading-[1.3]" : " text-[15.5px] font-semibold leading-snug")}>{row.title}</span>
          {row.tag && <TierTag>{row.tag}</TierTag>}
        </span>
        {row.sub && (
          <span className={plain ? "mt-px block truncate text-[14px] leading-[1.35] text-ink-soft" : "mt-0.5 block text-[13.5px] leading-snug text-ink-soft"}>{row.sub}</span>
        )}
      </span>
      {row.time ? (
        <span className={"shrink-0 tabular-nums " + (row.due ? "text-[13px] font-semibold text-ink" : row.quietTime ? "text-[12.5px] text-ink-faint" : "text-[15px] font-semibold")}>{row.time}</span>
      ) : row.href || onClick ? (
        <ChevronRight className="h-[18px] w-[18px] shrink-0 text-ink-faint" aria-hidden="true" />
      ) : null}
    </>
  );
  // The hairline between rows starts where the words start (A-264): 16px padding + 36px icon + 12px gap. Since the
  // calm look (A-282) ios-sep draws no line, only the rounded fill a row gets when pointed at, so every row has it,
  // the first one too.
  const cls = plain ? "flex min-h-[58px] items-center gap-3 border-t border-line px-1 py-2.5" : "ios-sep flex min-h-[60px] items-center gap-3 px-4 py-3";
  const hover = plain ? "" : " hover:bg-paper";
  const sep = { "--sep-inset": "64px" } as React.CSSProperties;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-expanded={expanded} style={sep} className={`${cls} w-full text-left${hover}`}>
        {body}
      </button>
    );
  }
  return row.href ? (
    <Link href={row.href} data-nav="push" style={sep} className={`${cls}${hover}`}>
      {body}
    </Link>
  ) : (
    <div style={sep} className={cls}>
      {body}
    </div>
  );
}
