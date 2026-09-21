"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import type { AutomationTier } from "@/lib/types";

// research/product/2026-09-10-ux-simplification.md §4: plain-language
// terms lead, the mechanism (what it's actually called elsewhere in the
// product — "Off"/"Assisted"/"Autonomous") lives in the fuller sentence
// below instead of being the first thing an owner has to learn.
const TIERS: { value: AutomationTier; label: string }[] = [
  { value: "off", label: "I'll do it myself" },
  { value: "assisted", label: "Ask if risky" },
  { value: "autonomous", label: "Handle it all" },
];

const DESCRIPTIONS: Record<AutomationTier, string> = {
  off: "I'll handle this one myself — FollowUp won't message this person at all. Nothing sends without you writing it.",
  assisted:
    "Ask me first if it's risky — FollowUp replies for you on the easy stuff, and asks your OK before " +
    "anything about price, terms, or a tense conversation.",
  autonomous:
    "Handle it all, don't ask — every reply sends automatically with no review, including price and tense " +
    "conversations. Only for leads you're comfortable letting go.",
};

// What each tier means on an account that holds everything (see the
// holdAllForApproval prop below). The difference is real, not cosmetic:
// "off" still means FollowUp writes nothing at all, while the other two
// still decide WHETHER a draft gets written and how far it will go once
// holding is lifted. So the tier is worth choosing — it just never sends
// by itself today, and saying otherwise was a lie in three places.
const HELD_DESCRIPTIONS: Record<AutomationTier, string> = {
  off: "I'll handle this one myself — FollowUp won't write or send anything for this person.",
  assisted:
    "FollowUp writes the follow-up and puts it in your approval queue. Nothing reaches this person until you " +
    "read it and press send.",
  autonomous:
    "FollowUp writes every follow-up, including price and tense conversations, and puts each one in your " +
    "approval queue. Nothing reaches this person until you press send.",
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
    <div className="rounded-[var(--radius-box)] p-4" style={{ backgroundColor: "var(--slate-soft)" }}>
      <h3 className="text-sm font-semibold" style={{ color: "var(--slate)" }}>
        Automation
      </h3>
      <div className="mt-3 flex rounded-lg border border-line overflow-hidden">
        {TIERS.map((t) => {
          const locked = t.value === "autonomous" && !autonomousAllowed;
          return (
            <button
              key={t.value}
              onClick={() => select(t.value)}
              disabled={saving || locked}
              title={locked ? "Handle it all needs Plus or Pro" : undefined}
              className="flex-1 px-2 py-1.5 text-xs font-medium disabled:opacity-60 inline-flex items-center justify-center gap-1"
              style={{
                backgroundColor: tier === t.value ? "var(--rust)" : "transparent",
                color: tier === t.value ? "white" : "var(--ink-soft)",
              }}
            >
              {locked && <Lock className="h-3 w-3" />}
              {t.label}
            </button>
          );
        })}
      </div>
      {!autonomousAllowed && tier !== "autonomous" && (
        <p className="text-xs mt-2 text-ink-soft">
          &quot;Handle it all&quot; needs Plus or Pro — see Billing in Settings.
        </p>
      )}
      <p className="text-xs mt-2 text-ink-soft leading-relaxed">
        {holdAllForApproval ? HELD_DESCRIPTIONS[tier] : DESCRIPTIONS[tier]}
      </p>
      {/* Said once, under the control it changes the meaning of, rather
          than folded into each tier's sentence — it is a fact about the
          account, not about this lead, and repeating it three times would
          read as the product arguing with itself. */}
      {holdAllForApproval && (
        <p className="text-xs mt-2 leading-relaxed" style={{ color: "var(--slate)" }}>
          While you&apos;re on the beta plan, your account holds every follow-up for your approval — so whichever
          you pick here, you see it before your lead does.
        </p>
      )}
      {tier !== "off" && (
        <p className="text-xs mt-2 text-ink-soft leading-relaxed">
          The moment this lead replies, the silence clock resets — FollowUp won&apos;t{" "}
          {holdAllForApproval ? "write another follow-up" : "auto-send again"} until they&apos;ve gone quiet for the
          full window once more.
        </p>
      )}

      {confirmingAutonomous && (
        <div className="mt-3 rounded-lg p-3" style={{ backgroundColor: "var(--coral-soft)" }}>
          <p className="text-xs" style={{ color: "var(--coral)" }}>
            This lead will send every automated follow-up with no review — including anything that mentions
            pricing or follows a tense conversation. Sure?
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => save("autonomous")}
              disabled={saving}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-on-coral disabled:opacity-60"
              style={{ backgroundColor: "var(--coral-fill)" }}
            >
              Yes, go autonomous
            </button>
            <button
              onClick={() => setConfirmingAutonomous(false)}
              disabled={saving}
              className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs mt-2" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
