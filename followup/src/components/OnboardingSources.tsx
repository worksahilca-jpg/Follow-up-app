"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronDown, Mail } from "lucide-react";
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
    <li className="box px-4 py-3">
      <div className="flex items-center gap-3">
        <div
          className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center"
          style={
            source.connected
              ? { backgroundColor: "var(--sage-soft)", color: "var(--sage)" }
              : { backgroundColor: "var(--card)", color: "var(--ink-soft)" }
          }
        >
          {source.connected ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{source.name}</p>
          <p className="text-xs text-ink-soft mt-0.5">
            {source.connected && source.connectedNote ? source.connectedNote : source.line}
          </p>
        </div>

        {source.connected ? (
          <span className="text-xs shrink-0" style={{ color: "var(--sage)" }}>
            Connected
          </span>
        ) : source.onConnect ? (
          <button
            type="button"
            onClick={source.onConnect}
            disabled={source.connecting}
            className="shrink-0 inline-flex min-h-11 items-center rounded-lg border border-line px-3 text-sm font-medium disabled:opacity-60"
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
            className="shrink-0 inline-flex min-h-11 items-center gap-1 rounded-lg border border-line px-3 text-sm font-medium"
          >
            Set up
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        ) : (
          <a
            href={source.href}
            className="shrink-0 inline-flex min-h-11 items-center rounded-lg border border-line px-3 text-sm font-medium"
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
}: {
  sources: OnboardingSource[];
  onDone: () => void;
  finishing: boolean;
}) {
  const connectedCount = sources.filter((s) => s.connected).length;

  return (
    <div className="mt-8">
      <h2 className="font-display text-xl text-center">Where do your leads come from?</h2>
      <p className="text-sm text-ink-soft text-center mt-2 leading-relaxed">
        Connect the ones you use. Leave the rest — FollowUp won&apos;t ask about them again, and they&apos;re all
        in Settings whenever you want them.
      </p>

      <ul className="mt-5 space-y-2">
        {sources.map((source) => (
          <SourceRow key={source.id} source={source} />
        ))}
      </ul>

      <p className="text-xs text-ink-soft mt-3 leading-relaxed">
        Zapier and your CRM connect from Settings — each needs a key or a URL pasted in.
      </p>

      {/* Always "Continue", never "Skip for now".
          Rendered and looked at: a full-width filled button reading "Skip
          for now" was the loudest thing on the screen, which is an
          instruction to skip — the opposite of what a screen asking a
          question wants. Nothing here blocks the button either way, so the
          skipping does not need announcing; brand-principles.md #5 says the
          plain word beats the clever one. */}
      <button
        onClick={onDone}
        disabled={finishing}
        className="w-full mt-5 rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-60"
        style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
      >
        {finishing ? "Taking you there…" : "Continue"}
      </button>

      {/* Said once, at the foot, rather than repeated on every row. Someone
          who connects nothing still has a working product — manual entry and
          CSV import need no setup at all — and they should know that before
          they press a button labelled "Skip for now". */}
      {connectedCount === 0 && (
        <p className="text-xs text-ink-soft text-center mt-3 leading-relaxed">
          You can still add leads by hand or from a spreadsheet — that needs no setup.
        </p>
      )}
    </div>
  );
}

/** The website form's row body: the snippet itself, no redirect needed. */
export function WebsiteFormPanel() {
  return <CopyEmbedSnippet />;
}
