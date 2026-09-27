"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Mail } from "lucide-react";
import CopyEmbedSnippet from "@/components/CopyEmbedSnippet";

/**
 * "Where do your leads come from?"
 *
 * ## The shape this replaces
 *
 * Onboarding asked for one thing: connect Gmail. That was the whole of it.
 * A business running on Instagram DMs had nothing to say yes to, pressed
 * "I'll do this later", and then got told on Today — forever — to connect
 * an inbox it does not have. The same dead end the website-widget step had
 * (fixed 2026-09-21), from the same cause: the product decided which
 * channel mattered instead of asking.
 *
 * Founder, 2026-09-21, on being asked whether the inbox step should be
 * skippable: *"why to skip i mean they should have a proper onboarding
 * process where first we will let them know how this works and thats
 * totaly skipable then we will help them to connect the sources easyly
 * and skipable too if they dont want that source to be added"* — and, on
 * whether a skipped source should be raised again: *"why would we ask
 * agin he will be having the option to connect later too in settings"*.
 *
 * ## Why there are no Skip buttons
 *
 * A row of "Skip" controls beside a row of "Connect" controls is twice the
 * screen for one decision, and brand-principles.md #6 (clutter) rules it
 * out. Skipping here is simply not connecting: whatever is untouched when
 * the owner presses Done is a source they have told us they do not use,
 * and it is never mentioned again. Settings carries all of them
 * permanently, which is what makes "never again" safe rather than final.
 *
 * ## Accent discipline
 *
 * Four connect buttons cannot all be the accent — that is
 * [[rejected#^S-05|S-05]] (a rainbow means nothing) and it would break
 * A-006's "accent held back". Every row's button is the same quiet
 * outline, and the screen's one primary is Done at the foot, in `--ink`
 * per A-003.
 *
 * ## What is deliberately not here
 *
 * Zapier and the CRM importers: both need a key or a URL pasted in, so
 * they are one honest line pointing at Settings rather than a button that
 * cannot work here. Named rather than hidden — a source nobody mentions is
 * a source nobody knows about.
 *
 * WhatsApp WAS in that sentence, for one day. It connects through Meta's
 * Embedded Signup, a JavaScript popup rather than a link, and that
 * mechanism lived inside the Settings panel. Pointing a WhatsApp-only
 * business at a screen it had not reached yet was the worst line on this
 * step, since that is exactly the business this step was rebuilt for. The
 * mechanism now lives in `useWhatsAppSignup` and the row is real: the
 * popup opens here, which is the one connect that never leaves the page.
 */

export type OnboardingSource = {
  id: string;
  name: string;
  /** One line: what this catches. Never a feature list. */
  line: string;
  icon: typeof Mail;
  connected: boolean;
  /** Shown under the name once connected — the account, so it is checkable. */
  connectedNote?: string;
  /** Where Connect goes. Absent when the row expands or acts in place. */
  href?: string;
  /** Connect without leaving the page — WhatsApp's Meta popup is the only
   *  source that works this way, so it gets a button rather than a link. */
  onConnect?: () => void;
  /** Disables the button and says so while a popup-driven connect runs. */
  connecting?: boolean;
  /** A second, quieter way in (Outlook beside Gmail). */
  altHref?: string;
  altLabel?: string;
  /** Rendered inside the row when opened, for a source with nothing to redirect to. */
  expand?: ReactNode;
  /** Something that went wrong on the way back from this source's connect flow. */
  error?: string | null;
  /** A partial result that the owner has to finish elsewhere. */
  note?: string | null;
  /** Called the first time an expanding row is opened. The website form has
   *  no connected state to read back — a snippet someone pastes into their
   *  own site is invisible to us until a lead arrives — so opening it is the
   *  closest honest signal that they mean to use it. */
  onExpand?: () => void;
};

