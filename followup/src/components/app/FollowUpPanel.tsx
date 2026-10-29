"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Initials } from "@/components/app/canvasBits";
import { MOTION } from "@/lib/motion";

/** One quiet row in FollowUp's panel: who, what it did (or will do), the words it sent, when. */
export type PanelRow = { key: string; person: string; title: string; sub: string | null; when: string; href: string | null };

/** A small uppercase label over a part of the panel: "Since 9:40 PM", "Coming up". */
function Label({ children, first = false }: { children: React.ReactNode; first?: boolean }) {
  return <p className={(first ? "mt-0" : "mt-[22px]") + " mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-faint"}>{children}</p>;
}

function Row({ row }: { row: PanelRow }) {
  const body = (
    <>
      <Initials name={row.person} size={26} quiet />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium leading-[1.35] text-ink">{row.title}</span>
        {row.sub && <span className="mt-0.5 line-clamp-2 block text-[13px] leading-[1.4] text-ink-faint">{row.sub}</span>}
      </span>
      <span className="shrink-0 whitespace-nowrap pt-0.5 text-[12px] tabular-nums text-ink-faint">{row.when}</span>
    </>
  );
  const cls = "flex min-h-11 gap-2.5 border-t border-line py-[11px]";
  return row.href ? (
    <Link href={row.href} data-nav="push" className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/**
 * FollowUp's part of Today (A-337, from the research): one quiet panel on the soft ground, smaller type, no box per
 * row. Its sentence of real counts; what it did since the owner last looked, with the words it sent and the time; what
 * it does next; and when it last checked. On a computer it is the right column; on a phone it follows the owner's
 * part. A row that was not there when the page loaded (a reply the owner just sent) slides in at the top; the rows the
 * page opened with simply are (A-048: motion only where something changes).
 */
export default function FollowUpPanel({
  sentence,
  sinceLabel,
  did,
  more,
  coming,
  comingMore,
  checked,
}: {
  /** "While you were away, FollowUp answered 2 people…" (null while "Your last 90 days" says it instead, A-306). */
  sentence: string | null;
  /** "today", "since 9:40 PM", "since Saturday", "this week". */
  sinceLabel: string;
  did: PanelRow[];
  /** How many more it did, one tap away in Activity. */
  more: number;
  coming: PanelRow[];
  /** How many more steps are planned, one tap away in Coming up. */
  comingMore: number;
  /** "Checked Gmail and Instagram at 3:41 PM." */
  checked: string | null;
}) {
  // The keys on screen at the first render: nothing animates for them. Set once, never updated.
  const [opened] = useState(() => new Set(did.map((r) => r.key)));
  return (
    <section aria-label="FollowUp" className="rounded-[20px] bg-card-2 px-4 pt-[18px] pb-4 lg:px-[22px] lg:pt-[22px] lg:pb-[18px]">
      <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-faint">FollowUp</p>
      {sentence && <p className="mt-2 text-[15px] leading-[1.45] text-ink-soft">{sentence}</p>}

      {did.length > 0 && (
        <>
          <Label first={!sentence}>{sinceLabel}</Label>
          <AnimatePresence initial={false}>
            {did.map((r) => (
              <motion.div
                key={r.key}
                layout="position"
                initial={opened.has(r.key) ? false : { opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0, transition: { duration: MOTION.move, ease: MOTION.easeApple } }}
                exit={{ opacity: 0, transition: { duration: MOTION.exit } }}
              >
                <Row row={r} />
              </motion.div>
            ))}
          </AnimatePresence>
          {more > 0 && (
            <Link href="/activity" data-nav="push" className="flex min-h-11 items-center border-t border-line text-[13.5px] text-ink-soft hover:text-ink">
              {more} more, in Activity
              <span aria-hidden="true" className="ml-1">
                ›
              </span>
            </Link>
          )}
        </>
      )}

      {coming.length > 0 && (
        <>
          <Label first={!sentence && did.length === 0}>Coming up</Label>
          {coming.map((r) => (
            <Row key={r.key} row={r} />
          ))}
          {comingMore > 0 && (
            <Link href="/coming-up" data-nav="push" className="flex min-h-11 items-center border-t border-line text-[13.5px] text-ink-soft hover:text-ink">
              {comingMore} more coming up
              <span aria-hidden="true" className="ml-1">
                ›
              </span>
            </Link>
          )}
        </>
      )}

      {checked && <p className="mt-3.5 text-[12.5px] leading-snug text-ink-faint">{checked}</p>}
    </section>
  );
}
