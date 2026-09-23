/**
 * The few seconds between "Send all 40" and forty messages leaving.
 *
 * ## Why this is a delay and not an undo
 *
 * A sent message cannot be recalled. Gmail, WhatsApp, Instagram and SMS
 * all hand it to a network that will not give it back, and no amount of
 * product design changes that. So the only honest "undo" is a window
 * BEFORE the send in which nothing has happened yet.
 *
 * That distinction has to survive into the copy. A button that says
 * "Undo" after a real send would be a lie the first time someone pressed
 * it and watched the message stay delivered. What the owner is offered
 * here is a pause, and the UI says the send is *about to* happen rather
 * than that it has.
 *
 * ## Why ten seconds and not Gmail's five
 *
 * `research/customers/2026-09-05-icp-pain-and-trust-objections.md`
 * records the real usage context: an owner up a ladder, interrupted, on
 * a phone, giving the app ninety seconds. Five seconds assumes someone
 * sitting at a desk watching the screen — that is Gmail's user, not
 * this one. Our owner has to notice the bar, read it, realise the press
 * was wrong, and find the button, one-handed, while doing something
 * else.
 *
 * The asymmetry that settles it: a longer window costs almost nothing,
 * because nobody is waiting on the result. The owner has already moved
 * on to the next group; the send happens behind them either way. A
 * window that is too short costs forty messages that should not have
 * gone. When one side of a trade is free, take it.
 */
export const UNDO_WINDOW_MS = 10_000;

/**
 * Whole seconds still on the clock, for the label.
 *
 * Rounded UP deliberately. With `floor`, a window that has just opened
 * reads "9s" for a full second before it starts counting — the press
 * appears to have already eaten a second of the grace it promised. With
 * `ceil` it reads "10s" immediately and reaches "1s" for the final
 * second, which is what a countdown is supposed to do.
 *
 * Never negative: a tab left in the background can wake with `now` well
 * past the end, and "-14s" on screen is worse than a stale zero.
 */
export function secondsLeft(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/**
 * One-shot claim, shared by the two things that race.
 *
 * The scenario this exists for: the window is on its last millisecond,
 * the timer fires and starts the send, and the owner's finger lands on
 * Undo at the same moment. Without a shared gate both run — the messages
 * go out AND the screen says it was cancelled. That is the single worst
 * outcome this whole feature can produce, because the owner walks away
 * believing nothing was sent.
 *
 * So sending and cancelling both have to claim the same token first, and
 * exactly one of them can win. Whoever loses does nothing at all and the
 * screen shows whatever the winner did.
 *
 * Deliberately not a boolean in a ref that two call sites check and then
 * set. That is the same check-then-act shape we already had to fix in
 * the rate limiters (#89); one function that both reads and writes in a
 * single step cannot be interleaved wrongly by construction.
 */
export function createSendGate(): { claim: () => boolean } {
  let claimed = false;
  return {
    claim() {
      if (claimed) return false;
      claimed = true;
      return true;
    },
  };
}
