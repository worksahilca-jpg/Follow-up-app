/**
 * "Tell FollowUp about your business" (A-311, A-312): which questions are asked and in what order, where the
 * conversation is from what FollowUp already knows, and the promise that every value shown or saved is the owner's
 * own words, copied, never written by FollowUp.
 */
import { describe, it, expect } from "vitest";
import {
  CARD_MIN_OPEN,
  checkedRows,
  exampleLine,
  knowsLine,
  MAX_ROWS,
  showTellCard,
  tellRows,
  tellState,
  tellTopic,
  tellTopics,
  wholeAnswer,
} from "@/lib/tellFollowUp";
import { WHAT_YOU_DO_LABEL } from "@/lib/dailyQuestion";
import { MAX_VALUE } from "@/lib/factLines";

const REALTOR = "Real estate";
const labels = tellTopics(REALTOR).map((t) => t.label);
const whatYouDo = tellTopic(REALTOR, WHAT_YOU_DO_LABEL)!;
const ANSWER = "I'm a realtor in Mississauga and Oakville. Mostly buyers and sellers, a few rentals. I speak English and Punjabi.";

describe("the questions", () => {
  it("start with what the business does, then the trade's own questions", () => {
    expect(labels[0]).toBe(WHAT_YOU_DO_LABEL);
    expect(labels).toContain("Commission");
    expect(labels).toContain("Area you cover");
    expect(tellTopics("Home services (contractor, cleaning, etc.)").map((t) => t.label)).toContain("Warranty");
  });

  it("are only ones FollowUp can use: no rules or tone dressed up as facts", () => {
    for (const trade of [REALTOR, "Mortgage brokerage", "Dental / medical clinic", null]) {
      for (const l of tellTopics(trade).map((t) => t.label.toLowerCase())) {
        expect(l).not.toMatch(/never promise|hand to you|how you sound/);
      }
    }
  });

  it("take only their own names, in any case", () => {
    expect(tellTopic(REALTOR, "commission")?.label).toBe("Commission");
    expect(tellTopic(REALTOR, "Parking")).toBeNull();
  });
});

describe("where the conversation is", () => {
  it("asks what isn't known yet, in order, and leaves what was skipped", () => {
    const s = tellState(REALTOR, [{ label: "what you do", value: "Realtor" }], ["Commission"]);
    expect(s.open[0]).toBe("Area you cover");
    expect(s.open).not.toContain("Commission");
    expect(s.open).not.toContain(WHAT_YOU_DO_LABEL);
    expect(s.skipped).toEqual(["Commission"]);
  });

  it("puts the skipped ones back when asked to answer them now", () => {
    const s = tellState(REALTOR, [], ["Commission"], true);
    expect(s.open).toContain("Commission");
    expect(s.skipped).toEqual(["Commission"]);
  });

  it("a skipped question answered later is not counted as skipped", () => {
    const s = tellState(REALTOR, [{ label: "Commission", value: "2.5%" }], ["Commission"]);
    expect(s.skipped).toEqual([]);
  });
});

describe("the card on Today", () => {
  it(`is offered once, while ${CARD_MIN_OPEN} or more are still to ask`, () => {
    expect(showTellCard(CARD_MIN_OPEN, null)).toBe(true);
    expect(showTellCard(CARD_MIN_OPEN - 1, null)).toBe(false);
    expect(showTellCard(8, new Date())).toBe(false);
  });

  it("says what FollowUp knows so far", () => {
    expect(knowsLine(3)).toBe("FollowUp knows 3 things about your business");
    expect(knowsLine(1)).toBe("FollowUp knows 1 thing about your business");
    expect(knowsLine(0)).toBe("Your business");
  });

  it("turns each example into the line under FollowUp's question", () => {
    expect(exampleLine("e.g. Toronto and Mississauga")).toBe("For example: Toronto and Mississauga");
    expect(exampleLine("")).toBe("");
  });
});

