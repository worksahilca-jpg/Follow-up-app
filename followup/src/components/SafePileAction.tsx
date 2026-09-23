"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUndoableSend } from "@/components/useUndoableSend";

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
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * The grace period, the gate, the clock and the leaving-sends rule all
   * live in `useUndoableSend` now. They used to live here, and were
   * about to be copied verbatim onto the single "Approve & send" on each
   * approval card — sixty lines where every branch is load-bearing and a
   * difference between two copies would show up as messages sent or not
   * sent, never as a failing test. The reasoning behind each guarantee,
   * including the contestable one (leaving the page sends, it does not
   * cancel), moved with them and is written out in that file.
   *
   * What stays here is what is specific to a batch: the outcome, in
   * full, with every refusal named.
   */
  const send = useUndoableSend({
    url: "/api/approvals/send-safe",
    body: JSON.stringify(source ? { source } : {}),
    onResponse: async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(typeof data.message === "string" ? data.message : "Couldn't send those.");
        return;
      }
      setOutcome({ sent: data.sent, skipped: data.skipped ?? [], remaining: data.remaining ?? 0 });
      // The queue these came from is now stale — the sent ones have
      // dropped out of it. Refresh rather than hide them locally, so what
      // is on screen is what the server actually has.
      router.refresh();
    },
    onNetworkError: () => setError("Couldn't reach FollowUp. Check your connection and try again."),
  });

  function startCountdown() {
    setError(null);
    send.start();
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

  // The grace period, in place of the button that started it. Replacing
  // the button rather than sitting beside it means there is exactly one
  // control here at a time and it is the one that undoes the press —
  // nothing to press twice, nothing to press by mistake.
  if (send.pending) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm">
          {/* "Sending", present tense, and a number of seconds. Not
              "Sent" — nothing has gone yet and the whole point of this
              state is that it is still stoppable. */}
          Sending {count === 1 ? "it" : `all ${count}`} in {send.secs}s
        </p>
        <button
          onClick={send.undo}
          className="rounded-lg px-3 py-1.5 text-sm font-medium border"
          style={{ borderColor: "var(--line)", color: "var(--ink)" }}
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={startCountdown}
        disabled={send.busy || count === 0}
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
        {send.busy ? "Sending…" : `Send ${count === 1 ? "it" : `all ${count}`}`}
      </button>
      {send.cancelled && (
        // Says what IS true (nothing left) rather than "Cancelled",
        // which describes the press instead of the outcome. An owner who
        // pressed Undo wants to know the customers were not written to.
        <p className="mt-1.5 text-xs text-ink-soft">Stopped — nothing was sent.</p>
      )}
      {error && (
        <p className="mt-1.5 text-xs" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
