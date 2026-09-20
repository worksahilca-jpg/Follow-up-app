"use client";

import { useState } from "react";
import { AlertTriangle, Clock } from "lucide-react";

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
  stillWorks,
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
  /**
   * What still works without the subscription, when something does.
   *
   * Instagram has a poller (src/lib/instagramPoll.ts) that reads the
   * connected account's conversations every few minutes and feeds them
   * through the same inbound pipeline, whether or not Meta ever confirmed
   * the webhook. It exists precisely because the first real account got
   * no webhook at all. So on Instagram this state is "slower", not
   * "broken" — and the alarm this component shipped with on 2026-09-20
   * told a tester their working channel was dead, which is the fastest
   * way to lose one.
   *
   * Facebook has no such poller, so it passes nothing here and keeps the
   * warning. The prop is the difference in the product, not a style
   * choice: an alarm is correct when nothing arrives, and wrong when
   * something does.
   */
  stillWorks?: string;
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

  // Nothing is being lost, so this is not an alarm. --slate is the
  // system's "waiting, and that is fine" pair (see AutomationStatusBadge's
  // own waiting state); --coral is reserved for needs-attention-now, and
  // spending it here is what made a working channel look broken.
  const tone = stillWorks
    ? { bg: "var(--slate-soft)", fg: "var(--slate)", Icon: Clock }
    : { bg: "var(--coral-soft)", fg: "var(--coral)", Icon: AlertTriangle };

  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: tone.bg }}>
      <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: tone.fg }}>
        <tone.Icon className="h-4 w-4 shrink-0" />
        {stillWorks
          ? `${platform} messages arrive every few minutes, not instantly`
          : `${platform} isn't sending messages through yet`}
      </p>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: tone.fg }}>
        {stillWorks ? (
          <>
            {subject} is linked and working — {stillWorks} So nothing is missed; it just isn&apos;t instant.{" "}
            {platform} hasn&apos;t switched instant delivery on yet, which usually clears once Meta approves the app.
          </>
        ) : (
          <>
            {subject} is linked, but {platform} hasn&apos;t switched the connection on — so {missed}. This usually
            clears once Meta approves the app; it can also mean {otherCause}.
          </>
        )}
      </p>
      {error && (
        <p className="mt-2 text-xs leading-relaxed" style={{ color: tone.fg }}>
          {platform} said: {error}
        </p>
      )}
      <button
        onClick={retry}
        disabled={retrying}
        className="mt-2 rounded-lg px-3 py-1.5 text-xs font-medium text-paper disabled:opacity-60"
        style={{ backgroundColor: "var(--ink)" }}
      >
        {retrying ? "Checking…" : stillWorks ? "Try for instant delivery" : "Try again"}
      </button>
    </div>
  );
}
