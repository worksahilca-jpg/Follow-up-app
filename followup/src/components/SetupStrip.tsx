import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { SetupStep } from "@/lib/setupStatus";
import SetupStepSkip from "@/components/SetupStepSkip";

/**
 * research/product/2026-09-10-ux-simplification.md §2/§7.1: replaces the
 * Sidebar's two persistent nag cards ("Not subscribed", "Gmail not
 * connected") — proportionally enormous in a slim sidebar, and only ever
 * covered two of the several things a business might still need to
 * finish. One strip on Today, showing only the next unfinished step, never
 * all of them at once — see getIncompleteSetupSteps.
 *
 * The header here used to say "dismissible-feeling", which was the polite
 * version of "looks like you can get rid of it, and you can't". A step
 * that genuinely may not apply — a website widget for a business with no
 * website — now carries a real way out beside its button, and the two
 * steps that can take one are listed in DISMISSIBLE_SETUP_STEPS.
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
      {/* The real action, and — for a step that can genuinely not apply —
          the way out. Grouped so the pair stacks and stays in thumb reach
          on a phone, exactly as the button alone did. */}
      <div className="flex items-center gap-3 sm:shrink-0">
        <Link
          href={next.ctaHref}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-medium sm:flex-none sm:py-1.5"
          style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
        >
          {next.ctaLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        {next.dismissible && next.dismissLabel && <SetupStepSkip id={next.id} label={next.dismissLabel} />}
      </div>
    </div>
  );
}
