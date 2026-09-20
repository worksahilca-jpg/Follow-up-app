/**
 * A conversation FollowUp inherited is not a conversation FollowUp watched.
 *
 * Read out of the founder's own production database, 2026-09-20, after he
 * asked for the real threads to be analysed. Connecting Gmail imports
 * three months of history; every thread arrives already silent; the next
 * hourly tick reads them all as leads who went quiet and writes to them.
 * What actually went out, to real people, in his and a tester's name:
 *
 *   84 days old, a glass supplier — "We appreciate the clarity on the
 *                e-transfer process and will proceed accordingly."
 *   50 days old, a rental application — thanked as if it just arrived.
 *   38 days old, a closed deal — congratulated a second time.
 *   27 days old, a cold pitch — "Thank you for your email."
 *
 * `isCold` (45 days) exists to stop this and stopped two of the four.
 * Age was never the right question: the property that matters is whether
 * FollowUp saw the silence happen or merely inherited it. A lead whose
 * newest message predates the lead row itself has never had a live moment
 * under FollowUp's watch, at any age.
 *
 * Held, not dropped — finding the follow-up nobody sent is the product.
 * The draft is still written and still offered; the owner sees it first.
 */
import { describe, it, expect, vi } from "vitest";

// automation.ts reaches Prisma and the OpenAI client at import time; the
// rule under test is a pure function on two dates and needs neither.
vi.mock("@/lib/db", () => ({ prisma: {} }));

// The REAL function the scheduler calls, not a copy of it. A copy would
// pass with the bug back in place, which is the whole failure this test
// exists to prevent.
import { isBackfilledThread as isBackfilled } from "@/lib/automation";

const DAY = 86_400_000;
/** When FollowUp first created the lead row — i.e. when the import ran. */
const imported = new Date("2026-09-07T00:00:00Z");

function threadEndingDaysBeforeImport(days: number) {
  return { createdAt: imported, lastContacted: new Date(imported.getTime() - days * DAY) };
}

describe("the four real threads that were written to", () => {
  // Every one of these is a message that actually went out.
  it.each([
    ["glass supplier, mid-payment", 84],
    ["rental application", 50],
    ["closed deal", 38],
    ["cold pitch (the one isCold missed)", 27],
  ])("holds the %s thread (%i days stale at import)", (_label, days) => {
    expect(isBackfilled(threadEndingDaysBeforeImport(days))).toBe(true);
  });

  // The specific gap: 27 days is inside the 45-day cold threshold, so the
  // existing guard let it through and FollowUp replied "Thank you for
  // your email" to a month-old cold pitch.
  it("catches the one that was younger than the 45-day cold threshold", () => {
    const coldThresholdDays = 45;
    const lead = threadEndingDaysBeforeImport(27);
    const wouldIsColdCatchIt = 27 >= coldThresholdDays;
    expect(wouldIsColdCatchIt).toBe(false);
    expect(isBackfilled(lead)).toBe(true);
  });
});

describe("it never holds a conversation FollowUp actually watched", () => {
  it("leaves a lead who wrote in after FollowUp was connected", () => {
    // The normal case: lead arrives, lead row is created, they message,
    // they go quiet. FollowUp saw all of it.
    expect(
      isBackfilled({ createdAt: imported, lastContacted: new Date(imported.getTime() + 3 * DAY) })
    ).toBe(false);
  });

  it("stops applying the moment anything happens on the thread", () => {
    // Once FollowUp or the lead sends anything, lastContacted moves past
    // createdAt and the lead is live from then on, permanently.
    const lead = threadEndingDaysBeforeImport(84);
    expect(isBackfilled(lead)).toBe(true);
    const afterAnyActivity = { ...lead, lastContacted: new Date(imported.getTime() + 1) };
    expect(isBackfilled(afterAnyActivity)).toBe(false);
  });

  it("leaves a lead with no recorded contact alone", () => {
    // No lastContacted is not evidence of anything, and isCold already
    // covers an ancient lead with a missing timestamp. Claiming this one
    // is "backfilled" would hold brand-new manually-entered leads.
    expect(isBackfilled({ createdAt: imported, lastContacted: null })).toBe(false);
  });

  it("treats a thread that ends exactly at import as live, not inherited", () => {
    expect(isBackfilled({ createdAt: imported, lastContacted: imported })).toBe(false);
  });
});
