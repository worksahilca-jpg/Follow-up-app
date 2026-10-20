/**
 * The owner's own questions, in their order (A-302, src/lib/askPlan.ts). The first realtor (2026-10-20) asks status
 * first, then income and down payment, then job, where they live and the areas. What FollowUp keeps from a model's
 * reading of that is decided here, by fixed rules: status is never asked in writing, income becomes the lender
 * question, and when, the lender and an agent are added if left out.
 */
import { describe, expect, it } from "vitest";
import type { Message } from "@/lib/types";
import { finishPlan, neverInWriting, ownKey, planRounds, readAskPlan, reorderPlan, type ProposedPlan, type ProposedStep } from "@/lib/askPlan";
import {
  customerTexts,
  knownPromptBlock,
  markOffered,
  mergeQualification,
  nextToAsk,
  readQualification,
  shownItems,
  stillToLearn,
  templateFor,
  tierOf,
  type ExtractedItem,
} from "@/lib/qualification";

const HIS_WORDS =
  "First if they're PR or on a work permit. Then their income and how much they have for a down payment. Then their job, where they live now, and which areas they want.";

const own = (label: string, question: string, ask: string, find: string): ProposedStep => ({ kind: "own", label, question, ask, find });
const known = (kind: ProposedStep["kind"], label: string): ProposedStep => ({ kind, label, question: "", ask: "", find: "" });

/** What a model could plausibly propose for his words, status included: the fixed rules have to catch it. */
const proposed: ProposedPlan = {
  steps: [
    own("Status in Canada", "Are you a PR or on a work permit?", "whether they are a permanent resident", "their immigration status"),
    own("Down payment", "How much have you put aside for a down payment?", "how much they have saved for a down payment", "how much they have saved for a down payment, or that they have nothing saved yet"),
    own("Income", "What's your household income?", "their income", "what they earn"),
    own("Their job", "What kind of work do you do?", "what kind of work they do", "what they do for work"),
    own("Where they live now", "Where are you living right now?", "where they live now", "the city or area they live in now"),
    known("area", "Areas"),
  ],
  forCall: [],
};

const NOW = new Date("2026-10-20T15:00:00Z");

describe("making his plan", () => {
  const plan = finishPlan(HIS_WORDS, proposed, NOW)!;

  it("keeps his order, with status kept for his call", () => {
    expect(plan.steps.map((s) => s.label)).toEqual(["Down payment", "Income", "Their job", "Where they live now", "Areas", "When", "Their agent"]);
    expect(plan.forCall).toEqual(["Status in Canada"]);
  });

  it("asks income as the lender question, never as a number", () => {
    const income = plan.steps.find((s) => s.label === "Income")!;
    expect(income.key).toBe("financing");
    expect(income.question).toBe("Have you spoken with a lender yet?");
  });

  it("adds when and an agent, marked as added; the lender is already there", () => {
    expect(plan.steps.filter((s) => s.added).map((s) => s.key)).toEqual(["timing", "agent"]);
  });

  it("uses FollowUp's own wording for what it already knows how to ask", () => {
    expect(plan.steps.find((s) => s.key === "area")?.question).toBe("Which areas are you hoping to buy in?");
  });

  it("keeps his own questions with what to ask and what counts as an answer", () => {
    const down = plan.steps[0];
    expect(down).toMatchObject({ key: "own:down-payment", question: "How much have you put aside for a down payment?" });
    expect(down.ask && down.find).toBeTruthy();
  });

  it("keeps his words as he wrote them", () => {
    expect(plan.words).toBe(HIS_WORDS);
    expect(plan.madeAt).toBe(NOW.toISOString());
  });

  it("asks two at a time, in his order", () => {
    expect(planRounds(plan)).toEqual([["own:down-payment", "financing"], ["own:their-job", "own:where-they-live-now"], ["area", "timing"], ["agent"]]);
  });

  it("is nothing when nothing in it can be asked", () => {
    expect(finishPlan("Only PR", { steps: [own("Status", "Are you a PR?", "their status", "their status")], forCall: [] })).toBeNull();
    expect(finishPlan("", { steps: [], forCall: [] })).toBeNull();
  });

  it("never lets a model's 'for your call' list grow past a few short names", () => {
    const p = finishPlan("area", { steps: [known("area", "Area")], forCall: ["a", "b", "c", "d", "e", "A"] })!;
    expect(p.forCall).toEqual(["a", "b", "c", "d"]);
  });

  it("caps his own questions at five and the list at eight", () => {
    const many = Array.from({ length: 9 }, (_, i) => own(`Thing ${i}`, `Question ${i}?`, `thing ${i}`, `thing ${i}`));
    const p = finishPlan("lots", { steps: many, forCall: [] })!;
    expect(p.steps.filter((s) => !s.added)).toHaveLength(5);
  });
});

