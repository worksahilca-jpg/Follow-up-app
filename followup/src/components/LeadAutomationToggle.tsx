"use client";

import { useState } from "react";
import type { AutomationTier } from "@/lib/types";

// research/product/2026-09-10-ux-simplification.md §4: plain-language
// terms lead, the mechanism (what it's actually called elsewhere in the
// product — "Off"/"Assisted"/"Autonomous") lives in the fuller sentence
// below instead of being the first thing an owner has to learn.
const TIERS: { value: AutomationTier; label: string }[] = [
  { value: "off", label: "I’ll do it" },
  { value: "assisted", label: "Ask if risky" },
  { value: "autonomous", label: "Handle it all" },
];

// One sentence each, as the PersonSide board writes it (A-069).
const DESCRIPTIONS: Record<AutomationTier, string> = {
  off: "FollowUp won’t write to them. Every reply is yours.",
  assisted: "It answers the easy things and asks you before anything about a price, a date or a tense moment.",
  autonomous: "It answers everything without asking, prices and dates included. Only for customers you’re happy to hand over.",
};

// What each tier means on an account that holds everything (see the
// holdAllForApproval prop below). The difference is real, not cosmetic:
// "off" still means FollowUp writes nothing at all, while the other two
// still decide WHETHER a draft gets written and how far it will go once
// holding is lifted. So the tier is worth choosing — it just never sends
// by itself today, and saying otherwise was a lie in three places.
const HELD_DESCRIPTIONS: Record<AutomationTier, string> = {
  off: "FollowUp won’t write to them. Every reply is yours.",
  assisted: "It writes the replies and holds them for you. Nothing reaches them until you press Send.",
  autonomous: "It writes every reply, prices and dates included, and holds each one. Nothing reaches them until you press Send.",
};

/**
 * Three-way trust tier instead of a plain on/off switch (see
 * src/lib/automation.ts for what each tier actually does server-side).
 * Switching TO autonomous — the one tier that skips the risk-review gate
 * entirely — needs an explicit confirm; switching to off/assisted (both
 * strictly safer than where the lead might already be) does not.
 */
export default function LeadAutomationToggle({
  leadId,
  initialTier,
  // Whether this business's plan even allows "Handle it all" at all —
  // Free is Assisted-only (research/market/2026-09-11-tier-pricing-
  // recommendation.md), and the API already refuses to set AUTONOMOUS for
  // a Free business (see src/app/api/leads/[id]/automation/route.ts), so
  // the option is disabled here too rather than letting someone pick it
  // and get a 403 with no explanation.
  autonomousAllowed = true,
  // Business.holdAllForApproval — true on every beta account. When it is
  // set, NOTHING this control offers actually sends on its own: both
  // schedulers (automation.ts, sequences.ts) route every draft to the
  // approval queue regardless of the tier chosen here. Until 2026-09-20
  // this control still described autonomous as "every reply sends
  // automatically with no review" and made the owner confirm a red
  // warning to pick it — a scary promise about something their account
  // would never do. The tier still matters (it is what takes effect the
  // day holding is lifted), so it stays choosable; only the sentences
  // change, to describe what will really happen.
  holdAllForApproval = false,
}: {
  leadId: string;
  initialTier: AutomationTier;
  autonomousAllowed?: boolean;
  holdAllForApproval?: boolean;
}) {
  const [tier, setTier] = useState<AutomationTier>(initialTier);
  const [confirmingAutonomous, setConfirmingAutonomous] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: AutomationTier) {
    const previous = tier;
    setSaving(true);
    setError(null);
    setTier(next); // optimistic
    setConfirmingAutonomous(false);
    try {
      const res = await fetch(`/api/leads/${leadId}/automation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't save — try again.");
    } catch (err) {
      setTier(previous); // revert on failure
      setError(err instanceof Error ? err.message : "Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  }

  function select(next: AutomationTier) {
    if (next === tier) return;
    if (next === "autonomous") {
      if (!autonomousAllowed) return;
      // The confirm exists to guard one thing: a reply going out unread.
      // On a holding account that cannot happen, so asking "sure?" about
      // it is a warning with nothing behind it — and a warning people
      // learn to click through is worse than none.
      if (holdAllForApproval) {
        save(next);
        return;
      }
      setConfirmingAutonomous(true);
      return;
    }
    save(next);
  }

  return (
    // Sits inside the side column's "How it handles …" row (A-069), which
    // already names it: no box or heading of its own (S-09, card soup).
    <div>
      <h3 className="sr-only">Automation</h3>
      <div className="flex overflow-hidden rounded-[12px] border border-line">
        {TIERS.map((t) => {
          const locked = t.value === "autonomous" && !autonomousAllowed;
          return (
            <button
              key={t.value}
              onClick={() => select(t.value)}
              disabled={saving || locked}
              title={locked ? "Handle it all comes with Plus or Pro" : undefined}
              aria-pressed={tier === t.value}
              className="flex-1 whitespace-nowrap px-1.5 py-2.5 text-center text-[14px] disabled:cursor-not-allowed"
              style={{
                backgroundColor: tier === t.value ? "var(--ink)" : "transparent",
                color: tier === t.value ? "var(--paper)" : locked ? "var(--ink-faint)" : "var(--ink-soft)",
                fontWeight: tier === t.value ? 500 : 400,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {/* One sentence, as drawn. On a holding account the sentence itself
          says nothing sends without the owner, so the old separate "beta
          plan holds everything" paragraph is folded in rather than
          repeated. The plan limit is one short line, and only when the
          locked option is the reason it can't be picked. */}
      <p className="mt-2.5 text-[14px] leading-normal text-ink-soft">{holdAllForApproval ? HELD_DESCRIPTIONS[tier] : DESCRIPTIONS[tier]}</p>
      {!autonomousAllowed && tier !== "autonomous" && (
        <p className="mt-1.5 text-[13px] text-ink-faint">
          Handle it all comes with Plus or Pro. <a href="/settings#billing" className="underline underline-offset-2">See plans</a>
        </p>
      )}

      {confirmingAutonomous && (
        <div className="mt-3 rounded-[12px] p-3" style={{ backgroundColor: "var(--coral-soft)" }}>
          <p className="text-[13px]" style={{ color: "var(--coral)" }}>
            This lead will send every automated follow-up with no review — including anything that mentions
            pricing or follows a tense conversation. Sure?
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => save("autonomous")}
              disabled={saving}
              className="rounded-full px-2.5 py-1 text-[13px] font-medium text-on-coral disabled:opacity-60"
              style={{ backgroundColor: "var(--coral-fill)" }}
            >
              Yes, go autonomous
            </button>
            <button
              onClick={() => setConfirmingAutonomous(false)}
              disabled={saving}
              className="rounded-full border border-line px-2.5 py-1 text-[13px] font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-[13px] mt-2" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
