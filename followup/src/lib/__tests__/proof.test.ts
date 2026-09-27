import { describe, it, expect } from "vitest";
import { PROOF_STORIES, realProof, type ProofStory } from "@/lib/proof";

// A-023 / A-050: proof is real or it isn't shown.
const full: ProofStory = {
  firstName: "Dana",
  business: "Ortiz Landscaping, Toronto",
  before: "2 days",
  after: "9 min",
  quote: "It found inquiries we had forgotten.",
  consentedOn: "2026-10-01",
};

describe("landing proof", () => {
  it("ships empty, so nothing shows until a tester agrees", () => {
    expect(realProof(PROOF_STORIES)).toEqual([]);
  });

  it("shows a story only when every field is real and there is a consent date", () => {
    expect(realProof([full])).toEqual([full]);
    expect(realProof([{ ...full, quote: " " }])).toEqual([]);
    expect(realProof([{ ...full, consentedOn: "" }])).toEqual([]);
  });
});