describe("what is never asked in writing", () => {
  it.each([
    "Are you a PR?",
    "Do you have a work permit?",
    "What's your immigration status?",
    "Are you a Canadian citizen?",
    "Where are you from originally?",
    "Are you married?",
    "Do you have kids?",
    "How old are you?",
    "Do you go to church?",
    "Are you on ODSP?",
  ])("%s", (q) => expect(neverInWriting(q)).toBe(true));

  it.each([
    "How much have you put aside for a down payment?",
    "Where are you living right now?",
    "Have you spoken with a lender yet?",
    "Are you looking at a mortgage pre-approval?",
    "Which areas are you hoping to buy in?",
    "Do you want a single-family home?",
  ])("but asks %s", (q) => expect(neverInWriting(q)).toBe(false));
});

describe("a stored plan", () => {
  const plan = finishPlan(HIS_WORDS, proposed, NOW)!;

  it("reads back as it was saved", () => {
    expect(readAskPlan(JSON.parse(JSON.stringify(plan)))).toEqual(plan);
  });

  it("drops anything off-shape, and is none without a question of the owner's", () => {
    expect(readAskPlan(null)).toBeNull();
    expect(readAskPlan({ v: 2, steps: [] })).toBeNull();
    expect(readAskPlan({ v: 1, steps: [{ key: "timing", label: "When", question: "When?", added: true }] })).toBeNull();
    const odd = readAskPlan({ ...plan, steps: [...plan.steps, { key: "own:status", label: "Status", question: "Are you a PR?", ask: "status", find: "status" }, { key: "drop table", label: "x", question: "x" }] });
    expect(odd?.steps.map((s) => s.key)).toEqual(plan.steps.map((s) => s.key));
  });

  it("moves to the order the owner dragged it into, and only to a real one", () => {
    const keys = plan.steps.map((s) => s.key);
    const moved = reorderPlan(plan, [keys[4], ...keys.slice(0, 4), ...keys.slice(5)])!;
    expect(moved.steps[0].key).toBe("area");
    expect(reorderPlan(plan, keys.slice(1))).toBeNull();
    expect(reorderPlan(plan, [...keys.slice(1), keys[1]])).toBeNull();
    expect(reorderPlan(plan, [...keys.slice(1), "own:other"])).toBeNull();
  });

  it("names his own question safely", () => {
    expect(ownKey("Where they live now")).toBe("own:where-they-live-now");
    expect(ownKey("Déjà vu?!")).toBe("own:deja-vu");
    expect(ownKey("!!!")).toBe("own:question");
  });
});

