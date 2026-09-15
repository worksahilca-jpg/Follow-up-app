import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/**
 * ItemBox — the app's one list-item shape.
 *
 * Comes from the founder's 2026-09-15 A/B calibration (decisions/approved.md
 * A-006). He picked, one variable at a time: tight over roomy, soft corners +
 * real shadow over crisp + flat, colour-coded over near-monochrome, each item
 * in its own box over bare hairline rows, and the brand blue held back rather
 * than used across the screen.
 *
 * Those five answers describe exactly one object, which is this one: an opaque
 * --card box on --paper, 12px radius, NO border, a real shadow, a 3px status
 * rail on the left, two lines of text, 8px between boxes.
 *
 * It replaces `rounded-xl border border-line bg-card divide-y divide-line`,
 * which shipped at six call sites and is the option he voted against on two
 * axes at once (flat edges, bare hairline rows).
 *
 * THREE RULES THIS COMPONENT ENFORCES, not just documents:
 *
 * 1. **A hue never appears without its word.** `status` is a single object —
 *    you cannot pass a tone without a label, because the type won't let you.
 *    Colour is a second encoding of a stated fact, never the only one. This is
 *    the founder's own question answered ("HOW WOULD I KNOW THIS COLOUR
 *    LANGUAGE") and it is the accessibility rule as well as the taste one:
 *    cover the colour and the box still reads.
 * 2. **At most one hue per box** (rejected.md S-05). The rail is the only place
 *    colour enters. There is deliberately no prop for a coloured figure, a
 *    coloured icon, or a tinted fill.
 * 3. **Exactly one box level** (rejected.md S-09). Boxes sit directly on
 *    --paper. Never render an ItemBox inside another ItemBox or inside a
 *    bordered card — that is the card-in-card soup S-09 exists to stop.
 *
 * The accent blue is not an option here at all. `--accent` means interactive
 * or selected; the status tones mean lead/event state. Neither crosses.
 */

/** The four status tones. Deliberately no "accent" member — see above. */
export type ItemTone = "slate" | "sage" | "gold" | "coral";

const RAIL: Record<ItemTone, string> = {
  slate: "var(--slate)",
  sage: "var(--sage)",
  gold: "var(--gold)",
  coral: "var(--coral)",
};

export type ItemBoxProps = {
  /** Line 1, left. The thing itself — a lead's name, what happened. */
  title: ReactNode;
  /**
   * Line 1, right. A time, a count, a value. Tabular figures so a column of
   * these lines up. Optional: most boxes don't need one.
   */
  figure?: ReactNode;
  /** Line 2. One plain-language fact. Keep it to one line's worth. */
  fact?: ReactNode;
  /**
   * The status rail plus the word that says what it means. Both or neither —
   * the type makes a bare colour impossible. `label` joins line 2.
   */
  status?: { tone: ItemTone; label: string };
  /** Makes the whole box a link and shows a chevron. */
  href?: string;
  className?: string;
};

export function ItemBox({ title, figure, fact, status, href, className = "" }: ItemBoxProps) {
  const inner = (
    <>
      {status && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-[3px] rounded-l-[var(--radius-box)]"
          style={{ backgroundColor: RAIL[status.tone] }}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
          {figure != null && (
            <span className="shrink-0 text-xs text-ink-soft tabular-nums">{figure}</span>
          )}
        </div>
        {(status || fact) && (
          <p className="mt-1 truncate text-xs text-ink-soft">
            {/* The status word and the rail colour always travel together. */}
            {status && <span style={{ color: RAIL[status.tone] }}>{status.label}</span>}
            {status && fact ? <span aria-hidden="true"> · </span> : null}
            {fact}
          </p>
        )}
      </div>
      {href && <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 self-center text-ink-soft" />}
    </>
  );

  // Hover deepens the shadow. Nothing translates — movement on a list of
  // twenty boxes is the "random animation" S-08 rules out.
  const shell =
    "relative flex gap-3 bg-card rounded-[var(--radius-box)] py-3 pr-3 transition-shadow " +
    (status ? "pl-4" : "pl-3") +
    " " +
    className;

  const style = { boxShadow: "var(--shadow-box)" } as const;

  return href ? (
    <Link
      href={href}
      className={shell + " hover:[box-shadow:var(--shadow-box-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"}
      style={style}
    >
      {inner}
    </Link>
  ) : (
    <div className={shell} style={style}>
      {inner}
    </div>
  );
}

/**
 * The 8px-gap column these sit in. Use it rather than re-deriving the gap —
 * "tight" is a measured preference, not a vibe, and one place to change it
 * is how it stays that way.
 */
export function ItemBoxList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={"flex flex-col gap-2 " + className}>{children}</div>;
}

/**
 * The label that sits OUTSIDE the boxes, on the paper — mono, uppercase,
 * quiet. Section headings and day headers both use it.
 */
export function ItemBoxLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={"font-mono text-xs uppercase tracking-wider text-ink-soft " + className}
      style={{ letterSpacing: "0.08em" }}
    >
      {children}
    </p>
  );
}
