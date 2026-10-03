"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * The customer page's one "Details" row (A-080, the one-decision desk):
 * everything about how FollowUp handles this person sits behind it, shown
 * only because the owner asked. Closed, it is a single card. Open, the
 * sheet of rows continues the same card below it.
 */
export default function DetailsFold({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={"flex min-h-[50px] w-full items-center justify-between gap-3 px-4 text-left text-[15px] hover:bg-card-2" + (open ? " border-b border-line-2" : "")}
      >
        <span>Details</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-ink-faint transition-transform ${open ? "rotate-180 text-ink" : ""}`} />
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}
