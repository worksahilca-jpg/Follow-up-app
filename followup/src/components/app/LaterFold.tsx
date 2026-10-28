"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { DayLater, type LaterLine } from "@/components/app/TodayDay";

/**
 * "Later" as one line (A-335, Today with less on the screen): the label, a short summary of tomorrow, the week's
 * calls and what's done ("Nothing booked tomorrow · 1 call this week · 2 done today"), and a chevron. Tapping it opens
 * the full list (A-266's lines, each with its page) in place; tapping again folds it. Nothing is saved.
 */
export default function LaterFold({ summary, lines }: { summary: string; lines: LaterLine[] }) {
  const [open, setOpen] = useState(false);
  if (lines.length === 0) return null;
  return (
    <section aria-label="Later">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="today-later"
        className="flex min-h-11 w-full items-center gap-2.5 rounded-[12px] px-1 text-left hover:bg-[var(--nav-on)]"
      >
        <span className="group-label shrink-0">Later</span>
        {/* Two lines on a narrow phone rather than a cut-off word. */}
        <span className="line-clamp-2 min-w-0 flex-1 text-[14px] leading-snug text-ink-soft">{summary}</span>
        <ChevronRight
          aria-hidden="true"
          className={"h-[15px] w-[15px] shrink-0 text-ink-faint opacity-70 transition-transform duration-200" + (open ? " rotate-90" : "")}
          strokeWidth={2.5}
        />
      </button>
      {open && (
        <div id="today-later" className="mt-2">
          <DayLater lines={lines} heading={false} />
        </div>
      )}
    </section>
  );
}
