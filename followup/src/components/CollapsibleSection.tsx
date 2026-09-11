"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * research/product/2026-09-10-ux-simplification.md §8: the lead detail
 * page's sidebar used to be 6-7 always-open cards stacked on top of each
 * other — Details, Notes, consent/audit trail, automation tier, workflow
 * enrollment — most of which a business owner only needs to check
 * occasionally, not every time they open a lead. This collapses each into
 * a one-line summary you click to expand, so the page reads as "here's
 * what needs you" up top with the reference material tucked away, not the
 * other way around.
 *
 * Deliberately chrome-only: it never restyles or re-titles what it wraps
 * — a child component (LeadTrustPanel, LeadAutomationToggle) keeps its own
 * heading and card styling untouched, so this adds one clickable summary
 * row above it instead of requiring every child to be rewritten to fit a
 * shared shape.
 */
export default function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 rounded-lg px-1 py-2 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-ink-soft">{title}</span>
        <ChevronDown className={`h-4 w-4 text-ink-soft shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}
