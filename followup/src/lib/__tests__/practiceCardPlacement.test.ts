/**
 * Where the practice card sits on Today (A-330): the daily question's slot, only when there is no question, nobody
 * waiting and no setup step left (one black button on a phone screen), admins only; and the words the founder approved.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const root = join(__dirname, "..", "..");
const today = readFileSync(join(root, "app", "(app)", "dashboard", "page.tsx"), "utf8");
const card = readFileSync(join(root, "components", "PracticeCard.tsx"), "utf8");

describe("the practice card on Today", () => {
  it("takes the daily question's slot only when there is no question, nobody waiting and no setup step", () => {
    const line = today.slice(today.indexOf("const practice ="), today.indexOf("await todaysPractice("));
    for (const part of ["quietForQuestions", "!tellCard", "!dailyQuestion", "setupSteps.length === 0", "OPENAI_API_KEY"]) expect(line).toContain(part);
    const question = today.indexOf("<DailyQuestion question={dailyQuestion} />");
    const practice = today.indexOf("{isAdmin && practice && <PracticeCard");
    expect(question).toBeGreaterThan(0);
    expect(practice).toBeGreaterThan(question);
  });

  it("says it is made up and nothing is sent, with Looks right, Change it and Not now", () => {
    for (const words of ["Practice · a made-up customer · nothing is sent", "Is this how you&apos;d say it?", "Looks right", "Change it", "Not now", "What would you say?", "Saved. FollowUp will answer like this from now on.", "Undo"]) {
      expect(card).toContain(words);
    }
  });

  it("keeps a change the way Write it better does, and closes the slot for the day", () => {
    expect(card).toContain('post("/api/practice/teach"');
    expect(card).toContain('post("/api/practice/daily", { step: "done" })');
    expect(card).not.toMatch(/streak|points/i);
  });
});
