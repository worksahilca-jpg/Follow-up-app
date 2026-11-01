import { describe, expect, it } from "vitest";
import { fillPriceSlot, hasPriceSlot, isFilledDraft, mixedBlanks, PRICE_SLOT, splitAtPriceSlot } from "@/lib/priceSlot";

describe("the price blank", () => {
  it("finds the blank however the model cased or spaced it", () => {
    expect(hasPriceSlot(`The package is ${PRICE_SLOT}.`)).toBe(true);
    expect(hasPriceSlot("The package is [price].")).toBe(true);
    expect(hasPriceSlot("The package is [ Price ].")).toBe(true);
  });

  it("does not see a blank in an ordinary reply", () => {
    expect(hasPriceSlot("I'll confirm the price for you shortly.")).toBe(false);
    expect(hasPriceSlot("The price [see attached] is fixed.")).toBe(false);
    expect(hasPriceSlot(null)).toBe(false);
  });

  it("gives the same answer when asked twice (no leftover regex state)", () => {
    const t = "It is [PRICE].";
    expect(hasPriceSlot(t)).toBe(true);
    expect(hasPriceSlot(t)).toBe(true);
  });

  it("fills every blank with what the owner typed", () => {
    expect(fillPriceSlot("It is [PRICE], or [price] with the extra.", "$1,200")).toBe("It is $1,200, or $1,200 with the extra.");
  });

  it("never puts the price into a different blank (Nov 1 2026: \"parking is $450,000\")", () => {
    const draft = "The asking price is [PRICE], and parking is [ANSWER: parking].";
    expect(fillPriceSlot(draft, "$450,000")).toBe("The asking price is $450,000, and parking is [ANSWER: parking].");
    expect(hasPriceSlot(fillPriceSlot(draft, "$450,000"))).toBe(true);
    expect(fillPriceSlot("Parking is [ANSWER: parking]; pets are [ANSWER: pets].", "Included")).toBe("Parking is Included; pets are [ANSWER: pets].");
  });

  it("puts the owner's words in exactly as typed", () => {
    expect(fillPriceSlot("It is [PRICE].", "$$500 or $& more")).toBe("It is $$500 or $& more.");
  });

  it("knows when a draft has two different blanks", () => {
    expect(mixedBlanks("The price is [PRICE], and parking is [ANSWER: parking].")).toBe(true);
    expect(mixedBlanks("Parking is [ANSWER: parking], pets [answer: Pets].")).toBe(true);
    expect(mixedBlanks("It is [PRICE], or [price] with the extra.")).toBe(false);
    expect(mixedBlanks("Parking is [ANSWER: parking], yes [ANSWER: Parking ].")).toBe(false);
    expect(mixedBlanks("No blank here.")).toBe(false);
    expect(mixedBlanks(null)).toBe(false);
  });

  it("cuts the draft at the blank for drawing the box", () => {
    expect(splitAtPriceSlot("Hi Sarah, the package is [PRICE]. Want a call?")).toEqual(["Hi Sarah, the package is ", ". Want a call?"]);
  });
});

describe("filling the blank is not editing the draft", () => {
  const draft = "Hi Sarah, the 3-month package is [PRICE]. Would you like a free call first?";

  it("counts a filled-in price as the draft, unchanged", () => {
    expect(isFilledDraft(draft, "Hi Sarah, the 3-month package is $1,200. Would you like a free call first?")).toBe(true);
    expect(isFilledDraft(draft, "Hi Sarah,  the 3-month package is  $1,200 (+tax).\nWould you like a free call first?")).toBe(true);
  });

  it("counts any other change as an edit", () => {
    expect(isFilledDraft(draft, "Hi Sarah, the 3-month package is $1,200. Want a call?")).toBe(false);
    expect(isFilledDraft("Thanks, talk soon.", "Thanks, talk soon.")).toBe(false);
  });

  it("does not count the blank left in as filled", () => {
    expect(isFilledDraft(draft, draft)).toBe(false);
  });
});

