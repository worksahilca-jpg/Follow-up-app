/**
 * Lead.lastContacted may only ever move forward.
 *
 * It is the field the whole product uses to answer "has this person gone
 * quiet": the silence automation, the dead-lead threshold, the rescue
 * score, and now the reactivation batch all select on it. Nothing else
 * carries that meaning.
 *
 * Both mailbox syncs used to write it unconditionally from whichever
 * thread they happened to be processing. A lead is keyed
 * (businessId, email), so one contact routinely has several threads, and
 * the 90-day import window puts several of them in scope at once. Process
 * Jane's live thread from this morning, then her 80-day-old thread about a
 * different quote, and her lastContacted lands on the older one.
 *
 * She is then, as far as every query in the product is concerned, 80 days
 * silent — while sitting in an open conversation she answered an hour ago.
 * The silence automation offers to chase her. The reactivation batch files
 * her as cold. That is the single worst message this product can send, and
 * it needed no bug in the sending code at all: just one field going
 * backwards.
 *
 * These tests assert the write itself carries the "only if newer" test,
 * rather than relying on a value read moments earlier — two overlapping
 * syncs (a push notification and the cron tick) can interleave between a
 * read and a write, and the guard has to survive that.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SYNCS = [
  { name: "gmail", path: "src/lib/integrations/gmail.ts" },
  { name: "outlook", path: "src/lib/integrations/outlook.ts" },
];

function source(relPath: string): string {
  return readFileSync(join(process.cwd(), relPath), "utf8");
}

describe.each(SYNCS)("$name sync — lastContacted only moves forward", ({ path }) => {
  const src = source(path);

  // The exact regression: an unguarded update that sets the field to
  // whatever this thread happens to say, older or newer.
  it("never writes lastContacted unconditionally on an existing lead", () => {
    expect(src).not.toMatch(
      /prisma\.lead\.update\(\{\s*where:\s*\{\s*id:\s*existingLead\.id\s*\},\s*data:\s*\{\s*lastContacted\s*\}/
    );
  });

  // The guard belongs in the WHERE, not in a variable read earlier: a
  // read-then-write can be interleaved by a concurrent sync, an UPDATE
  // whose own predicate carries the test cannot.
  it("guards the write with an only-if-newer predicate in the query itself", () => {
    expect(src).toMatch(/lastContacted:\s*\{\s*lt:\s*lastContacted\s*\}/);
    expect(src).toMatch(/OR:\s*\[\{\s*lastContacted:\s*null\s*\}/);
  });

  // A lead with no lastContacted at all (manual entry, CSV import) must
  // still get one from its first synced thread — the guard must not turn
  // into "never set it".
  it("still sets lastContacted when the lead has none", () => {
    const guard = src.match(/OR:\s*\[\{\s*lastContacted:\s*null\s*\},[^\]]*\]/);
    expect(guard).not.toBeNull();
  });
});

describe("the reactivation pass repairs what it finds", () => {
  const src = source("src/lib/reactivation.ts");

  // Rows written before the sync fix still carry regressed timestamps.
  // Detecting that and merely skipping would leave the lead matching the
  // eligibility query forever while the batch screen's "still being
  // judged" count kept counting it — a number that never reaches zero.
  it("writes the true last-message time back rather than only skipping", () => {
    expect(src).toMatch(/trueLastContacted/);
    expect(src).toMatch(/data:\s*\{\s*lastContacted:\s*trueLastContacted\s*\}/);
  });

  it("repairs forward-only, so the repair can't regress the field itself", () => {
    expect(src).toMatch(/lastContacted:\s*\{\s*lt:\s*trueLastContacted\s*\}/);
  });

  // Every write in this file is tenant-scoped; a repair is still a write.
  it("scopes the repair to the business", () => {
    const repair = src.slice(src.indexOf("trueLastContacted >"), src.indexOf("trueLastContacted >") + 600);
    expect(repair).toMatch(/businessId/);
  });
});
