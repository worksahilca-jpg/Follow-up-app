import { describe, expect, it } from "vitest";
import { declineIn } from "@/lib/declinePhrases";

describe("declineIn (A-326)", () => {
  it.each([
    ["Not interested, thanks", "no"],
    ["Thanks, but we're no longer interested.", "no"],
    ["We found a place last week, thanks anyway", "no"],
    ["We already bought a house", "no"],
    ["We decided not to move this year", "no"],
    ["Merci, mais pas intéressée", "no"],
    ["Please stop messaging me", "stop"],
    ["Can you remove me from your list", "stop"],
    ["Don’t contact me again", "stop"],
    ["Ne me contactez plus svp", "stop"],
    ["Thanks, but I'm already working with an agent.", "agent"],
    ["We already have a realtor", "agent"],
    ["We went with someone else", "agent"],
    ["J'ai déjà un courtier", "agent"],
  ])("%s → %s", (body, kind) => {
    expect(declineIn(body)?.kind).toBe(kind);
  });

  it.each([
    "No agent. Saturday morning works",
    "I don't have an agent yet",
    "Do you have an agent who speaks Punjabi?",
    "If we're not interested we'll let you know",
    "Not right now, maybe in the spring",
    "Can you stop by the office tomorrow?",
    "Please don't remove me, I still want updates",
    "We haven't found a place yet",
    "Is the condo on King St still available?",
    "",
  ])("%s → nothing", (body) => {
    expect(declineIn(body)).toBeNull();
  });
});
