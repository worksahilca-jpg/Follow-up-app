"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * "We talked" on a lead's page (design brain A-039). One tap, no confirm:
 * Undo is the safety net, and it stays next to the status for as long as
 * the talk is what is holding FollowUp back. See src/lib/talked.ts.
 */
export default function WeTalkedButton({ leadId, leadName, talked }: { leadId: string; leadName: string; talked: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = leadName.split(" ")[0] || leadName;

  async function save(undo: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/talked`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(undo ? { undo: true } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(typeof data.message === "string" ? data.message : "Couldn't save that. Try again.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {talked ? (
        <button
          type="button"
          onClick={() => save(true)}
          disabled={busy}
          className="min-h-[44px] px-1 font-medium underline underline-offset-2 disabled:opacity-60"
        >
          {busy ? "…" : "Undo"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => save(false)}
          disabled={busy}
          title={`You spoke with ${first} on a call or in person. FollowUp stops checking in until ${first} writes again.`}
          className="min-h-[44px] px-1 text-ink-soft underline underline-offset-2 hover:text-ink disabled:opacity-60"
        >
          {busy ? "…" : "We talked"}
        </button>
      )}
      {error && (
        <span className="text-xs" style={{ color: "var(--coral)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
