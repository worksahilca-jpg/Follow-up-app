"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The routine pile, offered as one action instead of forty things to read.
 *
 * Founder, 2026-09-23: "for those who need less attention he should let
 * them know that we can follow up in one click only if they want and they
 * are safe to send."
 *
 * ## What this must never become
 *
 * A confident button. Everything about the design here is aimed at the
 * moment AFTER the press, not before it: the press itself is easy to
 * make feel good, and the thing that actually loses an owner's trust is
 * a button that said "Send 43" and then quietly sent 31.
 *
 * So the result is reported in full, and a refusal is reported BY NAME
 * with the sentence the send path wrote for it. The commonest refusal —
 * a Meta DM window that has closed — is something the owner can act on
 * personally, and collapsing it to "12 skipped" throws away the only
 * useful part of it.
 *
 * `--rust` is spent on the whole-queue button only (see ApprovalQueue),
 * never here: A-006 holds the accent back for the single thing an owner
 * should act on, and five per-source buttons in accent would be five
 * single things.
 */
type Outcome = {
  sent: number;
  skipped: Array<{ leadId: string; leadName: string; reason: string }>;
  remaining: number;
};

export default function SafePileAction({
  count,
  source,
  accent = false,
}: {
  count: number;
  /** One source, or null for the whole queue. */
  source: string | null;
  /** The one accented button on the screen. See A-006. */
  accent?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendAll() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/approvals/send-safe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(source ? { source } : {}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message ?? "Couldn't send those.");
        return;
      }
      setOutcome({ sent: data.sent, skipped: data.skipped ?? [], remaining: data.remaining ?? 0 });
      // The queue these came from is now stale — the sent ones have
      // dropped out of it. Refresh rather than hide them locally, so what
      // is on screen is what the server actually has.
      router.refresh();
    } catch {
      setError("Couldn't reach FollowUp. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (outcome) {
    return (
      <div className="text-sm">
        <p className="font-medium">
          {outcome.sent === 0 ? "Nothing went out." : `Sent ${outcome.sent}.`}
          {outcome.remaining > 0 && (
            <span className="font-normal text-ink-soft">
              {" "}
              {outcome.remaining} still to go — press again to send the next batch.
            </span>
          )}
        </p>
        {outcome.skipped.length > 0 && (
          <div className="mt-2">
            <p className="text-xs font-medium text-ink-soft">
              {outcome.skipped.length === 1 ? "One is still waiting for you:" : `${outcome.skipped.length} are still waiting for you:`}
            </p>
            <ul className="mt-1 space-y-1">
              {outcome.skipped.slice(0, 5).map((s) => (
                <li key={s.leadId} className="text-xs text-ink-soft leading-relaxed">
                  <span className="font-medium text-ink">{s.leadName}</span> — {s.reason}
                </li>
              ))}
            </ul>
            {outcome.skipped.length > 5 && (
              <p className="mt-1 text-xs text-ink-soft">and {outcome.skipped.length - 5} more.</p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={sendAll}
        disabled={busy || count === 0}
        className={`rounded-lg px-3.5 py-1.5 text-sm font-medium disabled:opacity-60 ${accent ? "btn-shine" : ""}`}
        // `--ink`, not `--rust`, and deliberately. A-006's sixth axis
        // ("accent held back — spent once") assumed the navy-era blue
        // accent; in the current system `--rust` resolves through
        // `--accent` to #0a0a0a, the same value as `--ink`. Naming the
        // accent token here would claim a distinction the tokens no
        // longer draw, and would quietly break if the accent is ever
        // given a hue again. The hierarchy is carried by place and
        // weight instead: this button sits in its own box above every
        // group, under a sentence that says what it does, while the
        // per-source buttons are quiet `--card-2`.
        style={
          accent
            ? { backgroundColor: "var(--ink)", color: "var(--paper)" }
            : { backgroundColor: "var(--card-2)", color: "var(--ink)" }
        }
      >
        {busy ? "Sending…" : `Send ${count === 1 ? "it" : `all ${count}`}`}
      </button>
      {error && (
        <p className="mt-1.5 text-xs" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
