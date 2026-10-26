"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ChoiceRow from "@/components/app/ChoiceRow";
import { NOT_NOW_WORDS, type NotNowPlan } from "@/lib/notNow";

/**
 * "When a customer says 'not now', what should FollowUp do?" (A-329, drawn and approved 2026-10-26). Asked once, on the
 * card of the first customer whose maybe-no reads as "not now", to an admin. The answer is the business's rule from
 * then on (Settings › Sending replies changes it); with Ask, this customer's reply is written again to ask when.
 */
export default function NotNowQuestion({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState<NotNowPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(plan: NotNowPlan) {
    setSaving(plan);
    setError(null);
    try {
      const res = await fetch("/api/automation/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notNowPlan: plan, notNowLeadId: leadId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(typeof data.message === "string" ? data.message : "Couldn't save that. Try again.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that. Try again.");
      setSaving(null);
    }
  }

  const labelId = `not-now-${leadId}`;
  return (
    <div className="mt-4">
      <p id={labelId} className="text-[15px] font-semibold leading-snug">
        {NOT_NOW_WORDS.question}
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="mt-2.5 overflow-hidden rounded-[16px] border border-line bg-card">
        <ChoiceRow first checked={saving === "stop"} title={NOT_NOW_WORDS.stop} sub={NOT_NOW_WORDS.stopOnToday} disabled={saving !== null} onSelect={() => choose("stop")} />
        <ChoiceRow checked={saving === "ask"} title={NOT_NOW_WORDS.ask} sub={NOT_NOW_WORDS.askSub} disabled={saving !== null} onSelect={() => choose("ask")} />
      </div>
      <p className="mt-2 text-[13px] leading-snug text-ink-faint" aria-live="polite">
        {saving === "ask" ? "Saving, and writing a new reply that asks when…" : saving ? "Saving…" : NOT_NOW_WORDS.once}
      </p>
      {error && (
        <p role="alert" className="mt-1 text-[13px] text-coral">
          {error}
        </p>
      )}
    </div>
  );
}
