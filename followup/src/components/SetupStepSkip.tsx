"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * "This one doesn't apply to me."
 *
 * Every setup step but one clears by being done. "Add your website
 * widget" cleared only when a lead actually arrived through the widget,
 * so a business with no website could never finish setup — the strip
 * asked them, forever, to do something they had no way to do.
 *
 * ## Why it looks like this
 *
 * Quiet on purpose. It sits beside the real action, in `text-ink-soft`
 * with no border and no fill, because it is the answer for a minority and
 * it must not compete with the thing most people should actually do
 * (brand-principles.md #4: the most important thing is the biggest and
 * first). A second filled button next to the first would read as a choice
 * between two equal options.
 *
 * No confirmation dialog. It is reversible — Settings can un-skip it —
 * and a modal to confirm "I don't have a website" would be the kind of
 * ceremony that makes a product feel heavy for no gain. DeleteLeadButton
 * has one because deleting a conversation is not reversible; this is not
 * that.
 *
 * The failure message is a sentence, not a toast: the strip is already
 * the quietest thing on Today, and something that failed silently would
 * leave the owner pressing a control that appears to do nothing.
 */
export default function SetupStepSkip({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function skip() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/business/setup-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, dismissed: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't save that — try again.");
      router.refresh();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Couldn't save that — try again.");
    }
  }

  return (
    <div className="sm:shrink-0">
      {/* The underline lives on the inner span, not the button, so the
          button can carry a 44px-tall hit area (the accessibility floor for
          a touch target) without a rule appearing under empty padding.
          Rendered at a 358px content width it was 116×16px — legible, and
          a genuinely hard thing to hit with a thumb. */}
      <button
        type="button"
        onClick={skip}
        disabled={saving}
        className="inline-flex min-h-11 items-center text-xs text-ink-soft hover:text-ink disabled:opacity-60"
      >
        <span className="underline underline-offset-2">{saving ? "Saving…" : label}</span>
      </button>
      {error && (
        <p className="text-xs mt-1" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