describe("the checklist with his order", () => {
  const plan = finishPlan(HIS_WORDS, proposed, NOW)!;
  const template = templateFor("Real estate", plan)!;
  const base = templateFor("Real estate")!;
  const msg = (body: string): Message => ({ id: body, direction: "inbound", body, channel: "email", sentAt: NOW.toISOString() }) as Message;

  it("is FollowUp's own checklist without a plan, and for a business that isn't real estate", () => {
    expect(base.ownOrder).toBeUndefined();
    expect(templateFor("Plumbing", plan)).toBeNull();
    expect(templateFor("Real estate", { v: 1, steps: [] })).toEqual(base);
  });

  it("reads his own questions, and keeps renters and sellers on FollowUp's order", () => {
    expect(template.criteria.map((c) => c.key)).toContain("own:down-payment");
    expect(template.rounds.rent).toEqual(base.rounds.rent);
    expect(template.rounds.sell).toEqual(base.rounds.sell);
  });

  it("asks a buyer his first two questions first", () => {
    const q = mergeQualification(template, null, [{ key: "side", known: true, value: "Buying", quote: "looking to buy", bucket: "buy" }], ["We're looking to buy"]);
    expect(nextToAsk(template, q).map((c) => c.key)).toEqual(["own:down-payment", "financing"]);
  });

  it("asks only which way they're going while that's unclear", () => {
    expect(nextToAsk(template, null).map((c) => c.key)).toEqual(["side"]);
    expect(nextToAsk(base, null).map((c) => c.key)).toEqual(["side", "timing"]);
  });

  it("keeps an answer to his own question with its name, and tells the reply writer", () => {
    const texts = customerTexts([msg("We want to buy. We have about $60k saved")]);
    const found: ExtractedItem[] = [
      { key: "side", known: true, value: "Buying", quote: "We want to buy", bucket: "buy" },
      { key: "own:down-payment", known: true, value: "About $60k saved", quote: "about $60k saved" },
    ];
    let q = mergeQualification(template, null, found, texts);
    expect(q.items.find((i) => i.key === "own:down-payment")).toMatchObject({ value: "About $60k saved", label: "Down payment" });
    expect(nextToAsk(template, q).map((c) => c.key)).toEqual(["financing"]);
    q = markOffered(q, "financing");
    expect(knownPromptBlock(q)).toContain("Down payment: About $60k saved");
    expect(knownPromptBlock(q)).toContain("ALREADY ASKED, NOT ANSWERED: Money");
  });

  it("never asks his question twice, and moves on in his order", () => {
    let q = mergeQualification(template, null, [{ key: "side", known: true, value: "Buying", quote: "want to buy", bucket: "buy" }], ["We want to buy"]);
    q = markOffered(q, "own:down-payment", "financing");
    expect(nextToAsk(template, q).map((c) => c.key)).toEqual(["own:their-job", "own:where-they-live-now"]);
  });

  it("still sorts the customer: moving soon, money sorted, agent asked is Ready", () => {
    const texts = ["We want to buy", "pre-approved", "in the next two months"];
    let q = mergeQualification(
      template,
      null,
      [
        { key: "side", known: true, value: "Buying", quote: "want to buy", bucket: "buy" },
        { key: "financing", known: true, value: "Pre-approved", quote: "pre-approved", bucket: "sorted" },
        { key: "timing", known: true, value: "In about 2 months", quote: "in the next two months", bucket: "soon" },
      ],
      texts
    );
    expect(tierOf(template, q)).toBeNull();
    q = markOffered(q, "agent");
    expect(tierOf(template, q)).toBe("ready");
  });

  it("keeps what they said to a question the owner later took out", () => {
    const stored = readQualification({
      v: 2,
      template: "realtor",
      items: [{ key: "own:down-payment", value: "$60k", quote: "60k saved", label: "Down payment" }],
      offered: ["own:down-payment"],
    })!;
    const merged = mergeQualification(base, stored, [], ["60k saved"]);
    expect(merged.items).toEqual(stored.items);
    expect(shownItems(base, merged).map((s) => s.criterion.label)).toEqual(["Down payment"]);
    expect(knownPromptBlock(merged)).toContain("Down payment: $60k");
  });

  it("lists what's still to learn in his order", () => {
    const q = mergeQualification(template, null, [{ key: "side", known: true, value: "Buying", quote: "want to buy", bucket: "buy" }], ["We want to buy"]);
    expect(stillToLearn(template, q).map((c) => c.label)).toEqual(["Down payment", "Money", "Their job", "Where they live now", "Area", "When", "Agent"]);
  });
});
