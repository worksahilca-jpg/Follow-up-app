/** Today's one line per person and its known facts (A-286): only what the customer said, nothing guessed. */
import { describe, it, expect } from "vitest";
import { knownGlanceFacts, personLine, type Qualification } from "@/lib/qualification";

const q = (items: Qualification["items"], tier?: Qualification["tier"]): Qualification => ({ v: 2, template: "realtor", items, tier });

const raj = q(
  [
    { key: "side", quote: "still for sale", value: "Buying", bucket: "buy" },
    { key: "area", quote: "Mississauga yes", value: "Mississauga" },
    { key: "timing", quote: "in about 2 months", value: "In about 2 months", bucket: "soon" },
    { key: "financing", quote: "pre-approved up to 900k", value: "Pre-approved up to $900k", bucket: "sorted" },
    { key: "agent", quote: "No agent.", value: "No agent yet", bucket: "none" },
  ],
  "ready"
);

describe("personLine", () => {
  it("says the side, the place and the money for a buyer", () => {
    expect(personLine(raj)).toBe("Buying · Mississauga · Pre-approved up to $900k");
  });

  it("puts an agent they already have before the money", () => {
    const omar = q([
      { key: "side", quote: "still for sale", value: "Buying", bucket: "buy" },
      { key: "area", quote: "the condo on King St", value: "Condo on King St" },
      { key: "agent", quote: "I'm already working with an agent", value: "Has an agent", bucket: "has" },
    ]);
    expect(personLine(omar)).toBe("Buying · Condo on King St · Has an agent");
  });

  it("says the home and when for a seller", () => {
    const linda = q([
      { key: "side", quote: "We want to sell", value: "Selling", bucket: "sell" },
      { key: "home", quote: "my house at 48 Birch Ave", value: "48 Birch Ave" },
      { key: "timing", quote: "before Christmas", value: "Before Christmas", bucket: "soon" },
    ]);
    expect(personLine(linda)).toBe("Selling · 48 Birch Ave · Before Christmas");
  });

  it("is null when nothing is known, so the row keeps its own sentence", () => {
    expect(personLine(null)).toBeNull();
    expect(personLine(q([]))).toBeNull();
  });
});

describe("knownGlanceFacts", () => {
  it("keeps only the facts that are known", () => {
    expect(knownGlanceFacts(raj)).toEqual([
      ["Area", "Mississauga"],
      ["When", "In about 2 months"],
      ["Money", "Pre-approved up to $900k"],
    ]);
    expect(knownGlanceFacts(q([{ key: "side", quote: "to buy", value: "Buying", bucket: "buy" }]))).toEqual([]);
  });
});
