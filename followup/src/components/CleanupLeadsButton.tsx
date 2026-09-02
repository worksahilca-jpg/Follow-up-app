"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wand2 } from "lucide-react";

interface CleanupResult {
  checked: number;
  removedCount: number;
  removed: { id: string; name: string; reason: string }[];
}

/**
 * One-time backlog cleaner: re-runs the AI prospect check against leads
 * that were synced in before that check existed, and deletes the ones
 * that fail it. Separate from DeleteLeadButton, which removes one lead a
 * user has already looked at and judged themselves.
 *
 * The confirm/result panel is absolutely positioned under the button
 * (dropdown-style) so opening it doesn't reflow the header's button row.
 */
export default function CleanupLeadsButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setResult(null);
    setError(null);
  }

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/leads/cleanup", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message ?? "Clean-up failed — try again.");
      setResult({ checked: data.checked, removedCount: data.removedCount, removed: data.removed });
      if (data.removedCount > 0) router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clean-up failed — try again.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium border border-line"
      >
        <Wand2 className="h-4 w-4" />
        Clean up leads
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-line bg-card p-4 shadow-lg z-10"
          style={result ? undefined : { borderColor: "var(--rust)", backgroundColor: "var(--rust-soft)" }}
        >
          {result ? (
            <>
              <p className="text-sm">
                {result.removedCount === 0
                  ? `Checked ${result.checked} lead${result.checked === 1 ? "" : "s"} — nothing looked wrong.`
                  : `Removed ${result.removedCount} of ${result.checked} leads that weren't real sales conversations.`}
              </p>
              {result.removed.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-ink-soft max-h-40 overflow-y-auto">
                  {result.removed.map((r) => (
                    <li key={r.id}>
                      <span className="font-medium">{r.name}</span> — {r.reason}
                    </li>
                  ))}
                </ul>
              )}
              <button onClick={close} className="mt-3 text-xs underline text-ink-soft">
                Dismiss
              </button>
            </>
          ) : (
            <>
              <p className="text-sm" style={{ color: "var(--rust)" }}>
                This re-checks every Gmail-sourced lead against the AI and deletes the ones that aren&apos;t
                real sales conversations. Can&apos;t be undone.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={run}
                  disabled={running}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                  style={{ backgroundColor: "var(--rust)" }}
                >
                  {running ? "Checking…" : "Yes, clean up"}
                </button>
                <button
                  onClick={close}
                  disabled={running}
                  className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
              {error && (
                <p className="text-xs mt-2" style={{ color: "var(--rust)" }}>
                  {error}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
