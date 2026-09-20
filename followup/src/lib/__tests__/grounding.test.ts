/**
 * The deterministic net under four prompt rules.
 *
 * 2026-09-20 produced four separate "the drafter invented something"
 * fixes — a confirmed event, an adopted premise, a denial of being
 * automated, an invented qualifying question — and all four were another
 * sentence in a prompt. The pattern underneath them is one thing: the
 * drafter fills silence with specifics.
 *
 * Both shape checks already enforce exactly that invariant for numbers,
 * and the rule works in every language because digits are digits. What
 * neither covered was a specific with no digits in it. The message that
 * went to a real lead had none:
 *
 *     lead:     "Hey is this still available?"   (twice, nothing else)
 *     FollowUp: "Checking on the status now. Will this be for a weekday
 *                or weekend?"
 *     lead:     "What do you mean"
 *
 * These tests are written against that exact exchange.
 */
import { describe, it, expect } from "vitest";
import { ungroundedCalendarWords } from "@/lib/grounding";

const whatTheLeadSaid = "Hey is this still available?\nHey is this Still Available?";

describe("the message that actually went out", () => {
  it("catches 'weekday or weekend' against a thread that mentions neither", () => {
    const draft = "Checking on the status now. Will this be for a weekday or weekend?";
    expect(ungroundedCalendarWords(draft, whatTheLeadSaid)).toEqual(
      expect.arrayContaining(["weekday", "weekend"])
    );
  });

  it("passes the same draft once the lead has actually raised it", () => {
    const draft = "Checking on the status now. Will this be for a weekday or weekend?";
    const source = "Hey is this still available? Looking for a weekday or weekend slot.";
    expect(ungroundedCalendarWords(draft, source)).toEqual([]);
  });

  it("leaves an honest draft with no specifics alone", () => {
    const draft = "Checking on the status now — what is it you're asking about?";
    expect(ungroundedCalendarWords(draft, whatTheLeadSaid)).toEqual([]);
  });
});

describe("days and months, in any language Intl knows", () => {
  it("catches an invented day", () => {
    expect(ungroundedCalendarWords("Does Thursday work?", "Are you free this week?")).toContain("thursday");
  });

  it("catches an invented month", () => {
    expect(ungroundedCalendarWords("Shall we say September?", "Are you free soon?")).toContain("september");
  });

  it("grounds a day the LEAD named", () => {
    expect(ungroundedCalendarWords("Thursday works — I'll confirm.", "Could we do Thursday?")).toEqual([]);
  });

  it("grounds a day the business already named earlier in the thread", () => {
    // Source is the whole thread, both directions: a day we named in an
    // earlier message is as grounded as one the lead named.
    const source = "Lead: are you free?\nUs: Thursday or Friday suit us.\nLead: ok";
    expect(ungroundedCalendarWords("Shall we lock in Friday?", source)).toEqual([]);
  });

  // The reason this uses Intl instead of a list of English day names: the
  // founder rejected exactly that shortcut once already, on the WhatsApp
  // history filter — "a keyword list can only ever be as multilingual as
  // the person who wrote it remembered to be."
  it("catches an invented day in Spanish, in a Spanish thread", () => {
    const found = ungroundedCalendarWords("¿Te viene bien el jueves?", "Hola, ¿sigue disponible?", "es");
    expect(found).toContain("jueves");
  });

  it("grounds a Spanish day the lead named", () => {
    expect(ungroundedCalendarWords("El jueves perfecto.", "¿Podemos el jueves?", "es")).toEqual([]);
  });

  it("catches an invented day in French", () => {
    expect(ungroundedCalendarWords("Est-ce que mardi vous convient ?", "Bonjour, c'est disponible ?", "fr")).toContain(
      "mardi"
    );
  });
});

describe("it does not cry wolf", () => {
  it("does not fire on a substring inside an unrelated word", () => {
    // "mar" is a short month form in several locales; "market" must not
    // ground or trip it. Whole-word matching is what makes this safe.
    expect(ungroundedCalendarWords("I'll check the market and come back.", "Hey, any update?")).toEqual([]);
  });

  it("does not fire on 'sat' inside 'satisfied'", () => {
    expect(ungroundedCalendarWords("Glad you're satisfied — I'll follow up.", "Thanks, all good.")).toEqual([]);
  });

  it("survives a malformed locale rather than throwing", () => {
    // A check that throws would block a send, which is the opposite of
    // what a safety net is for.
    expect(() => ungroundedCalendarWords("Does Thursday work?", "hi", "not-a-locale!!")).not.toThrow();
    expect(ungroundedCalendarWords("Does Thursday work?", "hi", "not-a-locale!!")).toContain("thursday");
  });

  it("handles an empty draft and an empty source", () => {
    expect(ungroundedCalendarWords("", "")).toEqual([]);
    expect(ungroundedCalendarWords("Thursday", "")).toContain("thursday");
  });

  it("is case-insensitive in both directions", () => {
    expect(ungroundedCalendarWords("THURSDAY?", "could we do thursday")).toEqual([]);
  });
});

/**
 * The wiring, not just the helper.
 *
 * A grounding function that is correct but never called is the same as
 * no grounding function. These go through the two real shape checks —
 * the ones that stand between a draft and a send — with the exact draft
 * that got through them.
 */
describe("both shape checks actually apply it", () => {
  it("checkDmDraftShape now rejects the message that went out", async () => {
    const { checkDmDraftShape } = await import("@/lib/dmDrafts");
    const shape = checkDmDraftShape(
      { body: "Checking on the status now. Will this be for a weekday or weekend?", buttons: [] },
      whatTheLeadSaid
    );
    expect(shape.ok).toBe(false);
    expect(shape.ok === false && shape.rule).toBe("calendar");
  });

  it("checkDmDraftShape still accepts it when the lead raised it first", async () => {
    const { checkDmDraftShape } = await import("@/lib/dmDrafts");
    const shape = checkDmDraftShape(
      { body: "Checking on the status now. Will this be for a weekday or weekend?", buttons: [] },
      "Hey is this still available for a weekday or weekend?"
    );
    expect(shape.ok).toBe(true);
  });

  it("checkAckShape rejects an invented day in a first reply", async () => {
    const { checkAckShape } = await import("@/lib/acknowledge");
    const shape = checkAckShape(
      "Got it — I'll confirm availability and come back to you Thursday.",
      "Hey is this still available?",
      "Sahil"
    );
    expect(shape.ok).toBe(false);
    expect(shape.ok === false && shape.rule).toBe("calendar");
  });

  it("checkAckShape leaves a first reply with no invented specifics alone", async () => {
    const { checkAckShape } = await import("@/lib/acknowledge");
    const shape = checkAckShape(
      "Got it — I'll check on availability and come back to you shortly.",
      "Hey is this still available?",
      "Sahil"
    );
    expect(shape.ok).toBe(true);
  });
});
