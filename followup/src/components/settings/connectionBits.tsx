"use client";

import type { ReactNode } from "react";
import AppWindow from "@/components/app/AppWindow";
import { GROUP, IconTile, ListRow } from "@/components/app/IosList";
import { BRAND, BrandTile, type Brand } from "@/components/brandLogos";

/**
 * The pieces of "Where customers write" (A-253): one row per place, each
 * either Connect or ✓ Connected, and a small window when a connected one is
 * tapped. Shared by the channels (Connections.tsx) and the CRM row
 * (CrmConfig.tsx) so every row reads the same.
 */

export type Glyph = "email" | "gmail" | "outlook" | "instagram" | "messenger" | "facebook" | "whatsapp" | "web" | "crm";

/** The glyph, in currentColor (17px, white on its tile, A-273). */
export function ConnectionGlyph({ glyph }: { glyph: Glyph }) {
  const common = { viewBox: "0 0 24 24", width: 17, height: 17, fill: "none", stroke: "currentColor", strokeWidth: 2.1, "aria-hidden": true } as const;
  switch (glyph) {
    case "email":
    case "gmail":
    case "outlook":
      return (
        <svg {...common} strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="M3.5 6.5 12 13l8.5-6.5" />
        </svg>
      );
    case "instagram":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.3" cy="6.7" r="0.6" fill="currentColor" />
        </svg>
      );
    case "messenger":
    case "facebook":
      return (
        <svg {...common} strokeLinejoin="round">
          <path d="M12 3C7 3 3 6.7 3 11.4c0 2.6 1.2 4.9 3.2 6.4V21l3-1.6c.9.3 1.8.4 2.8.4 5 0 9-3.7 9-8.4S17 3 12 3Z" />
          <path d="m7.5 13.5 3-3.2 2.2 2.2 3.8-2.2-3 3.2-2.2-2.2z" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg {...common} strokeLinejoin="round">
          <path d="M4 20l1.2-3.6A8.5 8.5 0 1 1 8 19z" />
          <path d="M9 8.6c0 3.5 2.9 6.4 6.4 6.4l1-1.3-1.9-1-1 .9a5 5 0 0 1-2.6-2.6l.9-1-1-1.9z" />
        </svg>
      );
    case "web":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3Z" />
        </svg>
      );
    case "crm":
      return (
        <svg {...common} strokeLinejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M4 9.5h16M9.5 9.5V20" />
        </svg>
      );
  }
}

/** Each place's own colour on its tile, like an iOS Settings row (A-273). Dark enough for a white glyph. */
export const GLYPH_BG: Record<Glyph, string> = {
  email: "#2f6fe0",
  gmail: "#2f6fe0",
  // Outlook's blue, under the envelope, until Microsoft's own Outlook logo file is added (brandLogos.tsx).
  outlook: "#0078d4",
  facebook: "#1d6ff2",
  instagram: "#c13584",
  messenger: "#1d6ff2",
  whatsapp: "#1e8e3e",
  web: "#5f6670",
  crm: "#0d6e3c",
};

export function GlyphTile({ glyph }: { glyph: Glyph }) {
  // The place's own logo wherever there is one (founder 2026-10-17, A-276).
  if (glyph in BRAND) return <BrandTile brand={glyph as Brand} />;
  return (
    <IconTile bg={GLYPH_BG[glyph]}>
      <ConnectionGlyph glyph={glyph} />
    </IconTile>
  );
}

/** The group of rows: one white box, rows split by a hairline (iOS inset grouped, A-273). */
export const BOX = GROUP;

/** Connect / Add / Reconnect: outlined, never black, because a page can hold several (A-253). 44px tall. */
export const PILL =
  "inline-flex min-h-11 shrink-0 items-center rounded-full border border-line-strong bg-card px-[18px] text-[15px] font-semibold text-ink hover:bg-card-2 disabled:opacity-60";

/** "✓ Connected", in the green the app uses for done. */
export function ConnectedMark() {
  return <span className="ios-subhead inline-flex shrink-0 items-center whitespace-nowrap text-sage">✓ Connected</span>;
}

/** Something stopped and needs the owner: the orange dot and one word, never colour alone (A-253). */
export function NeedsMark({ word }: { word: string }) {
  return (
    <span className="ios-subhead inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
      <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: "var(--state-needs)" }} />
      {word}
    </span>
  );
}

/**
 * One place customers write. A row that opens its window is one button
 * (connected, or broken); a row with an action keeps the action as its own
 * control, so nothing nests a button inside a button.
 */
export function ConnectionRow({
  glyph,
  name,
  sub,
  first,
  onOpen,
  mark,
  action,
}: {
  glyph: Glyph;
  name: string;
  sub?: string | null;
  first?: boolean;
  /** The whole row opens the place's window (connected or broken). */
  onOpen?: () => void;
  /** What the row says on the right when it opens a window: ConnectedMark or NeedsMark. */
  mark?: ReactNode;
  /** The row's own action when there is no window yet: a Connect link, an Add button, "Soon". */
  action?: ReactNode;
}) {
  return onOpen ? (
    <ListRow icon={<GlyphTile glyph={glyph} />} label={name} sub={sub} first={first} onClick={onOpen} trailing={mark} />
  ) : (
    <ListRow icon={<GlyphTile glyph={glyph} />} label={name} sub={sub} first={first} trailing={action} />
  );
}

/** A place that has no one-tap connect yet. Never a token box instead (R-115). */
export function Soon() {
  return <span className="shrink-0 text-[15px] text-ink-faint">Soon</span>;
}

/**
 * The window a connected place opens (A-253): who it's connected as, one
 * line of what happens, then Done and Disconnect. On a phone it rises as a
 * sheet (AppWindow).
 */
export function ConnectionSheet({
  label,
  glyph,
  title,
  status,
  children,
  onClose,
  primary,
  onDisconnect,
  disconnectLabel,
  busy = false,
}: {
  label: string;
  glyph: Glyph;
  title: string;
  /** Under the title: "✓ Connected as …", or what's wrong. */
  status?: ReactNode;
  children?: ReactNode;
  onClose: () => void;
  /** The window's one black button, when it isn't Done (Copy the code). Done becomes a quiet word. */
  primary?: ReactNode;
  onDisconnect?: () => void;
  disconnectLabel?: string;
  busy?: boolean;
}) {
  return (
    <AppWindow label={label} size="small" onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center gap-3.5 pr-8">
          <GlyphTile glyph={glyph} />
          <div className="min-w-0">
            <p className="text-[20px] font-semibold leading-tight">{title}</p>
            {status}
          </div>
        </div>
        {children}
        <div className="mt-6 flex flex-col items-center gap-1">
          {primary ?? (
            <button type="button" onClick={onClose} className="min-h-[50px] w-full rounded-full bg-ink text-[16px] font-semibold text-on-accent">
              Done
            </button>
          )}
          {primary && (
            <button type="button" onClick={onClose} className="min-h-11 text-[15px] text-ink-soft hover:text-ink">
              Done
            </button>
          )}
          {onDisconnect && (
            <button type="button" onClick={onDisconnect} disabled={busy} className="min-h-11 text-[15px] disabled:opacity-60" style={{ color: "var(--coral)" }}>
              {disconnectLabel}
            </button>
          )}
        </div>
      </div>
    </AppWindow>
  );
}

/** "✓ Connected as priya@example.com", under a window's title. */
export function ConnectedAs({ who }: { who?: string | null }) {
  return <p className="mt-0.5 break-words text-[15px] font-semibold text-sage">✓ Connected{who ? ` as ${who}` : ""}</p>;
}
