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
    /* Stacks below sm. Side by side, a shrink-0 button left the text column
       about 170px wide on a 390px phone: the title wrapped to two lines, the
       description to three, and the strip turned into a six-line block of
       ragged text next to a button. Full width, button underneath, in thumb
       reach — same shape the page header already uses at this width. */
    <div className="mt-6 flex flex-col gap-3 box px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {next.title}
          {rest.length > 0 && (
            <span className="text-ink-soft font-normal">
              {" "}
              · {rest.length} more setup step{rest.length === 1 ? "" : "s"} after this
            </span>
          )}
        </p>
        <p className="text-xs text-ink-soft mt-0.5">{next.description}</p>
      </div>
      <Link
        href={next.ctaHref}
        className="inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-medium sm:shrink-0 sm:py-1.5"
        style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
      >
        {next.ctaLabel}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
