/**
 * Reading a few of the routine pile before sending all of it.
 *
 * ## The hole this fills
 *
 * The one-click pile shipped as a count and a single name:
 *
 *     40 routine drafts from WhatsApp — top is Tom Alvarez   [Send it]
 *
 * Which asks an owner to put forty messages into their customers' hands,
 * signed as their business, having read none of them. The likely
 * response to that is not trust; it is nobody ever pressing the button —
 * and a one-click pile nobody presses is the feature not existing, with
 * extra code.
 *
 * ## Why a sample and not a list
 *
 * Founder, 2026-09-23: "rather than reading all 600 drafts". Expanding
 * forty drafts in place rebuilds the wall the pile exists to knock down.
 * What answers the actual question — *is FollowUp writing sensible
 * things in my name?* — is a handful. Read three, and either they are
 * fine and the other thirty-seven probably are too, or one is wrong and
 * the pile should not go.
 *
 * Three, because that is enough to see a pattern and few enough to read
 * standing up. The pile is already sorted by score, so the three shown
 * are the three worth the most — the ones where a bad draft costs most.
 *
 * ## The rule about saying which three
 *
 * A sample presented as the whole is a lie the owner only catches after
 * pressing. `describeSample` exists so the sentence above the rows is
 * computed from the same numbers that decide the rows, rather than
 * written once against an imagined case and left to drift. Twice today a
 * count and its sentence disagreed on this screen; both times the count
 * was right and the prose was not.
 */
export const SPOT_CHECK_SAMPLE = 3;

/** The drafts actually shown. Already score-sorted by `groupApprovalsBySource`. */
export function sampleForSpotCheck<T>(items: T[]): T[] {
  return items.slice(0, SPOT_CHECK_SAMPLE);
}

/**
 * The line above the sample, which must never overstate what is on screen.
 *
 * Three cases, and the middle one is the trap: when the pile is exactly
 * the sample size, "the 3 highest-scoring of 3" is technically true and
 * reads as though something is being withheld. Showing everything is a
 * different fact and gets a different sentence.
 */
export function describeSample(shown: number, total: number): string {
  if (total === 0) return "";
  if (shown >= total) {
    return total === 1 ? "The only one, in full." : `All ${total}, in full.`;
  }
  return `The ${shown} highest-scoring of ${total}. The rest go too.`;
}
