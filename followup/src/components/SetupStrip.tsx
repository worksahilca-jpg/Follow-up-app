import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { SetupStep } from "@/lib/setupStatus";

/**
 * research/product/2026-09-10-ux-simplification.md §2/§7.1: replaces the
 * Sidebar's two persistent nag cards ("Not subscribed", "Gmail not
 * connected") — proportionally enormous in a slim sidebar, and only ever
 * covered two of the several things a business might still need to
 * finish. One dismissible-feeling strip on Today, showing only the next
 * unfinished step, never all of them at once — see getIncompleteSetupSteps.
 */
export default function SetupStrip({ steps }: { steps: SetupStep[] }) {
  if (steps.length === 0) return null;
  const [next, ...rest] = steps;

  return (
    <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-line bg-card px-5 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {next.title}
          {rest.length > 0 && <span className="text-ink-soft font-normal"> · {rest.length} more after this</span>}
        </p>
        <p className="text-xs text-ink-soft mt-0.5">{next.description}</p>
      </div>
      <Link
        href={next.ctaHref}
        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium shrink-0"
        style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
      >
        {next.ctaLabel}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
