import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

/**
 * PageHeader — the app's one page-header shape.
 *
 * Five different header shapes shipped before this: h1 + subtitle
 * (/analytics, /activity); h1 + subtitle + right actions (/leads, /pipeline,
 * /workflows); h1 inside an aurora box (/dashboard); h1 + subtitle + sticky
 * tabs (/settings); back-link + h1 (/admin/office). Five variants of one
 * thing is the definition of an unresolved pattern, so this resolves it.
 *
 * Two rules it enforces:
 *
 * 1. **One filled primary action, at most.** `primary` takes a single node and
 *    there is no way to pass two. The founder's calibration chose "accent blue
 *    held back — saved for one moment" (approved.md A-006), and a header with
 *    three filled blue buttons is the opposite of that. Secondary actions go in
 *    `actions` and are rendered quiet.
 * 2. **Actions drop below the header at phone width.** Top-right is correct at
 *    sm and up, but at 390px a row of buttons wraps and eats the first screen
 *    on /leads, /pipeline and /workflows — on a page whose entire job is the
 *    list underneath it. Below sm they stack under the title, full width, in
 *    thumb reach.
 */
export type PageHeaderProps = {
  title: ReactNode;
  /** One line. If it needs two, the page is explaining too much up top. */
  subtitle?: ReactNode;
  /** Optional back link, e.g. { href: "/admin", label: "Admin" }. */
  back?: { href: string; label: string };
  /** Quiet, secondary actions. Rendered before the primary. */
  actions?: ReactNode;
  /** The single filled action for this page, if it has one. */
  primary?: ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, back, actions, primary, className = "" }: PageHeaderProps) {
  const hasActions = Boolean(actions || primary);

  return (
    <div className={className}>
      {back && (
        <Link
          href={back.href}
          className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink transition-colors"
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          {back.label}
        </Link>
      )}

      <div className={"sm:flex sm:items-start sm:justify-between sm:gap-4 " + (back ? "mt-2" : "")}>
        <div className="min-w-0">
          <h1 className="font-display text-3xl">{title}</h1>
          {subtitle && <p className="text-ink-soft mt-1 max-w-xl">{subtitle}</p>}
        </div>

        {/* shrink-0 AND nowrap: without both, a long title squeezes this column
            and the primary button's label wraps onto three lines. */}
        {hasActions && (
          <div className="mt-3 flex flex-col gap-2 sm:mt-0 sm:flex-row sm:items-center sm:gap-2 sm:shrink-0 sm:whitespace-nowrap">
            {actions}
            {primary}
          </div>
        )}
      </div>
    </div>
  );
}
