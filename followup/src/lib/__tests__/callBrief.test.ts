/**
 * "Before your call" (A-268): the note is only ever made of lines whose words are really in the conversation, from
 * the right side, with no pressure, and short enough to read in a minute. The customer below is made up.
 */
import { describe, it, expect } from "vitest";
import type { Message } from "@/lib/types";
import {
  briefParts,
  callNoteDue,
  callNotOver,
  callIsSoon,
  callRowWords,
  callSoonDue,
  checkBrief,
  isBriefCurrent,
  isBriefEmpty,
  quotesOf,
  readCallBrief,
  sectionTitle,
  wantsFromFacts,
  type ProposedLine,
} from "@/lib/callBrief";

const msg = (id: string, direction: "inbound" | "outbound", body: string, date: string): Message => ({ id, direction, channel: "email", body, date });

const chat: Message[] = [
  msg("m1", "inbound", "Hi, we're pre-approved up to 950 and hoping to be in by March, before the new school term.", "2026-10-09T14:00:00.000Z"),
  msg("m2", "outbound", "Great to hear from you. I'll check the property tax on Folkway Drive and send it over.", "2026-10-09T15:00:00.000Z"),
  msg("m3", "inbound", "Does the Folkway one have a finished basement? Any good schools close by?", "2026-10-13T12:00:00.000Z"),
  msg("m4", "outbound", "Yes, it has a finished basement. Here is the listing.", "2026-10-13T13:00:00.000Z"),
  msg("m5", "inbound", "We lost two offers this summer, honestly tired of bidding wars. Saturdays are easiest for us.", "2026-10-14T18:00:00.000Z"),
];

const line = (section: ProposedLine["section"], text: string, ...quotes: [string, "customer" | "business"][]): ProposedLine => ({
  section,
  text,
  quotes: quotes.map(([quote, by]) => ({ quote, by })),
});

