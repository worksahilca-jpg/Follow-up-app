import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * Lists the iOS way (A-273, founder 2026-10-17: "look how iOS uses the style and size… format and all too"):
 * rows grouped in one rounded box, about 48px tall, a 29px coloured tile, the label at body size, a grey value on
 * the right, a small grey chevron, and a hairline that starts after the tile. iOS's sizes and layout, never its
 * screens (R-077).
 */

/** One group of rows. */
export const GROUP = "overflow-hidden rounded-[12px] border border-line bg-card";

/** A 29px rounded tile; `bg` is its fill, the glyph inside is white. */
export function IconTile({ bg, children }: { bg: string; children: ReactNode }) {
  return (
    <span aria-hidden className="flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-[7px] text-white" style={{ background: bg }}>
      {children}
    </span>
  );
}

/** Two or three letters in a tile, for a service with no glyph of its own (a CRM). */
export function LetterTile({ text, bg }: { text: string; bg: string }) {
  return (
    <IconTile bg={bg}>
      <span className="text-[11px] font-semibold leading-none">{text}</span>
    </IconTile>
  );
}

type RowProps = {
  icon?: ReactNode;
  label: ReactNode;
  /** A second line under the label, smaller and grey. */
  sub?: ReactNode;
  /** Grey words on the right (iOS's value). */
  value?: ReactNode;
  /** Anything else on the right, before the chevron (a mark, a button). */
  trailing?: ReactNode;
  /** The first row in its group has no hairline above it. */
  first?: boolean;
  chevron?: boolean;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
};

export function ListRow({ icon, label, sub, value, trailing, first, chevron, href, onClick, disabled }: RowProps) {
  const opens = Boolean(href || onClick);
  const showChevron = chevron ?? opens;
  const inner = (
    <>
      {icon}
      <span className={"flex min-h-[48px] min-w-0 flex-1 items-center gap-2 py-2 pr-4" + (first ? "" : " border-t border-line-2")}>
        <span className="min-w-0 flex-1">
          <span className="ios-body block text-ink">{label}</span>
          {sub && <span className="ios-footnote mt-0.5 block truncate text-ink-soft">{sub}</span>}
        </span>
        {value && <span className="ios-subhead shrink-0 text-ink-faint">{value}</span>}
        {trailing}
        {showChevron && <ChevronRight aria-hidden className="h-[15px] w-[15px] shrink-0 text-ink-faint opacity-70" strokeWidth={2.5} />}
      </span>
    </>
  );
  const cls = "flex w-full items-center gap-3 pl-4 text-left" + (opens ? " transition-colors hover:bg-card-2 active:bg-card-2" : "");
  if (href) {
    // A connect link leaves the app for the provider's own sign-in, so it is a plain <a>, not a client-side Link.
    return href.startsWith("/api/") ? (
      <a href={href} className={cls}>
        {inner}
      </a>
    ) : (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={cls + " disabled:opacity-60"}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}
