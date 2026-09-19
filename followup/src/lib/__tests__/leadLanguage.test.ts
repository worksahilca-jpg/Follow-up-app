/**
 * How a lead writes, decided once and held steady.
 *
 * The founder's instruction, 2026-09-19: replies must be "in the same
 * language and same tone". Language was already handled by showing the
 * model the lead's own message; TONE was not, and could not be, because
 * nothing was stored — every message re-decided formality from whatever
 * text was in front of it. These pin the two halves of the fix: a parser
 * that refuses to invent an answer, and a prompt line that only claims
 * what was actually decided.
 */
import { describe, it, expect } from "vitest";
import { parseRegister, leadLanguageOf, registerInstruction } from "@/lib/leadLanguage";

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
