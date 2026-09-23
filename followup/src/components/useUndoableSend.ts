"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { UNDO_WINDOW_MS, secondsLeft, createSendGate } from "@/lib/undoWindow";

/**
 * A press that can still be taken back, for any send in the approval queue.
 *
 * ## Why this is a hook and not a second copy
 *
 * The routine pile got this treatment first (`SafePileAction`), and the
 * single "Approve & send" on each card did not — so the one path an
 * owner actually uses today had no way back. Production, tonight: the
 * largest queue in the whole database is ten held drafts, and seventeen
 * of the twenty across all accounts are unjudged, which means they sit
 * in the needs-you pile and get approved **one at a time**. The grace
 * period was built for the batch and missing from the common case.
 *
 * The obvious fix was to copy the sixty lines across. They are sixty
 * lines of gate, clock, `pagehide` and unmount handling where every
 * branch is load-bearing and a subtle difference between the two copies
 * would show up as messages sent or not sent — never as a failing test.
 * So the timing and the lifecycle live here once, and each caller brings
 * only its own request and its own idea of what "done" looks like.
 *
 * ## What it guarantees
 *
 * 1. **Exactly one send per press.** The timer, the Undo button, the
 *    `pagehide` flush and the unmount flush all race for a single gate
 *    (`createSendGate`), and exactly one wins. Undo losing that race is
 *    not an error — it means the send already left, and the screen must
 *    not claim otherwise.
 * 2. **The clock is the source of truth, not a tick count.** State holds
 *    the END TIME, so a backgrounded tab whose intervals stopped firing
 *    still resolves correctly the moment it wakes.
 * 3. **Leaving the page sends. It does not cancel.** Inherited verbatim
 *    from `SafePileAction`, where the reasoning is written out at
 *    length: an owner who presses Send and shuts the laptop believes the
 *    follow-ups went out, and finds out otherwise days later from the
 *    leads that went cold. Someone who wants to stop presses the Undo
 *    button that is on screen. `pagehide` rather than `beforeunload`
 *    because mobile browsers routinely never fire the latter, and the
 *    ICP is on a phone; `sendBeacon` because an ordinary fetch is
 *    abandoned when the document goes away.
 * 4. **One description of the request.** `url` and `body` are used by
 *    the timer path, the beacon path and the unmount path alike. An
 *    earlier shape let the caller pass its own `send` function for the
 *    normal path while the hook kept url/body for the flush — two
 *    descriptions of the same request, free to drift into a beacon that
 *    sends something the button never would.
 */
export type UndoableSend = {
  /** True while the grace period is running. */
  pending: boolean;
  /** Whole seconds left, for the label. */
  secs: number;
  /** True when the last press was taken back and nothing was sent. */
  cancelled: boolean;
  /** True while the request itself is in flight, after the window. */
  busy: boolean;
  start: () => void;
  undo: () => void;
};

export function useUndoableSend({
  url,
  body,
  onResponse,
  onNetworkError,
}: {
  url: string;
  /** JSON, already stringified — it is the identity of the request. */
  body: string;
  /** The caller reads its own shape out of the response. */
  onResponse: (res: Response) => void | Promise<void>;
  onNetworkError: () => void;
}): UndoableSend {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [secs, setSecs] = useState(0);
  const [cancelled, setCancelled] = useState(false);
  const [busy, setBusy] = useState(false);
  const gateRef = useRef<ReturnType<typeof createSendGate> | null>(null);

  // The callbacks are rebuilt on every render of the caller. Held in a
  // ref so the effects below depend on the clock and the request, and
  // not on a function identity that changes constantly — an effect that
  // re-ran each render would tear down and rebuild the `pagehide`
  // listener under a running countdown.
  //
  // Assigned in an effect rather than during render: React's own rule,
  // and it holds here because nothing reads `handlers.current` during a
  // render either. Every reader is a timer callback, an event listener
  // or a cleanup, all of which run after effects have flushed.
  const handlers = useRef({ onResponse, onNetworkError });
  useEffect(() => {
    handlers.current = { onResponse, onNetworkError };
  });

  const commit = useCallback(() => {
    if (!gateRef.current?.claim()) return;
    setEndsAt(null);
    setBusy(true);
    void (async () => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        await handlers.current.onResponse(res);
      } catch {
        handlers.current.onNetworkError();
      } finally {
        setBusy(false);
      }
    })();
  }, [url, body]);

  // Tick the label, and fire when the clock runs out.
  useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => {
      setSecs(secondsLeft(endsAt, Date.now()));
      if (Date.now() >= endsAt) commit();
    }, 250);
    return () => clearInterval(id);
  }, [endsAt, commit]);

  // Leaving sends — see guarantee 3 above.
  useEffect(() => {
    if (endsAt === null) return;
    const flush = () => {
      if (!gateRef.current?.claim()) return;
      navigator.sendBeacon?.(url, new Blob([body], { type: "application/json" }));
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      // Unmounting for any other reason — a client-side navigation away,
      // or this card being removed from the list — is the same promise.
      // The document is still alive here, so an ordinary keepalive
      // request works and nothing is lost.
      if (gateRef.current?.claim()) {
        void fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        });
      }
    };
  }, [endsAt, url, body]);

  const start = useCallback(() => {
    setCancelled(false);
    gateRef.current = createSendGate();
    const end = Date.now() + UNDO_WINDOW_MS;
    // Seeded here rather than in the effect, so the first paint of the
    // countdown already shows the full window. Seeding it in the effect
    // renders one frame of whatever the previous press left behind.
    setSecs(secondsLeft(end, Date.now()));
    setEndsAt(end);
  }, []);

  const undo = useCallback(() => {
    // Loses to a timer that already fired. When that happens the send is
    // under way and saying "cancelled" would be a lie, so nothing here
    // changes the screen — what the send reports is the truth.
    if (!gateRef.current?.claim()) return;
    setEndsAt(null);
    setCancelled(true);
  }, []);

  return { pending: endsAt !== null, secs, cancelled, busy, start, undo };
}