describe("checkBrief keeps only what the conversation shows", () => {
  it("keeps a line whose words are all in the customer's messages, with when they wrote them", () => {
    const b = checkBrief([line("wants", "In by March. Pre-approved up to $950,000.", ["pre-approved up to 950", "customer"], ["hoping to be in by March", "customer"])], chat);
    expect(b.wants).toHaveLength(1);
    expect(b.wants[0].quotes).toEqual([
      { quote: "pre-approved up to 950", by: "them", at: "2026-10-09T14:00:00.000Z" },
      { quote: "hoping to be in by March", by: "them", at: "2026-10-09T14:00:00.000Z" },
    ]);
    expect(b.messages).toBe(5);
  });

  it("matches the way a person would: case, spacing and curly quotes don't matter", () => {
    const b = checkBrief([line("mind", "Lost two offers and is tired of bidding wars.", ["We lost two offers this summer,  HONESTLY tired", "customer"])], chat);
    expect(b.mind).toHaveLength(1);
  });

  it("drops a line when any of its words can't be found", () => {
    const b = checkBrief([line("wants", "Pre-approved up to $1.2M, wants a pool.", ["pre-approved up to 950", "customer"], ["we want a pool", "customer"])], chat);
    expect(b.wants).toEqual([]);
  });

  it("drops a line with no words behind it at all", () => {
    expect(checkBrief([line("mind", "Seems nervous about the market.")], chat).mind).toEqual([]);
  });

  it("never takes the owner's words as what the customer said", () => {
    // "I'll check the property tax" is the owner's: it can't stand in for something Aisha wants or feels.
    const b = checkBrief([line("mind", "Worried about the property tax.", ["check the property tax", "customer"])], chat);
    expect(b.mind).toEqual([]);
  });

  it("keeps the owner's own promise in Still open, with the owner as who said it", () => {
    const b = checkBrief([line("open", "You said you'd check the property tax on Folkway Drive.", ["I'll check the property tax on Folkway Drive", "business"])], chat);
    expect(b.open).toHaveLength(1);
    expect(b.open[0].quotes[0].by).toBe("you");
  });

  it("needs at least one of the customer's own quotes outside Still open", () => {
    const b = checkBrief([line("asked", "You said it has a finished basement.", ["it has a finished basement", "business"])], chat);
    expect(b.asked).toEqual([]);
    const ok = checkBrief([line("asked", "If the Folkway house has a finished basement. You said yes.", ["Does the Folkway one have a finished basement?", "customer"], ["it has a finished basement", "business"])], chat);
    expect(ok.asked).toHaveLength(1);
  });

  it("never keeps a line that talks about pushing or closing someone", () => {
    const b = checkBrief(
      [
        line("next", "Push her to book a viewing before it's gone.", ["Saturdays are easiest for us", "customer"]),
        line("next", "Close the deal on Saturday.", ["Saturdays are easiest for us", "customer"]),
      ],
      chat
    );
    expect(b.next).toEqual([]);
  });

  it("still allows a closing date, which in real estate is just the day the home changes hands", () => {
    const withClosing = [...chat, msg("m6", "inbound", "We'd want closing in late March.", "2026-10-15T10:00:00.000Z")];
    expect(checkBrief([line("wants", "Wants closing in late March.", ["closing in late March", "customer"])], withClosing).wants).toHaveLength(1);
  });

  it("keeps each part to its limit and no line twice", () => {
    const q: [string, "customer"] = ["Saturdays are easiest for us", "customer"];
    const b = checkBrief([line("next", "A viewing on Saturday.", q), line("next", "A call on Saturday.", q), line("open", "One.", q), line("open", "one. ", q)], chat);
    expect(b.next).toHaveLength(1);
    expect(b.open).toHaveLength(1);
  });

  it("drops a line too long to read at a glance, and quotes too short to prove anything", () => {
    expect(checkBrief([line("mind", "x".repeat(260), ["tired of bidding wars", "customer"])], chat).mind).toEqual([]);
    expect(checkBrief([line("mind", "Tired.", ["us", "customer"])], chat).mind).toEqual([]);
  });

  it("ignores a part it doesn't know", () => {
    const b = checkBrief([{ section: "pitch" as ProposedLine["section"], text: "Offer a discount.", quotes: [{ quote: "Saturdays are easiest for us", by: "customer" }] }], chat);
    expect(isBriefEmpty(b)).toBe(true);
  });
});

describe("what they want, from what the Ready card already knows", () => {
  it("says the facts in one line, each with the customer's words and date", () => {
    const l = wantsFromFacts(
      [
        { value: "Erin Mills, Mississauga", quote: "hoping to be in by March" },
        { value: "Pre-approved to $950k", quote: "pre-approved up to 950" },
      ],
      chat
    );
    expect(l?.text).toBe("Erin Mills, Mississauga. Pre-approved to $950k.");
    expect(l?.quotes.every((q) => q.by === "them")).toBe(true);
  });

  it("leaves out a fact whose words are no longer in the conversation", () => {
    expect(wantsFromFacts([{ value: "Wants a pool", quote: "a pool please" }], chat)).toBeNull();
  });
});

