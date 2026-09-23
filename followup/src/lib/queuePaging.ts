/**
 * How much of a source's needs-you pile is on screen at once.
 *
 * ## The bug this closes
 *
 * `design-decisions.md`, three separate reviews running to 2026-09-23:
 * *"600 drafts means 600 cards in one page"*, then *"600 cards render as
 * 600 cards"*, then *"unchanged, and now the oldest outstanding gap."*
 *
 * It is not hypothetical. `pendingApprovals.ts` scans up to 500 leads,
 * and on a holding account `Lead.suggestedRiskLevel` is null for every
 * draft written before the classifier ran — `isSafeToSendInBulk` calls
 * null unsafe, correctly, so the whole backlog lands in `needsYou` and
 * every one of them renders a full card carrying the lead's message
 * (400 characters) and the drafted reply. Server-rendered, then
 * hydrated. The first tester with a real inbox meets a page that takes
 * seconds to paint and janks on every scroll.
 *
 * ## Why this is not pagination
 *
 * Page numbers would be the obvious answer and they are the wrong one
 * here. Nobody visits page 4 of their approvals. The queue is already
 * ordered — highest-scoring first, inside groups ordered by urgency
 * (`approvalGroups.ts`) — so an owner works from the top and the cards
 * they act on LEAVE. Numbered pages would impose a document's model on
 * a pile that shrinks while you look at it: resolve the third card on
 * page 2 and every page boundary after it shifts.
 *
 * Instead the pile has a visible head and a tail that can be pulled up.
 * As cards resolve, the ones underneath rise into view on their own,
 * because the count is "how many to show" and not "which ones".
 *
 * Per source rather than one budget across the whole screen: each
 * source gets its own head, so an owner can see at a glance what is
 * waiting on every channel instead of one loud channel burying the
 * others.
 *
 * Deliberately NOT a "show all" button, which is the pattern
 * `ConversationThread.tsx` uses for a conversation of thirty messages.
 * Pressing "show all" on 500 is the original bug with a click in front
 * of it.
 */

/**
 * Cards shown per source before the tail is folded, and per press after.
 *
 * Three, and the number was measured rather than picked. Built at five
 * first, then rendered at 390px — the phone this product's owner is
 * actually holding, per
 * `research/customers/2026-09-05-icp-pain-and-trust-objections.md`, which
 * records the usage context as an owner up a ladder with about ninety
 * seconds. One approval card is **509px tall** there: the lead's message
 * wraps to six lines, the draft to six more, then three buttons. Five
 * cards put the fold row three and a half screens down and the page at
 * 8.7 screens. The screen was correct and unusable.
 *
 * At three, a source's head is about two screens and the owner reaches
 * the end of it while still holding the thought they opened the app with.
 *
 * Three is also already this screen's number for "enough to judge by" —
 * `SPOT_CHECK_SAMPLE` in `spotCheck.ts` shows three of the routine pile
 * when an owner peeks at it. Deliberately a separate constant and not
 * that one: they answer different questions (a sample to verify a batch
 * against, versus a working head to read down), and sharing a name would
 * mean tuning one silently moved the other.
 */
export const QUEUE_PAGE_SIZE = 3;

/**
 * A tail this short is shown rather than folded.
 *
 * Folding two cards behind a row that says "2 more" costs about as much
 * vertical space as showing them, and spends a decision to save nothing.
 * The fold has to earn its place; at seven cards it does not.
 */
export const QUEUE_TAIL_TOLERANCE = 2;

/**
 * How many of `total` to render, given how many the owner has asked for.
 *
 * `shown` is a request, not a promise: the tolerance above rounds it up
 * to the whole pile whenever the tail is short, and that same branch is
 * what keeps an over-request honest — expand to 15 on a pile of 40, then
 * approve down to 4, and `total - shown` is negative, comfortably inside
 * the tolerance, so the answer is 4 rather than a slice past the end.
 *
 * This started as two lines, with an explicit `if (shown >= total)`
 * clamp in front. Mutation-testing the file found that deleting the
 * clamp changed no output on any input, because shown >= total implies
 * total - shown <= 0 <= QUEUE_TAIL_TOLERANCE and the branch below had
 * already returned `total`. A guard no test can distinguish from its
 * absence is not a safety net; it is a second rule that can drift out of
 * step with the first one. One rule, one line.
 */
export function visibleCount(total: number, shown: number): number {
  return total - shown <= QUEUE_TAIL_TOLERANCE ? total : shown;
}

/**
 * How many more cards the next press would reveal — 0 when the pile is
 * fully on screen.
 *
 * The button label is built from this rather than from QUEUE_PAGE_SIZE,
 * so "Show 5 more" is never printed above four remaining cards. The
 * tolerance makes the two differ often enough to matter: at 12 total and
 * 5 shown, the next press reveals all 7 that are left, not 5.
 */
export function nextStep(total: number, shown: number): number {
  const now = visibleCount(total, shown);
  return visibleCount(total, shown + QUEUE_PAGE_SIZE) - now;
}
