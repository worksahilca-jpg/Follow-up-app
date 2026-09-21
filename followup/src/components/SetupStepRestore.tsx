"use client";

import { useEffect, useState } from "react";

/**
 * The way back from "this doesn't apply to me".
 *
 * SetupStepSkip lets an owner retire a setup step they cannot do — a
 * website widget with no website. Without this, that press would be a
 * one-way door: the step disappears from Today and nothing anywhere
 * offers it back. A business that later builds a site would have no way
 * to be reminded, and no way to find out why it stopped being mentioned.
 *
 * It lives in the Settings section for the thing itself rather than in a
 * list of "hidden things" somewhere: the owner who wants the widget back
 * is already on the widget panel, and a separate screen for undoing
 * dismissals is a screen nobody would think to look for
 * (brand-principles.md #4).
 *
 * Renders nothing at all in the normal case — the step is not skipped, so
 * there is nothing to say. It also renders nothing while loading, rather
 * than reserving a spinner, so the panel does not flicker a placeholder
 * for a line most people will never see.
 */
export default function SetupStepRestore({ id, note }: { id: string; note: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/business/setup-step")
      .then((res) => res.json())
      .then((data) => {
        if (live && data?.success) setDismissed((data.dismissedSetupSteps ?? []).includes(id));
      })
      .catch(() => {
        // A failed read means we don't know, and the honest response to not
        // knowing is to say nothing rather than to guess at a state.
      });
    return () => {
      live = false;
    };
  }, [id]);

  if (!dismissed) return null;

  async function restore() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/business/setup-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, dismissed: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't save that — try again.");
      setDismissed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 text-xs text-ink-soft">
      <p>
        {note}{" "}
        <button
          type="button"
          onClick={restore}
          disabled={saving}
          className="inline-flex min-h-11 items-center align-middle text-ink disabled:opacity-60"
        >
          <span className="underline underline-offset-2">{saving ? "Saving…" : "Remind me again"}</span>
        </button>
      </p>
      {error && <p style={{ color: "var(--coral)" }}>{error}</p>}
    </div>
  );
}
