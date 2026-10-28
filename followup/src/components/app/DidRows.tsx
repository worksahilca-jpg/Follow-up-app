"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { DayRow, type TodayRow } from "@/components/app/TodayDay";
import { MOTION } from "@/lib/motion";

/**
 * "FollowUp did" (A-336): the rows of what it did since the owner last looked, one white group. A row that was not
 * there when the page loaded (a reply the owner just sent, something FollowUp did while the page was open) slides in
 * at the top; the rows the page opened with simply are (A-048: motion only where something changes).
 */
export default function DidRows({ rows, more }: { rows: TodayRow[]; more: number }) {
  // The keys on screen at the first render: nothing animates for them. Set once, never updated.
  const [opened] = useState(() => new Set(rows.map((r) => r.key)));
  return (
    <div className="list-group">
      <AnimatePresence initial={false}>
        {rows.map((r) => (
          <motion.div
            key={r.key}
            layout="position"
            initial={opened.has(r.key) ? false : { opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0, transition: { duration: MOTION.move, ease: MOTION.easeApple } }}
            exit={{ opacity: 0, transition: { duration: MOTION.exit } }}
          >
            <DayRow row={r} />
          </motion.div>
        ))}
      </AnimatePresence>
      {more > 0 && (
        <Link
          href="/activity"
          data-nav="push"
          className="ios-sep flex min-h-[48px] items-center gap-3 px-4 py-2.5 text-[14.5px] font-medium hover:bg-paper"
          style={{ "--sep-inset": "64px" } as React.CSSProperties}
        >
          <span aria-hidden="true" className="w-9 shrink-0" />
          {more} more, in Activity
          <span aria-hidden="true" className="ml-auto text-ink-faint">
            ›
          </span>
        </Link>
      )}
    </div>
  );
}
