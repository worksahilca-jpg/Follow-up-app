"use client";

import { useState } from "react";
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
}: {
  leadId: string;
  initialTier: AutomationTier;
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
      setConfirmingAutonomous(true);
      return;
    }
    save(next);
  }

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: "var(--slate-soft)" }}>
      <h3 className="text-sm font-semibold" style={{ color: "var(--slate)" }}>
        Automation
      </h3>
      <div className="mt-3 flex rounded-lg border border-line overflow-hidden">
        {TIERS.map((t) => (
          <button
            key={t.value}
            onClick={() => select(t.value)}
            disabled={saving}
            className="flex-1 px-2 py-1.5 text-xs font-medium disabled:opacity-60"
            style={{
              backgroundColor: tier === t.value ? "var(--rust)" : "transparent",
              color: tier === t.value ? "white" : "var(--ink-soft)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-xs mt-2 text-ink-soft leading-relaxed">{DESCRIPTIONS[tier]}</p>
      {tier !== "off" && (
        <p className="text-xs mt-2 text-ink-soft leading-relaxed">
          The moment this lead replies, the silence clock resets — it won&apos;t auto-send again until they&apos;ve
          gone quiet for the full window once more.
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
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
              style={{ backgroundColor: "var(--coral)" }}
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
