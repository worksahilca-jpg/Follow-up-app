"use client";

import { useEffect, useState } from "react";
import { PenLine } from "lucide-react";

/**
 * The consent switch for using this business's conversations to improve
 * FollowUp (POST /api/business/privacy → Business.allowModelTraining).
 *
 * Two homes, one component: Settings → Your data, and the second step of
 * onboarding (`compact`), where it is asked once, in one sentence, with an
 * easy no. Off by default and stays off until the owner says otherwise —
 * the switch is the consent, so nothing here pre-ticks it or nudges.
 *
 * What it actually turns on today: the AI draft is kept beside what the
 * owner really sent (FollowUp.draftText, src/lib/sending.ts), and the
 * founder reads the difference, de-identified, on /admin each week to fix
 * the drafting instructions. No model is trained on anything yet — see
 * docs/security-roadmap.md — and the copy says exactly that much.
 *
 * The icon is a pen — the replies the owner edits are the subject — never
 * a sparkle standing in for "AI" (rejected.md S-13).
 */
export default function ImproveFollowUpToggle({ compact = false }: { compact?: boolean }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/business/privacy")
      .then((r) => r.json())
      .then((data: { success: boolean; allowModelTraining?: boolean }) => {
        if (data.success) setOn(!!data.allowModelTraining);
      })
      .catch(() => setOn(false));
  }, []);

  async function toggle() {
    if (on === null || busy) return;
    const next = !on;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/business/privacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowModelTraining: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };
      if (!res.ok || !data.success) throw new Error(data.message || "Couldn't save — try again.");
      setOn(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save — try again.");
    } finally {
      setBusy(false);
    }
  }

  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={!!on}
      aria-label="Help improve FollowUp"
      onClick={toggle}
      disabled={on === null || busy}
      className="relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-60"
      style={{ backgroundColor: on ? "var(--rust)" : "var(--line)" }}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full transition-transform"
        style={{ transform: on ? "translateX(22px)" : "translateX(2px)", backgroundColor: on ? "var(--on-accent)" : "var(--ink)" }}
      />
    </button>
  );

  if (compact) {
    return (
      <div className="flex items-start justify-between gap-4 text-left">
        <div className="min-w-0">
          <p className="text-sm font-medium">Help improve FollowUp</p>
          <p className="text-xs text-ink-soft mt-0.5">
            Let us learn from the replies you edit. Names and contact details are removed first. Off unless you
            turn it on; change it any time in Settings.
          </p>
          {error && (
            <p className="mt-1 text-xs" style={{ color: "var(--coral)" }}>
              {error}
            </p>
          )}
        </div>
        {control}
      </div>
    );
  }

  return (
    <div className="box p-5">
      <div className="flex items-center gap-4">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}>
          <PenLine className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Help improve FollowUp</p>
          <p className="text-xs text-ink-soft mt-0.5">
            When on, FollowUp keeps the draft it wrote next to what you actually sent, so we can see where its
            wording was wrong and fix it. Names, emails, phone numbers and addresses are removed before anyone
            reads it. Nothing is shared outside FollowUp, and no model is trained on it yet.
          </p>
          {error && (
            <p className="mt-1 text-xs" style={{ color: "var(--coral)" }}>
              {error}
            </p>
          )}
        </div>
        {control}
      </div>
    </div>
  );
}
