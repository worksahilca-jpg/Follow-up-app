import { describe, expect, it } from "vitest";
import { fillPriceSlot, hasPriceSlot, isFilledDraft, PRICE_SLOT, splitAtPriceSlot } from "@/lib/priceSlot";

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

