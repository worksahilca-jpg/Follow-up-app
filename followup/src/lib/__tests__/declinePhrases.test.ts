import { describe, expect, it } from "vitest";
import { declineIn, type DeclineKind } from "@/lib/declinePhrases";
import { NO_CONVERSATIONS, type NoConversation } from "@/lib/noConversations";

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

describe("declineIn on the 50 test conversations (A-326, A-329)", () => {
  const newest = (c: NoConversation) => [...c.msgs].reverse().find(([who]) => who === "them")?.[1] ?? "";

  it.each(NO_CONVERSATIONS.filter((c) => c.expect === "keep").map((c) => [c.id, newest(c)]))(
    "%s never stops what isn't a no: %s",
    (_id, body) => {
      expect(declineIn(body)).toBeNull();
    }
  );

  it("a no in their own plain words is still caught, a preference in the same breath is not", () => {
    expect(declineIn("Not interested in condos, only detached homes.")).toBeNull();
    expect(declineIn("We found a place we really like! Can you book a showing?")).toBeNull();
    expect(declineIn("Can you stop sending listings above 900k? Under that is fine")).toBeNull();
    expect(declineIn("Text please, you can stop emailing me")).toBeNull();
    expect(declineIn("Not interested in condos. Please stop texting me.")?.kind).toBe("stop");
    expect(declineIn("Don't text me again")?.kind).toBe("stop");
  });

  it("what the word list does catch among the rest is the right kind", () => {
    const kinds: Record<string, DeclineKind[]> = { stop: ["no", "stop"], agent: ["agent"], maybe: [], optout: ["stop", "no"] };
    for (const c of NO_CONVERSATIONS.filter((x) => x.expect !== "keep")) {
      const found = declineIn(newest(c));
      if (found) expect(kinds[c.expect], c.id).toContain(found.kind);
    }
  });

  it("is fifty, each ending with the customer", () => {
    expect(NO_CONVERSATIONS).toHaveLength(50);
    expect(new Set(NO_CONVERSATIONS.map((c) => c.id)).size).toBe(50);
    for (const c of NO_CONVERSATIONS) expect(c.msgs.at(-1)?.[0], c.id).toBe("them");
  });
});
