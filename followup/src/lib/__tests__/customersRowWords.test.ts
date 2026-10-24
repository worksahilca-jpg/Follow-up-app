/**
 * Customers says what the owner has to do in words (founder, 2026-10-24: "Dots should not be there. We should say
 * what action needed", R-141). The first message-list rows (A-324) marked a ready reply with a dot and bold only.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(__dirname, "..", "..", "app", "(app)", "leads", "LeadsPageClient.tsx"), "utf8");

describe("Customers rows (R-141)", () => {
  it("say the action in words", () => {
    expect(source).toContain('"Check and send your reply"');
    expect(source).toContain('"Ready to book. Call them"');
  });

  it("have no dot standing in for the words", () => {
    expect(source).not.toMatch(/role="img"/);
    expect(source).not.toContain("var(--state-needs)");
  });
});
