"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { UNDO_WINDOW_MS, secondsLeft, createSendGate } from "@/lib/undoWindow";

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
  // Non-null only while the grace period is running. Holding the END
  // TIME rather than a remaining count means a backgrounded tab that
  // stops firing intervals still resolves correctly when it wakes:
  // the clock is the source of truth, not an accumulated tick count.
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [secs, setSecs] = useState(0);
  const [cancelled, setCancelled] = useState(false);
  // One gate per press. Both the timer and the Undo button claim it, and
  // exactly one of them wins — see @/lib/undoWindow.
  const gateRef = useRef<ReturnType<typeof createSendGate> | null>(null);

  const body = JSON.stringify(source ? { source } : {});

  async function sendAll() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/approvals/send-safe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
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

  // Claim the gate and go. Wrapped in useCallback because the unmount
  // effect below depends on it and must not re-run on every render.
  const commit = useCallback(() => {
    if (!gateRef.current?.claim()) return;
    setEndsAt(null);
    void sendAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body]);

  // Tick the label, and fire when the clock runs out.
  useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => {
      const left = secondsLeft(endsAt, Date.now());
      setSecs(left);
      if (Date.now() >= endsAt) commit();
    }, 250);
    return () => clearInterval(id);
  }, [endsAt, commit]);

  /**
   * Leaving the page during the grace period SENDS. It does not cancel.
   *
   * This is the one genuinely contestable decision here, so it is
   * written down rather than left to whichever branch happened to be
   * easier. Both directions lose something:
   *
   *   - Cancel on leave, and an owner who presses Send and shuts the
   *     laptop believes forty follow-ups went out when none did. They
   *     find out days later, from the leads that went cold.
   *   - Send on leave, and an owner who was trying to cancel BY closing
   *     the tab sends forty messages they did not want.
   *
   * The second person does not exist in the way the first does. There is
   * a button on screen that says Undo; someone who wants to cancel
   * presses it. Closing a laptop mid-countdown means "I am done here",
   * not "stop". And the first failure is the exact one this component's
   * docstring already forbids — a button that said "Send 43" and then
   * quietly sent nothing.
   *
   * `pagehide` rather than `beforeunload`: mobile Safari and Chrome
   * routinely never fire `beforeunload`, and the ICP is on a phone.
   * `sendBeacon` because a normal fetch is abandoned when the document
   * goes away — this is precisely what the API exists for.
   */
  useEffect(() => {
    if (endsAt === null) return;
    const flush = () => {
      if (!gateRef.current?.claim()) return;
      navigator.sendBeacon?.("/api/approvals/send-safe", new Blob([body], { type: "application/json" }));
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      // Unmounting for any other reason — a client-side navigation away
      // from the dashboard — is the same promise. The document is still
      // alive here, so the ordinary request works and nothing is lost.
      if (gateRef.current?.claim()) {
        void fetch("/api/approvals/send-safe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        });
      }
    };
  }, [endsAt, body]);

  function startCountdown() {
    setError(null);
    setCancelled(false);
    gateRef.current = createSendGate();
    const end = Date.now() + UNDO_WINDOW_MS;
    // Seeded here rather than in the effect, so the first paint of the
    // countdown already shows the full window. Seeding it in the effect
    // renders one frame of whatever the previous press left behind.
    setSecs(secondsLeft(end, Date.now()));
    setEndsAt(end);
  }

  function undo() {
    // Loses to a timer that already fired. When that happens the send is
    // under way and saying "cancelled" would be a lie, so nothing here
    // changes the screen — the outcome the send reports is the truth.
    if (!gateRef.current?.claim()) return;
    setEndsAt(null);
    setCancelled(true);
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
  if (endsAt !== null) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm">
          {/* "Sending", present tense, and a number of seconds. Not
              "Sent" — nothing has gone yet and the whole point of this
              state is that it is still stoppable. */}
          Sending {count === 1 ? "it" : `all ${count}`} in {secs}s
        </p>
        <button
          onClick={undo}
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
      {cancelled && (
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
