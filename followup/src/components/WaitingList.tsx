import Link from "next/link";
import { sentLabel, type WaitingItem } from "@/lib/waitingOn";
import { Initials } from "@/components/app/canvasBits";

/**
 * The "Waiting on customers" list (A-050), as the WaitingOnCustomers and
 * WaitingPhone boards draw it: who, what you last sent, when, and what
 * happens next. On the phone: the name and when, then what happens next.
 */
const COLS = "md:grid-cols-[44px_minmax(0,12rem)_minmax(0,1fr)_7rem_minmax(0,20rem)]";

export default function WaitingList({ items, now, timeZone }: { items: WaitingItem[]; now: Date; timeZone: string }) {
  return (
    <div className="mt-5 md:overflow-hidden md:rounded-[18px] md:border md:border-line md:bg-card">
      <div className={"hidden gap-4 px-5 py-3 text-[12.5px] font-medium text-ink-faint md:grid " + COLS}>
        <span />
        <span>Customer</span>
        <span>Last from you</span>
        <span>Sent</span>
        <span>What happens next</span>
      </div>
      {items.map((it, i) => (
        <Link
          key={it.leadId}
          href={`/leads/${it.leadId}`}
          className={
            "block gap-4 py-[13px] md:grid md:items-center md:border-t md:border-line-2 md:px-5 md:py-3.5 md:hover:bg-paper " +
            COLS +
            (i ? " border-t border-line-2" : "")
          }
        >
          <span className="hidden md:block">
            <Initials name={it.name} size={32} />
          </span>
          <span className="flex items-baseline justify-between gap-3 md:block">
            <span className="text-base font-medium md:text-[14.5px]">{it.name}</span>
            <span className="text-[13px] text-ink-faint md:hidden">{sentLabel(it.sentAt, now, timeZone)}</span>
          </span>
          <span className="hidden truncate text-[13.5px] text-ink-soft md:block">You: {it.lastFromYou}</span>
          <span className="hidden text-[13px] text-ink-faint md:block">{sentLabel(it.sentAt, now, timeZone)}</span>
          <span className="mt-0.5 block text-[13.5px] leading-snug text-ink-soft md:mt-0 md:text-[13px]">{it.next}</span>
        </Link>
      ))}
    </div>
  );
}
