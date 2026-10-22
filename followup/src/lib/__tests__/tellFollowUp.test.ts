/**
 * "Tell FollowUp about your business" (A-311, A-314): which questions are asked and in what order, where the meeting is
 * from what FollowUp already knows and what it took so far, the play-back at the end, and the promise that every value
 * shown or saved is the owner's own words, copied or typed by them, never written by FollowUp.
 */
import { describe, it, expect } from "vitest";
import {
  CARD_MIN_OPEN,
  checkedRead,
  checkedWording,
  confirmedRows,
  correctionRows,
  mergeRows,
  parseTellDraft,
  playbackRows,
  usageLines,
  currentTopic,
  NOT_OFFERED_LABEL,
  WHO_LABEL,
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

  it("ask every business who its customers are and what it doesn't do (A-313), each once", () => {
    const general = tellTopics("Other").map((t) => t.label);
    expect(general[0]).toBe(WHAT_YOU_DO_LABEL);
    expect(general[1]).toBe(WHO_LABEL);
    expect(general[general.length - 1]).toBe(NOT_OFFERED_LABEL);
    expect(general).toHaveLength(9);
    // A realtor is already asked who they work with, in their trade's own words: not twice.
    expect(labels.filter((l) => l === WHO_LABEL)).toHaveLength(1);
    expect(tellTopic(REALTOR, WHO_LABEL)?.question).toBe("Do you work with buyers, sellers or both?");
    expect(labels[labels.length - 1]).toBe(NOT_OFFERED_LABEL);
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

describe("the question asked now", () => {
  it("is the first still open, after the ones skipped on this visit", () => {
    const s = tellState(REALTOR, [{ label: WHAT_YOU_DO_LABEL, value: "Realtor" }], []);
    expect(currentTopic(s)?.label).toBe("Commission");
    expect(currentTopic(s, ["commission"])?.label).toBe("Area you cover");
    expect(currentTopic(tellState(REALTOR, [], []), labels)).toBeNull();
  });
});

describe("FollowUp's own wording of a question (A-313)", () => {
  const price = tellTopic("Other", "Prices")!;

  it("is used when it is a short plain question, with an example that reads as one", () => {
    const w = checkedWording(
      { question: "How do you price a website for a restaurant or salon? Set packages, or a quote after a call?", example: "e.g. Starter site $900 for 5 pages" },
      price
    );
    expect(w).toEqual({
      label: "Prices",
      question: "How do you price a website for a restaurant or salon? Set packages, or a quote after a call?",
      example: "e.g. Starter site $900 for 5 pages",
    });
  });

  it("keeps the plain example when FollowUp's doesn't read as one", () => {
    expect(checkedWording({ question: "How do you price a site?", example: "Starter site $900" }, price)?.example).toBe(price.example);
  });

  it("is dropped for anything that isn't a plain question: praise, markup, links, a statement, or too long", () => {
    for (const question of [
      "Great! How do you price a site?",
      "How do you price a <b>site</b>?",
      "How do you price a site? See https://example.com",
      "Tell me how you price a site.",
      `How do you price ${"a very long thing ".repeat(15)}?`,
      "",
    ]) {
      expect(checkedWording({ question, example: "e.g. $900" }, price), question).toBeNull();
    }
    expect(checkedWording(null, price)).toBeNull();
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

describe("the meeting's draft (A-314)", () => {
  it("counts as answered, so a question isn't asked twice, though nothing in it is in use", () => {
    const s = tellState(REALTOR, [], [], false, [{ label: "what you do", value: "Realtor" }, { label: "Commission", value: "2.5%" }]);
    expect(s.open[0]).toBe("Area you cover");
    expect(s.facts).toEqual([]);
    expect(s.draft).toHaveLength(2);
  });

  it("is read back from the database checked again: bad lines and repeats dropped, the read kept", () => {
    const d = parseTellDraft({
      rows: [
        { label: "Prices", value: " From $900 " },
        { label: "prices", value: "twice" },
        { label: "", value: "no name" },
        { label: "Area", value: "x".repeat(MAX_VALUE + 1) },
        "not a row",
      ],
      read: "You build websites.",
    });
    expect(d).toEqual({ rows: [{ label: "Prices", value: "From $900" }], read: "You build websites." });
    expect(parseTellDraft(null)).toEqual({ rows: [] });
  });

  it("takes a new answer over the old one under the same name, where it stands", () => {
    const rows = mergeRows(
      [
        { label: "Prices", value: "From $800" },
        { label: "Area you cover", value: "Brampton" },
      ],
      [
        { label: "prices", value: "From $900" },
        { label: "Payment", value: "Half up front" },
      ]
    );
    expect(rows.map((r) => r.value)).toEqual(["From $900", "Brampton", "Half up front"]);
  });
});

describe("the play-back (A-314)", () => {
  const facts = [
    { label: "Languages", value: "English and Punjabi" },
    { label: "Commission", value: "2%" },
  ];
  const draft = [
    { label: "What you do", value: "I sell homes in Brampton" },
    { label: "Commission", value: "2.5% of the sale price" },
    { label: "Commission", value: "2.5% of the sale price" },
  ];

  it("is the whole business, in the order the questions are asked, marking what this meeting changed", () => {
    const rows = playbackRows(facts, draft, labels);
    expect(rows).toEqual([
      { label: "What you do", value: "I sell homes in Brampton", fresh: true },
      { label: "Commission", value: "2.5% of the sale price", fresh: true },
      { label: "Languages", value: "English and Punjabi", fresh: false },
    ]);
    expect(playbackRows(facts, [{ label: "Languages", value: "English and Punjabi" }], labels).every((r) => !r.fresh)).toBe(true);
  });

  it("says how FollowUp will use it, only what it really does, in at most three lines", () => {
    const rows = [
      { label: "Prices", value: "Most sites start at $900 for 5 pages" },
      { label: NOT_OFFERED_LABEL, value: "We don't do logos or printing" },
      { label: "Area you cover", value: "Anywhere in the GTA" },
    ];
    expect(usageLines(rows, ["Hours", "Languages"])).toEqual([
      ["Asked the price", "it answers with “Most sites start at $900 for 5 pages”."],
      ["Asked for something you don't do", "it answers with “We don't do logos or printing”."],
      ["Asked about hours", "it doesn't know yet, so it waits for you."],
    ]);
    expect(usageLines([], [])).toEqual([]);
    const long = usageLines([{ label: "Commission", value: `${"Two and a half percent of the sale price ".repeat(4)}` }], [])[0][1];
    expect(long.length).toBeLessThan(120);
    expect(long).toContain("…”");
  });
});

describe("FollowUp's read of the business (A-314)", () => {
  const rows = [
    { label: "What you do", value: "I provide web designing services" },
    { label: "Who you work with", value: "Mostly small businesses in Brampton, a lot of restaurants and salons" },
    { label: "Prices", value: "Most sites start at $900 for 5 pages" },
  ];

  it("is kept when it only repeats what the owner said", () => {
    const read = "You design websites for small businesses in Brampton, mostly restaurants and salons. Sites start at $900 for 5 pages.";
    expect(checkedRead(read, rows)).toBe(read);
  });

  it("is dropped when it adds a figure, a place or a name, gushes, or links", () => {
    for (const read of [
      "You design websites in Brampton. Sites start at $700 for 5 pages.",
      "You design websites for businesses in Brampton and Toronto.",
      "You are Brampton's favourite web designer!",
      "You design websites. See www.example.com for more.",
      "Too short.",
      "",
    ]) {
      expect(checkedRead(read, rows), read).toBeNull();
    }
    expect(checkedRead(null, rows)).toBeNull();
  });
});

describe("Anything wrong or missing? (A-314)", () => {
  it("takes each thing the owner stated in their words, under a name FollowUp uses when it is the same thing", () => {
    const rows = correctionRows(
      "Actually it's from $1,000 now, and we also do Shopify stores",
      [
        { label: "prices", value: "from $1,000 now" },
        { label: "Shopify", value: "we also do Shopify stores" },
        { label: "Hours", value: "9 to 5" },
      ],
      ["Prices", "Hours"]
    );
    expect(rows).toEqual([
      { label: "Prices", value: "from $1,000 now" },
      { label: "Shopify", value: "we also do Shopify stores" },
    ]);
    expect(correctionRows("hmm", null, ["Prices"])).toEqual([]);
  });
});

describe("Looks right (A-314)", () => {
  const rows = [
    { label: "What you do", value: "I sell homes", fresh: true },
    { label: "Commission", value: "2.5%", fresh: true },
    { label: "Languages", value: "English", fresh: false },
  ];

  it("saves this meeting's lines, with the owner's edits, and a known line only when they changed it", () => {
    expect(confirmedRows(rows, [])).toEqual([
      { label: "What you do", value: "I sell homes" },
      { label: "Commission", value: "2.5%" },
    ]);
    expect(
      confirmedRows(rows, [
        { label: "commission", value: "3%" },
        { label: "Languages", value: "English and Punjabi" },
      ])
    ).toEqual([
      { label: "What you do", value: "I sell homes" },
      { label: "Commission", value: "3%" },
      { label: "Languages", value: "English and Punjabi" },
    ]);
  });

  it("leaves a new line out when the owner empties it, but never empties one already in use", () => {
    expect(confirmedRows(rows, [{ label: "Commission", value: " " }])).toEqual([{ label: "What you do", value: "I sell homes" }]);
    expect(confirmedRows(rows, [{ label: "Languages", value: "" }])).toBeNull();
  });

  it("refuses an edit to a line that isn't there", () => {
    expect(confirmedRows(rows, [{ label: "Bank account", value: "123" }])).toBeNull();
  });
});