describe("a stored note", () => {
  const stored = checkBrief([line("mind", "Tired of bidding wars.", ["tired of bidding wars", "customer"])], chat);

  it("reads back as it was saved", () => {
    expect(readCallBrief(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
  });

  it("is treated as no note when it isn't the right shape", () => {
    expect(readCallBrief(null)).toBeNull();
    expect(readCallBrief({ v: 2, messages: 1 })).toBeNull();
    expect(readCallBrief("note")).toBeNull();
  });

  it("is current only until a message comes or goes", () => {
    expect(isBriefCurrent(stored, 5)).toBe(true);
    expect(isBriefCurrent(stored, 6)).toBe(false);
    expect(isBriefCurrent(null, 5)).toBe(false);
  });
});

describe("the note's words", () => {
  it("names each part with the customer's first name", () => {
    expect(sectionTitle("wants", "Aisha")).toBe("What Aisha wants");
    expect(sectionTitle("asked", "Aisha")).toBe("What Aisha asked");
    expect(sectionTitle("open", "Aisha")).toBe("Still open");
    expect(sectionTitle("mind", "Aisha")).toBe("On Aisha's mind");
    expect(sectionTitle("next", "Aisha")).toBe("A next step to offer");
  });

  it("lists every quote once, oldest first, with the part it supports", () => {
    const b = checkBrief(
      [
        line("mind", "Tired of bidding wars.", ["tired of bidding wars", "customer"]),
        line("wants", "In by March.", ["hoping to be in by March", "customer"]),
        line("next", "A Saturday viewing.", ["Saturdays are easiest for us", "customer"]),
      ],
      chat
    );
    const qs = quotesOf(b);
    expect(qs.map((q) => q.section)).toEqual(["wants", "mind", "next"]);
    expect(qs[0].at < qs[1].at).toBe(true);
  });
});

describe("when the note shows and when the phone buzzes", () => {
  const at = new Date("2026-10-16T18:00:00.000Z");

  it("shows until the call has ended", () => {
    expect(callNotOver(at, 30, new Date("2026-10-16T17:00:00.000Z"))).toBe(true);
    expect(callNotOver(at, 30, new Date("2026-10-16T18:20:00.000Z"))).toBe(true);
    expect(callNotOver(at, 30, new Date("2026-10-16T18:30:00.000Z"))).toBe(false);
  });

  it("buzzes in the half hour before the call, never after it starts", () => {
    expect(callSoonDue(at, new Date("2026-10-16T17:20:00.000Z"))).toBe(false);
    expect(callSoonDue(at, new Date("2026-10-16T17:30:00.000Z"))).toBe(true);
    expect(callSoonDue(at, new Date("2026-10-16T17:59:00.000Z"))).toBe(true);
    expect(callSoonDue(at, new Date("2026-10-16T18:00:00.000Z"))).toBe(false);
  });
});

describe("the note by email (A-268)", () => {
  const at = new Date("2026-10-16T18:00:00.000Z");

  it("is due in the hour before the call, never after it starts", () => {
    expect(callNoteDue(at, new Date("2026-10-16T16:59:00.000Z"))).toBe(false);
    expect(callNoteDue(at, new Date("2026-10-16T17:00:00.000Z"))).toBe(true);
    expect(callNoteDue(at, new Date("2026-10-16T17:59:00.000Z"))).toBe(true);
    expect(callNoteDue(at, new Date("2026-10-16T18:00:00.000Z"))).toBe(false);
  });

  it("reads as headed parts, in the note's order, leaving out empty ones", () => {
    const b = checkBrief(
      [
        line("next", "A Saturday viewing.", ["Saturdays are easiest for us", "customer"]),
        line("wants", "In by March.", ["hoping to be in by March", "customer"]),
      ],
      chat
    );
    expect(briefParts(b, "Aisha")).toEqual([
      { label: "What Aisha wants", lines: ["In by March."] },
      { label: "A next step to offer", lines: ["A Saturday viewing."] },
    ]);
  });
});

describe("callIsSoon / callRowWords (A-283)", () => {
  const now = new Date("2026-10-17T14:00:00Z");
  it("a call within the hour, or already started, is soon", () => {
    expect(callIsSoon(new Date("2026-10-17T14:45:00Z"), now)).toBe(true);
    expect(callIsSoon(new Date("2026-10-17T15:00:00Z"), now)).toBe(true);
    expect(callIsSoon(new Date("2026-10-17T13:50:00Z"), now)).toBe(true);
  });
  it("a call more than an hour away is not", () => {
    expect(callIsSoon(new Date("2026-10-17T15:01:00Z"), now)).toBe(false);
  });
  it("the row words don't repeat the time, which sits on the right", () => {
    expect(callRowWords(true)).toBe("Starting soon. What to talk about is ready.");
    expect(callRowWords(false)).toBe("What to talk about is ready.");
  });
});