function SourceRow({ source }: { source: OnboardingSource }) {
  const [open, setOpen] = useState(false);
  const Icon = source.icon;

  return (
    <li className="px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
          style={{ backgroundColor: "var(--card-2)", color: "var(--ink)" }}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium">{source.name}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">
            {source.connected && source.connectedNote ? source.connectedNote : source.line}
          </p>
        </div>

        {source.connected ? (
          <span className="inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line px-2.5 text-[12.5px] font-medium">
            <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: "var(--sage)" }} />
            Connected
          </span>
        ) : source.onConnect ? (
          <button
            type="button"
            onClick={source.onConnect}
            disabled={source.connecting}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-line bg-card px-3.5 text-[13.5px] font-medium disabled:opacity-60"
          >
            {source.connecting ? "Waiting…" : "Connect"}
          </button>
        ) : source.expand ? (
          <button
            type="button"
            onClick={() => {
              if (!open) source.onExpand?.();
              setOpen((v) => !v);
            }}
            aria-expanded={open}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-line bg-card px-3.5 text-[13.5px] font-medium"
          >
            Set up
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        ) : (
          <a
            href={source.href}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-line bg-card px-3.5 text-[13.5px] font-medium"
          >
            Connect
          </a>
        )}
      </div>

      {/* An alternative route in, kept quiet so the main one stays the
          obvious path — Outlook beside Gmail is the only case today. */}
      {!source.connected && source.altHref && (
        <a href={source.altHref} className="inline-block mt-2 text-xs text-ink-soft underline underline-offset-2">
          {source.altLabel}
        </a>
      )}

      {source.error && (
        <p className="text-xs mt-2" style={{ color: "var(--coral)" }}>
          {source.error}
        </p>
      )}
      {source.note && <p className="text-xs mt-2 text-ink-soft">{source.note}</p>}

      {open && source.expand && <div className="mt-3">{source.expand}</div>}
    </li>
  );
}

export default function OnboardingSources({
  sources,
  onDone,
  finishing,
  children,
}: {
  sources: OnboardingSource[];
  onDone: () => void;
  finishing: boolean;
  /** Anything the step adds under the list (the first sync's progress, the learning switch). */
  children?: ReactNode;
}) {
  const connectedCount = sources.filter((s) => s.connected).length;

  return (
    // As OnbConnect: a left-aligned question, every source in one card,
    // one line under it, and the black button at the foot.
    <div className="flex flex-1 flex-col">
      <h1 className="text-[30px] leading-[1.1] tracking-[-0.025em]">Where do customers write to you?</h1>
      <p className="mt-2.5 text-[15.5px] leading-relaxed text-ink-soft">Connect one, and it finds who&apos;s waiting on you.</p>

      <ul className="mt-5 divide-y divide-[var(--line-2)] overflow-hidden rounded-[18px] border border-line bg-card">
        {sources.map((source) => (
          <SourceRow key={source.id} source={source} />
        ))}
      </ul>

      <p className="mt-3.5 text-[13.5px] leading-relaxed text-ink-faint">
        {/* The board's second sentence, "Nothing is sent yet", is left out:
            the instant acknowledgement isn't held back during onboarding,
            so it can't be promised here. */}
        It reads your messages to find your customers. Zapier and your CRM connect from Settings.
      </p>

      {children}

      {/* Always "Continue", never "Skip for now".
          Rendered and looked at: a full-width filled button reading "Skip
          for now" was the loudest thing on the screen, which is an
          instruction to skip — the opposite of what a screen asking a
          question wants. Nothing here blocks the button either way, so the
          skipping does not need announcing; brand-principles.md #5 says the
          plain word beats the clever one. */}
      <div className="mt-auto pb-7 pt-6">
      <button
        onClick={onDone}
        disabled={finishing}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full px-6 text-base font-medium disabled:opacity-60"
        style={{ backgroundColor: "var(--ink)", color: "var(--on-accent)" }}
      >
        {finishing ? "Taking you there…" : "Continue"}
      </button>

      {/* Said once, at the foot, rather than repeated on every row. Someone
          who connects nothing still has a working product — manual entry and
          CSV import need no setup at all — and they should know that before
          they press a button labelled "Skip for now". */}
      {connectedCount === 0 && (
        <p className="mt-3 text-center text-[13px] leading-relaxed text-ink-faint">
          You can still add leads by hand or from a spreadsheet — that needs no setup.
        </p>
      )}
      </div>
    </div>
  );
}

/** The website form's row body: the snippet itself, no redirect needed. */
export function WebsiteFormPanel() {
  return <CopyEmbedSnippet />;
}
