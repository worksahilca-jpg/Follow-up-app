/**
 * The oldest outstanding gap on the dashboard, closed.
 *
 * `design-decisions.md` named it three times across three reviews and
 * it never moved: 600 held drafts render as 600 full cards, each one
 * carrying the lead's message and the drafted reply, server-rendered
 * and then hydrated. `pendingApprovals.ts` scans 500, and on a holding
 * account every one of them lands in `needsYou` because an unjudged
 * draft is not a safe draft.
 *
 * What these pin is the arithmetic of the fold, because every visible
 * defect on this screen this session was an off-by-something in a
 * number printed next to a noun — "2 of these" under a heading reading
 * (1), "Send all 12" twice, a group sorted by the alphabet while
 * claiming to sort by score. The counts are where this screen goes
 * wrong.
 */
import { describe, it, expect } from "vitest";
import { QUEUE_PAGE_SIZE, QUEUE_TAIL_TOLERANCE, nextStep, visibleCount } from "@/lib/queuePaging";

describe("what is on screen", () => {
  it("shows a small pile whole", () => {
    // Three cards and a "show more" button would be absurd. The fold
    // must not appear until there is something to fold.
    expect(visibleCount(3, QUEUE_PAGE_SIZE)).toBe(3);
    expect(visibleCount(0, QUEUE_PAGE_SIZE)).toBe(0);
  });

  it("folds a large pile down to the page size", () => {
    expect(visibleCount(500, QUEUE_PAGE_SIZE)).toBe(QUEUE_PAGE_SIZE);
  });

  it("shows a tail too short to be worth folding", () => {
    // Folding two cards behind a row that says "2 more" costs about the
    // same height as the two cards and spends a decision to save
    // nothing. The boundary is written from the constants rather than as
    // a literal, so it states the RULE: the last pile shown whole is one
    // page plus the tolerance, and the first pile folded is one more
    // than that. Tuning the page size for a device moves both, and this
    // test keeps holding — which is the point, since the page size was
    // already retuned once after measuring a real phone.
    const lastWhole = QUEUE_PAGE_SIZE + QUEUE_TAIL_TOLERANCE;
    expect(visibleCount(lastWhole, QUEUE_PAGE_SIZE)).toBe(lastWhole);
    expect(visibleCount(lastWhole + 1, QUEUE_PAGE_SIZE)).toBe(QUEUE_PAGE_SIZE);
  });

  it("never reports more than exists", () => {
    // The pile shrinks under the request: the owner expands to 15, then
    // approves until 4 are left. A raw `shown` would slice past the end
    // and the "N more" row would render a negative.
    expect(visibleCount(4, 15)).toBe(4);
  });
});

describe("what the button promises", () => {
  it("offers a full page when a full page is left", () => {
    expect(nextStep(500, QUEUE_PAGE_SIZE)).toBe(QUEUE_PAGE_SIZE);
  });

  it("offers more than a page when the tolerance will sweep up the rest", () => {
    // A pile that the SECOND press finishes: two pages plus a tail
    // inside the tolerance. Saying "Show 3 more" there would be wrong
    // twice over — more than three appear, and they are all of them.
    // The label is computed from nextStep for exactly this reason.
    const total = QUEUE_PAGE_SIZE * 2 + QUEUE_TAIL_TOLERANCE;
    expect(nextStep(total, QUEUE_PAGE_SIZE)).toBe(total - QUEUE_PAGE_SIZE);
    expect(nextStep(total, QUEUE_PAGE_SIZE)).toBeGreaterThan(QUEUE_PAGE_SIZE);
  });

  it("offers nothing once the pile is fully on screen", () => {
    // What the UI branches on to drop the row entirely. A non-zero
    // answer here would leave a "0 more need your OK" row under a
    // complete list.
    expect(nextStep(QUEUE_PAGE_SIZE - 1, QUEUE_PAGE_SIZE)).toBe(0);
    expect(nextStep(QUEUE_PAGE_SIZE + QUEUE_TAIL_TOLERANCE, QUEUE_PAGE_SIZE)).toBe(0);
  });

  it("always reaches the end of the pile eventually", () => {
    // The real failure mode of a hand-rolled expander: a pile size where
    // pressing stops revealing anything and the last cards are
    // unreachable, with the row still on screen offering them. Walked
    // exhaustively rather than spot-checked, because the tolerance makes
    // the step size vary and the bad size would be one nobody thought to
    // try.
    for (let total = 0; total <= 60; total++) {
      let shown = QUEUE_PAGE_SIZE;
      let presses = 0;
      while (visibleCount(total, shown) < total) {
        const step = nextStep(total, shown);
        expect(step, `stalled at total=${total}, shown=${shown}`).toBeGreaterThan(0);
        shown += QUEUE_PAGE_SIZE;
        presses += 1;
        expect(presses, `runaway at total=${total}`).toBeLessThan(total + 2);
      }
      expect(visibleCount(total, shown), `never reached the end at total=${total}`).toBe(total);
    }
  });
});

describe("the queue behaves like a queue", () => {
  it("lifts the next card into view when the top one is resolved", () => {
    // The whole reason the fold is a COUNT and not a set of revealed
    // ids. 40 waiting, 5 on screen; the owner approves one. 39 remain
    // and the count still says 5, so slice(0, 5) now lands one further
    // down the list — the sixth card takes the empty place by itself.
    const before = visibleCount(40, QUEUE_PAGE_SIZE);
    const after = visibleCount(39, QUEUE_PAGE_SIZE);
    expect(before).toBe(QUEUE_PAGE_SIZE);
    expect(after).toBe(QUEUE_PAGE_SIZE);
    // And the fold shrinks by exactly the one that left.
    expect(39 - after).toBe(40 - before - 1);
  });

  it("drops the fold once the pile has been worked down past it", () => {
    // One card past the fold's threshold is folded; approve that one
    // card and the rest are inside the tolerance, so the row disappears
    // on its own without ever being pressed.
    const justFolded = QUEUE_PAGE_SIZE + QUEUE_TAIL_TOLERANCE + 1;
    expect(visibleCount(justFolded, QUEUE_PAGE_SIZE)).toBe(QUEUE_PAGE_SIZE);
    expect(visibleCount(justFolded - 1, QUEUE_PAGE_SIZE)).toBe(justFolded - 1);
  });
});

describe("the constants are what the copy assumes", () => {
  it("is three and two, and changing either is a deliberate edit", () => {
    // The boundary tests above are written from the constants so they
    // state the rule rather than a number — which is right, and which
    // also means every one of them would keep passing if the page size
    // silently became 40. This is the one assertion that would not.
    //
    // Three came from measuring: an approval card is 509px tall at
    // 390px wide, so five put the fold three and a half screens down on
    // the phone the owner actually holds. If either number changes,
    // this test should be updated by someone who has looked at the
    // screen again, not by someone making a red test green.
    expect(QUEUE_PAGE_SIZE).toBe(3);
    expect(QUEUE_TAIL_TOLERANCE).toBe(2);
  });

  it("keeps the tolerance below the page size", () => {
    // If the tolerance ever reached the page size, the first fold could
    // never appear: every pile large enough to fold would be inside the
    // tolerance. The relationship is load-bearing, not incidental.
    expect(QUEUE_TAIL_TOLERANCE).toBeLessThan(QUEUE_PAGE_SIZE);
  });
});
