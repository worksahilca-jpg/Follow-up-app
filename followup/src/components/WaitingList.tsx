import Link from "next/link";
import { sentLabel, type WaitingItem } from "@/lib/waitingOn";

/** The "Waiting on customers" list (A-050): who, what you last sent, when, and what happens next. */
export default function WaitingList({ items, now, timeZone }: { items: WaitingItem[]; now: Date; timeZone: string }) {
  return (
    <div className="mt-6 box overflow-hidden">
      <div className="hidden md:grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_7rem_minmax(0,20rem)] gap-4 px-5 py-3 border-b border-line text-xs font-medium text-ink-soft">
        <span>Customer</span>
        <span>Last from you</span>
        <span>Sent</span>
        <span>What happens next</span>
      </div>
      {items.map((it) => (
        <Link
          key={it.leadId}
          href={`/leads/${it.leadId}`}
          className="block md:grid md:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_7rem_minmax(0,20rem)] gap-4 px-5 py-3.5 border-b border-line last:border-0 hover:bg-paper"
        >
          <span className="flex items-baseline justify-between gap-3 md:block">
            <span className="text-sm font-medium">{it.name}</span>
            <span className="md:hidden text-xs text-ink-soft">{sentLabel(it.sentAt, now, timeZone)}</span>
          </span>
          <span className="hidden md:block text-sm text-ink-soft truncate">You: {it.lastFromYou}</span>
          <span className="hidden md:block text-xs text-ink-soft self-center">{sentLabel(it.sentAt, now, timeZone)}</span>
          <span className="block mt-0.5 md:mt-0 text-sm md:text-xs text-ink-soft self-center">{it.next}</span>
        </Link>
      ))}
    </div>
  );
}
