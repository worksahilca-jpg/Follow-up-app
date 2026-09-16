/**
 * The promises FollowUp makes about its own automation, checked against
 * what the code actually does.
 *
 * Settings told owners the instant reply was "a fixed sentence, not an AI
 * reply". That was true when the feature shipped and stopped being true
 * when it became generateInstantReply behind the two-layer gate. Nobody
 * updated the sentence, and it sat in the one paragraph a cautious owner
 * actually reads before deciding whether to trust the thing.
 *
 * A false trust promise is worse than no promise. It is the claim a
 * customer would quote back if an automated message ever embarrassed
 * them, and discovering it was wrong costs more than the feature was ever
 * worth.
 *
 * These assertions are deliberately about the SOURCE, so they fail in
 * unit tests where someone will see them, rather than in front of a
 * customer.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// JSX wraps these sentences across source lines, so whitespace is
// collapsed before matching — otherwise a reflow by a formatter would
// break the test without changing a word the customer reads.
const settings = () =>
  readFileSync(join(__dirname, "..", "..", "app", "(app)", "settings", "page.tsx"), "utf8").replace(/\s+/g, " ");

describe("the instant-reply promise", () => {
  it("does not claim the reply is a fixed sentence", () => {
    // It is generated per message. checkAckShape and assessAckRisk are
    // what make it safe — not it being static.
    expect(settings()).not.toMatch(/fixed sentence, not an AI reply/i);
  });

  // Each of these IS enforced, so each is fair to promise. If one is ever
  // removed from the code, this test is the reminder that the sentence
  // promising it has to go too.
  it("keeps the promises the code actually enforces", () => {
    const copy = settings();
    // checkAckShape: no digit, currency or time the lead didn't write.
    expect(copy).toMatch(/price, a date, a time or a number/i);
    // The fallback when either gate refuses.
    expect(copy).toMatch(/falls back to a fixed, always-safe line/i);
    // The atomic claim on Lead.acknowledgedAt.
    expect(copy).toMatch(/once per lead/i);
    // The prior-outbound check.
    expect(copy).toMatch(/never if you&apos;ve already replied/i);
    // The DM opt-out added 2026-09-16.
    expect(copy).toMatch(/never to someone who asked us to stop/i);
  });

  // The grace period made the old "within a minute" false on DM channels.
  // 2-3 minutes is what the one-minute cron can actually deliver.
  it("states the DM delay honestly", () => {
    expect(settings()).toMatch(/two to three minutes/i);
  });
});
