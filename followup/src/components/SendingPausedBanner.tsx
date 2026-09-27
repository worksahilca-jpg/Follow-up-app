"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * "Sending is paused" (design brain A-041, the Today · paused board).
 *
 * Shown at the top of Today while a pause is on, because a paused account
 * that looks like a normal one is how an owner forgets they paused it and
 * wonders why nothing went out. Only an admin can resume; a teammate sees
 * who can.
 */
export default function SendingPausedBanner({ canResume }: { canResume: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resume() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/automation/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(typeof data.message === "string" ? data.message : "Couldn't resume. Try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't reach FollowUp. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="status" className="mt-6 box px-4 py-3 flex flex-wrap items-center justify-between gap-3" style={{ backgroundColor: "var(--card-2)" }}>
      <div className="min-w-0">
        <p className="text-sm font-medium">Sending is paused</p>
        <p className="text-xs text-ink-soft mt-0.5">
          Everything waits for your OK.{canResume ? "" : " An admin can resume it."}
        </p>
        {error && (
          <p className="text-xs mt-1" style={{ color: "var(--coral)" }}>
            {error}
          </p>
        )}
      </div>
      {canResume && (
        <button
          onClick={resume}
          disabled={busy}
          className="shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-medium disabled:opacity-60"
          style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
        >
          {busy ? "Resuming…" : "Resume"}
        </button>
      )}
    </div>
  );
}
