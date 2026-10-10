import Link from "next/link";
import { CalendarCheck, ChevronRight, Clock, Hand, Send } from "lucide-react";
import { Eyebrow } from "@/components/app/canvasBits";
import type { DidToday } from "@/lib/didToday";

/**
 * The quiet rows under Today's one card (A-220). Today never shows a list:
 * anything more than one row lives in Customers or on the activity page.
 */

/**
 * Customers going quiet (A-046's "About to be lost"), as one row: the first
 * by name and the reason, or how many more. One person opens them; more than
 * one opens the Going quiet group in Customers.
 */
export function GoingQuietRow({ first, total }: { first: { id: string; name: string; reason: string }; total: number }) {
  const more = total - 1;
  return (
    <Link
      href={more > 0 ? "/leads?show=quiet" : `/leads/${first.id}`}
      className="mt-2.5 flex min-h-11 max-w-[640px] items-center gap-2.5 rounded-[14px] border border-line bg-card px-3 py-2.5"
    >
      <span className="shrink-0 text-[12px] font-medium text-ink-faint">Going quiet</span>
      <span className="min-w-0 flex-1 truncate text-[13.5px]">
        <span className="font-semibold">{first.name}</span>
        <span className="text-ink-soft">{more > 0 ? ` and ${more} more` : ` · ${first.reason}`}</span>
      </span>
      <ChevronRight className="h-[18px] w-[18px] shrink-0 text-ink-faint" aria-hidden="true" />
    </Link>
  );
}

const ICON = { sent: Send, held: Hand, stopped: Clock, finished: CalendarCheck } as const;

/** "What FollowUp did today" (A-220): the newest few, then the whole record. Nothing when nothing happened. */
export function WhatFollowUpDid({ items }: { items: DidToday[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-6 max-w-[640px] px-1">
      <Eyebrow>What FollowUp did today</Eyebrow>
      <ul className="mt-2">
        {items.map((d, i) => {
          const Icon = ICON[d.kind];
          return (
            <li key={d.id} className={"flex items-start gap-3 py-2.5" + (i ? " border-t border-line" : "")}>
              <span aria-hidden="true" className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-card-2 text-ink-soft">
                <Icon className="h-[15px] w-[15px]" strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold leading-snug">{d.title}</span>
                {d.sub && <span className="block truncate text-[12.5px] text-ink-faint">{d.sub}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <Link href="/activity" className="inline-flex min-h-11 items-center text-[13px] text-ink-soft underline underline-offset-[3px] hover:text-ink">
        See everything it did
      </Link>
    </section>
  );
}
