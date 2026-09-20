"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * "This channel is connected, but nothing is coming through it."
 *
 * One block, one grammar, for every channel that can reach that state.
 * It exists because the state itself keeps recurring: Meta only delivers
 * a Page's or an account's events to an app subscribed to THAT Page or
 * account, and a subscription can fail while the connection itself
 * succeeds — leaving a token saved, a name resolved, and a green tick on
 * something that will never receive a message.
 *
 * Written as a shared component rather than a paragraph per channel
 * after Facebook and Instagram were found to need the identical sentence
 * two days running (design-decisions, 2026-09-20). Settings already
 * carries six channel panels; six bespoke explanations of the same
 * failure is how a settings page stops being readable.
 *
 * `--coral` on `--coral-soft` per [[approved#^A-005]]: the approved
 * warning pair, not `--gold`, which is reserved for "going cold".
 */
export default function ChannelNotReceiving({
  platform,
  subject,
  missed,
  otherCause,
  retryPath,
  onReceiving,
}: {
  /** "Facebook" / "Instagram" — the name the owner uses, not ours. */
  platform: string;
  /** What is linked, in their words: a Page name, an account. Falls back gracefully. */
  subject: string;
  /** What is being lost, e.g. "nothing people send the Page reaches FollowUp". */
  missed: string;
  /** The non-review explanation, e.g. "you no longer manage the Page". */
  otherCause: string;
  /** POST here with no body to try the subscription again. */
  retryPath: string;
  /** Called when the retry succeeds, so the parent can flip to its connected view. */
  onReceiving: () => void;
}) {
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setRetrying(true);
    setError(null);
    try {
      const res = await fetch(retryPath, { method: "POST" });
      const data: { success: boolean; message?: string } = await res.json();
      if (data.success) onReceiving();
      // Meta's own sentence, shown as it came: it names the missing
      // permission or the lost role, which is what to act on. A
      // paraphrase would lose exactly the useful part.
      else setError(data.message ?? `${platform} turned it down again.`);
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: "var(--coral-soft)" }}>
      <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--coral)" }}>
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {platform} isn&apos;t sending messages through yet
      </p>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--coral)" }}>
        {subject} is linked, but {platform} hasn&apos;t switched the connection on — so {missed}. This usually clears
        once Meta approves the app; it can also mean {otherCause}.
      </p>
      {error && (
        <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--coral)" }}>
          {platform} said: {error}
        </p>
      )}
      <button
        onClick={retry}
        disabled={retrying}
        className="mt-2 rounded-lg px-3 py-1.5 text-xs font-medium text-paper disabled:opacity-60"
        style={{ backgroundColor: "var(--ink)" }}
      >
        {retrying ? "Checking…" : "Try again"}
      </button>
    </div>
  );
}
