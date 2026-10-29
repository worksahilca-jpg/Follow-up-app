/** The reply test's guard on the grader: the customer's own words are never an invented fact (2026-10-29). */
import { describe, expect, it } from "vitest";
import { theirOwnWords } from "@/lib/replyEval";
import { putsOffOwnExperience } from "@/lib/dmDrafts";
import type { Message } from "@/lib/types";

const family = { lines: [["in", "We're moving from Ottawa in August. Need 3 beds near a good school for our 8 year old. Budget around 1.3."]] as ["in", string][] };

describe("theirOwnWords", () => {
  it("is true when every word and number in the detail is the customer's", () => {
    expect(theirOwnWords("3 beds near a good school around 1.3", family)).toBe(true);
  });
  it("is false when one place or number is not theirs", () => {
    expect(theirOwnWords("3 beds in Toronto", family)).toBe(false);
    expect(theirOwnWords("4 beds near a good school", family)).toBe(false);
    expect(theirOwnWords("", family)).toBe(false);
  });
  it("counts the business facts as said", () => {
    expect(theirOwnWords("2.5%", { lines: [["in", "What do you charge?"]], facts: [{ label: "Commission", value: "My commission is 2.5% when I sell your home." }] })).toBe(true);
  });
});

const said = (body: string) => [{ id: "m", direction: "inbound", body, channel: "instagram" }] as unknown as Message[];

describe("putsOffOwnExperience", () => {
  it("catches a question about the owner's years answered with nothing", () => {
    expect(putsOffOwnExperience(said("How long have you been a realtor?"), "Thanks for asking. I'll confirm that for you, when are you moving?")).toBe(true);
    expect(putsOffOwnExperience(said("how many years have u been doing this"), "Good question, I'll check that. What area?")).toBe(true);
  });
  it("lets the answer blank or a number through", () => {
    expect(putsOffOwnExperience(said("How long have you been a realtor?"), "I've been a realtor for [ANSWER: years in business]. What area?")).toBe(false);
    expect(putsOffOwnExperience(said("How long have you been a realtor?"), "Since 2015, mostly in Brampton. What area?")).toBe(false);
  });
  it("leaves every other question alone", () => {
    expect(putsOffOwnExperience(said("How long would it take you to sell my house?"), "I'll check that for you. Where is it?")).toBe(false);
    expect(putsOffOwnExperience(said("Is the condo on King St still available?"), "I'll check whether it is. When would you like to see it?")).toBe(false);
  });
});
