import Link from "next/link";
import { CalendarCheck, Clock, Hand, Send } from "lucide-react";
import { Eyebrow } from "@/components/app/canvasBits";
import type { DidToday } from "@/lib/didToday";

/**
 * Quiet rows for Today (A-220). "Stopped replying" is a row of Today's list now (A-266, ApprovalQueue).
 */

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
