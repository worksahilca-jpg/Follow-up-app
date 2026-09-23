/**
 * The sample shown before someone sends forty messages unread.
 *
 * These tests exist because of a pattern this screen has now produced
 * three times in one day: a number that was right, and a sentence beside
 * it that was wrong. "1 routine draft from Added by hand", "2 of these"
 * under a heading reading (1). Every one of them passed a full test
 * suite and was caught by looking at the screen.
 *
 * So the sentence is computed, not written, and the computation is
 * pinned here — including the case where the sample and the pile are the
 * same size, which is the one a human writing the copy once, against an
 * imagined pile of forty, will not think about.
 */
import { describe, it, expect } from "vitest";
import { SPOT_CHECK_SAMPLE, sampleForSpotCheck, describeSample } from "@/lib/spotCheck";

const pile = (n: number) => Array.from({ length: n }, (_, i) => `draft${i + 1}`);

describe("which drafts get shown", () => {
  it("takes the top few of a big pile", () => {
    expect(sampleForSpotCheck(pile(40))).toEqual(["draft1", "draft2", "draft3"]);
  });

  it("takes the whole pile when it is smaller than the sample", () => {
    // slice() already does this; asserted because the label branches on
    // exactly this comparison and must agree with what is rendered.
    expect(sampleForSpotCheck(pile(2))).toEqual(["draft1", "draft2"]);
  });

  it("keeps the sample small enough to read standing up", () => {
    // The pile exists so nobody reads 600 drafts. A sample that grew to
    // ten would rebuild the wall it was meant to knock down.
    expect(SPOT_CHECK_SAMPLE).toBeLessThanOrEqual(5);
  });
});

describe("the sentence above the sample", () => {
  it("says it is a sample, and that the rest still go", () => {
    // The half that matters: an owner must not think the three on screen
    // are everything about to be sent.
    expect(describeSample(3, 40)).toBe("The 3 highest-scoring of 40. The rest go too.");
  });

  it("does not claim to withhold anything when the pile IS the sample", () => {
    // "The 3 highest-scoring of 3" is true and reads as though something
    // is hidden. Three drafts shown out of three is a different fact.
    expect(describeSample(3, 3)).toBe("All 3, in full.");
  });

  it("does not say 'All 1'", () => {
    expect(describeSample(1, 1)).toBe("The only one, in full.");
  });

  it("says nothing at all about an empty pile", () => {
    // An empty pile renders no sample, so a sentence describing one
    // would be describing nothing.
    expect(describeSample(0, 0)).toBe("");
  });
});