describe("what FollowUp took from an answer", () => {
  it("is the answer to the question asked, then what was said in passing, under the question it answers", () => {
    const rows = tellRows(
      whatYouDo,
      ANSWER,
      {
        main: "I'm a realtor in Mississauga and Oakville. Mostly buyers and sellers, a few rentals.",
        also: [
          { label: "area you cover", value: "Mississauga and Oakville" },
          { label: "Languages", value: "English and Punjabi" },
        ],
      },
      labels
    );
    expect(rows).toEqual([
      { label: WHAT_YOU_DO_LABEL, value: "I'm a realtor in Mississauga and Oakville. Mostly buyers and sellers, a few rentals." },
      { label: "Area you cover", value: "Mississauga and Oakville" },
      { label: "Languages", value: "English and Punjabi" },
    ]);
  });

  it("drops anything not copied word for word from the answer", () => {
    const rows = tellRows(
      whatYouDo,
      ANSWER,
      {
        main: "Realtor: buying, selling, and some rentals",
        also: [
          { label: "Languages", value: "English, Punjabi and Hindi" },
          { label: "Commission", value: "2.5%" },
        ],
      },
      labels
    );
    // The rewritten main falls back to the owner's whole answer; the invented values are gone.
    expect(rows).toEqual([{ label: WHAT_YOU_DO_LABEL, value: ANSWER }]);
  });

  it("is the whole answer when the model gives nothing", () => {
    expect(tellRows(whatYouDo, "  We sell homes  in Brampton ", null, labels)).toEqual([{ label: WHAT_YOU_DO_LABEL, value: "We sell homes in Brampton" }]);
  });

  it("never repeats a name or a value, never takes an over-long name, and stops at the limit", () => {
    const also = [
      { label: WHAT_YOU_DO_LABEL, value: "Mississauga" },
      { label: "Places", value: "I'm a realtor in Mississauga and Oakville. Mostly buyers and sellers, a few rentals." },
      { label: "x".repeat(41), value: "Oakville" },
      { label: "A", value: "Mississauga" },
      { label: "B", value: "Oakville" },
      { label: "C", value: "buyers and sellers" },
      { label: "D", value: "a few rentals" },
    ];
    const rows = tellRows(whatYouDo, ANSWER, { main: "I'm a realtor in Mississauga and Oakville. Mostly buyers and sellers, a few rentals.", also }, labels);
    expect(rows.map((r) => r.label)).toEqual([WHAT_YOU_DO_LABEL, "A", "B", "C"]);
    expect(rows).toHaveLength(MAX_ROWS);
  });

  it("keeps a long answer to whole sentences that fit", () => {
    const long = `${"We renovate kitchens. ".repeat(12)}And bathrooms.`;
    const v = wholeAnswer(long)!;
    expect(v.length).toBeLessThanOrEqual(MAX_VALUE);
    expect(v.endsWith(".")).toBe(true);
    expect(long.includes(v)).toBe(true);
  });
});

describe("what the owner OK'd, checked again on the server", () => {
  const ok = [
    { label: WHAT_YOU_DO_LABEL, value: "I'm a realtor in Mississauga and Oakville." },
    { label: "Languages", value: "English and Punjabi" },
  ];

  it("is kept when every value is in their answer and the question's own row comes first", () => {
    expect(checkedRows(whatYouDo, ANSWER, ok)).toEqual(ok);
  });

  it("is refused when a value was changed, the question's row is missing, or a name repeats", () => {
    expect(checkedRows(whatYouDo, ANSWER, [ok[0], { label: "Languages", value: "English, Punjabi and Hindi" }])).toBeNull();
    expect(checkedRows(whatYouDo, ANSWER, [ok[1]])).toBeNull();
    expect(checkedRows(whatYouDo, ANSWER, [ok[0], { ...ok[1], label: "what you do" }])).toBeNull();
    expect(checkedRows(whatYouDo, ANSWER, [])).toBeNull();
  });
});
