/**
 * How a lead writes, read fresh from their newest message.
 *
 * The founder's instruction, 2026-09-19: replies "in the same language
 * and same tone" — and, when an early build locked the language to the
 * first message, his correction: "whatever language the lead will
 * approach, we will reply in the same language." So the newest message
 * always decides; what is stored is a reading, not a verdict.
 *
 * These pin three things that each refuse to invent an answer: a parser
 * that will not pass an improvised register to a prompt, a prompt line
 * that claims nothing when nothing was read, and an owner-facing
 * sentence that shows a language code rather than a name we made up.
 */
import { describe, it, expect } from "vitest";
import { parseRegister, leadLanguageOf, registerInstruction, describeLeadLanguage } from "@/lib/leadLanguage";

describe("parseRegister", () => {
  it("keeps the two real answers, case- and space-insensitively", () => {
    expect(parseRegister("formal")).toBe("formal");
    expect(parseRegister("  INFORMAL ")).toBe("informal");
  });

  // The model is asked for one of three words. If it improvises
  // ("semi-formal", "polite-ish"), that string would otherwise reach a
  // prompt, which turns it into an instruction to write in a register
  // that does not exist.
  it("collapses anything else to neutral, including an improvised register", () => {
    for (const bad of ["semi-formal", "polite", "", null, undefined, 7, {}]) {
      expect(parseRegister(bad)).toBe("neutral");
    }
  });
});

describe("leadLanguageOf", () => {
  it("reads the three columns off a lead row", () => {
    expect(leadLanguageOf({ language: "es", languageScript: "Latn", languageRegister: "formal" })).toEqual({
      language: "es",
      script: "Latn",
      register: "formal",
    });
  });

  // Half an answer is not an answer: a script with no language, or a
  // language with no script, would be stored and used as though it were
  // complete.
  it("returns null unless BOTH language and script are present", () => {
    expect(leadLanguageOf({ language: "es", languageScript: null })).toBeNull();
    expect(leadLanguageOf({ language: null, languageScript: "Latn" })).toBeNull();
    expect(leadLanguageOf(null)).toBeNull();
    expect(leadLanguageOf(undefined)).toBeNull();
  });
});

describe("registerInstruction", () => {
  // The whole safety property of this feature: a lead nobody has
  // detected yet must behave exactly as they did before it existed. An
  // empty string adds nothing to the prompt, so the existing "match
  // their most recent message" paragraph stands alone.
  it("says nothing at all when nothing was decided", () => {
    expect(registerInstruction(null)).toBe("");
    expect(registerInstruction({ language: "es" })).toBe("");
    expect(registerInstruction({ script: "Latn" })).toBe("");
  });

  it("names the concrete forms, not just 'be formal'", () => {
    const formal = registerInstruction({ language: "es", script: "Latn", register: "formal" });
    expect(formal).toContain("usted");
    expect(formal).not.toContain("tú /");

    const informal = registerInstruction({ language: "de", script: "Latn", register: "informal" });
    expect(informal).toContain("du");
    expect(informal).not.toContain("Sie /");
  });

  // "Be neutral" is not a mode any language has. Instructing it invites
  // a stiffness that is not in the customer's own message, so a neutral
  // register names the language and stops.
  it("says nothing about formality for a neutral register", () => {
    const out = registerInstruction({ language: "en", script: "Latn", register: "neutral" });
    expect(out).toContain("en");
    expect(out).not.toMatch(/formal|familiar|usted|vous/i);
  });

  // Hindi or Punjabi typed in English letters must be answered the same
  // way. Switching to Devanagari because "that is how Hindi is written"
  // is the mistake this spells out.
  it("tells the model to stay in Latin letters when that is what they typed", () => {
    const out = registerInstruction({ language: "hi", script: "Latn", register: "neutral" });
    expect(out).toMatch(/Latin letters/);
    expect(out).toMatch(/do not switch/i);
  });

  it("names a non-Latin script plainly", () => {
    expect(registerInstruction({ language: "hi", script: "Deva", register: "neutral" })).toContain("Deva script");
  });
});

/**
 * The same three facts, said to a business owner on their phone rather
 * than to a model. Brand principle 9: every word understood by someone
 * who has never used software like this — so no "register", no "script",
 * no language codes where a name exists.
 */
describe("describeLeadLanguage", () => {
  it("says nothing at all when nothing has been read", () => {
    expect(describeLeadLanguage(null)).toBeNull();
  });

  it("names the language in the word people actually use", () => {
    expect(describeLeadLanguage({ language: "pa", script: "Guru", register: "neutral" })).toBe("Punjabi.");
    // ...not "Panjabi", which is the standard's name and nobody else's.
    expect(describeLeadLanguage({ language: "es", script: "Latn", register: "neutral" })).toBe("Spanish.");
  });

  // The single most useful thing this line can say: Hinglish is a lead
  // writing Hindi in English letters, and a reply in Devanagari is the
  // most visible way to get it wrong.
  it("calls out a language typed in English letters, which is the case that matters", () => {
    expect(describeLeadLanguage({ language: "hi", script: "Latn", register: "neutral" })).toBe(
      "Hindi, typed in English letters."
    );
  });

  it("stays quiet about letters when they are the language's usual ones", () => {
    expect(describeLeadLanguage({ language: "hi", script: "Deva", register: "neutral" })).toBe("Hindi.");
    expect(describeLeadLanguage({ language: "fr", script: "Latn", register: "neutral" })).not.toMatch(/letters/);
  });

  it("says how formally they wrote, in plain words", () => {
    expect(describeLeadLanguage({ language: "es", script: "Latn", register: "formal" })).toBe(
      "Spanish — and they wrote formally."
    );
    expect(describeLeadLanguage({ language: "de", script: "Latn", register: "informal" })).toBe(
      "German — and they wrote casually."
    );
  });

  // Truthful beats pretty: a language we did not plan for shows its code
  // rather than a name we invented for it.
  it("falls back to the raw code rather than inventing a name", () => {
    expect(describeLeadLanguage({ language: "xx", script: "Latn", register: "neutral" })).toBe("xx.");
  });

  it("never uses the words the code uses", () => {
    const all = [
      describeLeadLanguage({ language: "es", script: "Latn", register: "formal" }),
      describeLeadLanguage({ language: "hi", script: "Latn", register: "informal" }),
    ].join(" ");
    expect(all).not.toMatch(/register|script|BCP|Latn|Deva/i);
  });
});
