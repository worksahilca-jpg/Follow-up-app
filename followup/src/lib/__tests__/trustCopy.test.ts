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

/**
 * The unanswered rule's number, after the Meta ceiling (2026-09-16).
 *
 * effectiveUnansweredHours() caps Instagram and Messenger at
 * UNANSWERED_META_DM_MAX_HOURS whatever the owner configured. The Settings
 * sentence that describes "what is active right now" was still built from
 * the configured number alone — so an owner on the 24-hour default read
 * "within 24 hours" while the engine sent at 20 on two channels. A setting
 * that silently means something else is the surprise brand principle 1
 * forbids, and it is the same class of defect as the "fixed sentence" one
 * above: a true sentence that went stale when the code moved.
 */
describe("the unanswered-rule promise", () => {
  it("tells the owner the Meta channels are capped, in the sentence that describes what is active", () => {
    // Matched on source shape: the clause is built in describeAutomationState()
    // from the same constant the engine uses, so this also fails if someone
    // rewrites it around a literal number that could drift.
    // The interpolation itself, closing paren included — so this pins the
    // summary sentence specifically, not the explanatory note below the
    // field, which has its own assertion.
    expect(settings()).toMatch(/\$\{UNANSWERED_META_DM_MAX_HOURS\} on Instagram and Messenger\)/);
  });

  it("does not hardcode the ceiling anywhere in Settings", () => {
    // The number has one home (@/lib/metaWindow). "20 hours" typed into a
    // sentence would be true today and wrong the day the constant moves.
    expect(settings()).not.toMatch(/\b20 hours?\b/);
  });

  it("explains WHY, next to the field, in the owner's words", () => {
    // Brand principle 3: every automated behaviour must let the owner
    // answer "why did that happen" unaided. "Meta only lets a business
    // reply within a day" is the reason, with no platform jargon.
    expect(settings()).toMatch(/Meta only lets a business reply within a day/i);
  });

  it("imports the constant from the leaf module, never from automation.ts", () => {
    // automation.ts imports Prisma. Pulling it into this "use client"
    // component ships the database client to the browser — the exact bug
    // fixed for issue #93, and the reason @/lib/metaWindow exists.
    const raw = readFileSync(join(__dirname, "..", "..", "app", "(app)", "settings", "page.tsx"), "utf8");
    expect(raw).toMatch(/from "@\/lib\/metaWindow"/);
    expect(raw).not.toMatch(/from "@\/lib\/automation"/);
  });
});

/**
 * The summary sentence must not contradict itself on a holding account.
 *
 * `describeAutomationState()` builds one sentence from four clauses, then
 * appends "Nothing above sends on its own" when
 * `Business.holdAllForApproval` is set. Three clauses switch their verb on
 * that flag. The instant-acknowledgement clause did not: it said "sends"
 * unconditionally, left behind when the acknowledgement stopped being
 * exempt from the hold on 2026-09-20.
 *
 * So a holding owner — which, since 2026-09-21, is every owner — read:
 *
 *   "Right now FollowUp SENDS an instant acknowledgement to every new
 *    lead, drafts a nudge for a quiet lead after 5 days of silence [...]
 *    Nothing above SENDS on its own."
 *
 * Two opposite claims about the same behaviour, one sentence apart. The
 * trailing correction was covering for a clause that should not have been
 * wrong, and an owner resolving the contradiction the wrong way believes
 * their leads are being answered while 23 drafts sit unread.
 *
 * Found on 2026-09-21 while verifying, for the founder, that nothing could
 * reach a teammate's leads without his approval. Nothing could — but
 * Settings told him otherwise, which is the same defect class as every
 * other test in this file: a true sentence that went stale when the code
 * moved underneath it.
 */
describe("the summary sentence on a holding account", () => {
  const describeBody = () => {
    const raw = readFileSync(join(__dirname, "..", "..", "app", "(app)", "settings", "page.tsx"), "utf8");
    const at = raw.indexOf("function describeAutomationState()");
    expect(at, "describeAutomationState() is gone from Settings").toBeGreaterThan(-1);
    const end = raw.indexOf("\n  }", at);
    return raw.slice(at, end);
  };

  it("does not tell a holding owner their leads are being answered", () => {
    // The specific regression: an unconditional push of the "sends"
    // wording. Conditional on holdAllForApproval is what makes it honest.
    const body = describeBody();
    const unconditional = /clauses\.push\("sends an instant acknowledgement/;
    expect(
      body,
      "the instant-acknowledgement clause says 'sends' regardless of holdAllForApproval, " +
        "while the same sentence ends '— nothing above sends on its own'"
    ).not.toMatch(unconditional);
  });

  it("switches that clause's verb on the hold, like the other three", () => {
    expect(describeBody()).toMatch(/holdAllForApproval[\s\S]{0,120}drafts an instant acknowledgement/);
  });

  it("still says 'sends' when the account is NOT holding", () => {
    // The fix must not overcorrect into always saying "drafts": an owner
    // who has deliberately turned the hold off is owed the true verb.
    expect(describeBody()).toMatch(/sends an instant acknowledgement to every new lead/);
  });

  it("keeps the blanket reassurance at the foot", () => {
    // Belt and braces alongside the per-clause verbs. Losing this would
    // leave the owner inferring the guarantee from four separate verbs.
    expect(settings()).toMatch(/Nothing above sends on its own/);
  });
});

/**
 * The same rule pointed at the landing page: a promise about who does the
 * work, checked against the code that decides.
 *
 * Four places said new customers "go to the right person" — the team
 * product card, the features grid, the FAQ, and, worst, the $79 Pro tier's
 * feature list, where someone is being charged for it. All four read as
 * skill-based routing: this lead is about a condo, Alex does condos, Alex
 * gets it.
 *
 * FollowUp does not do that, and its own source says so out loud.
 * `pickAssignee` in @/lib/assignment is least-loaded — "whichever team
 * member currently has the fewest leads assigned to them gets the next
 * one" — and @/lib/sourceRouting's header calls skill-based routing "the
 * more complex 'smart routing to the right salesperson' idea, parked until
 * there's a real team to route between". A source set to routeToPool goes
 * to nobody at all until a human claims it.
 *
 * Even distribution is a good feature. It is not the one that was being
 * sold. Flagged as gap 7 of the 2026-09-13 landing-page research, verified
 * against the live code and fixed 2026-09-22.
 */
describe("what the landing page promises about team routing", () => {
  const landing = () =>
    readFileSync(join(__dirname, "..", "..", "app", "page.tsx"), "utf8")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\s+/g, " ");

  it("does not claim a lead reaches the right person", () => {
    expect(
      landing(),
      "the landing page promises skill-based routing again — assignment is least-loaded"
    ).not.toMatch(/right person/i);
  });

  it("still says what actually happens, rather than dropping the claim", () => {
    // Deleting the sentence would pass the assertion above and tell a
    // visitor with a team nothing. The honest version is the fix.
    expect(landing(), "the landing page no longer explains team assignment at all").toMatch(
      /shared out evenly/i
    );
  });

  it("names the pool, the one case where a lead reaches nobody", () => {
    // routeToPool leaves assignedToId null on purpose. A visitor told
    // only about even sharing would be surprised by a lead sitting
    // unassigned, so the FAQ carries the second half.
    expect(landing(), "the FAQ does not mention the shared list anyone can claim").toMatch(
      /shared list anyone can pick up/i
    );
  });

  it("keeps the claim out of the paid tier's feature list too", () => {
    // The Pro list is the copy a customer would quote back. Asserted
    // separately because a page-wide match could pass on the other three
    // being fixed while this one lingers.
    const pro = landing().slice(landing().indexOf("Plus plus:"));
    expect(pro, "the Pro tier still sells routing to the right person").not.toMatch(/right person/i);
    expect(pro, "the Pro tier no longer says what team assignment does").toMatch(/shared out evenly/i);
  });
});

/**
 * The page sold sending; the product sends nothing.
 *
 * Six places promised replies going out on their own — "FollowUp replies
 * for you" as the $39 tier's headline benefit, "Simple replies go out on
 * their own" in the features grid, and, sharpest, "You approve every
 * reply before it goes out" listed as a FREE tier feature, which tells a
 * reader that paying removes the approval step.
 *
 * `Business.holdAllForApproval` is `@default(true)` in the schema, the
 * settings route reads it but never writes it, and it short-circuits
 * ahead of a lead's own tier in all three send paths (automation.ts,
 * acknowledge.ts, sequences.ts). So no account can turn it off, a lead
 * set to fully autonomous is still held, and nothing sends for anyone.
 * Production agreed: zero outbound messages in 24h across 8 businesses.
 *
 * Founder's call 2026-09-22, choosing between four options: keep the
 * pitch, state the current truth in one line. These pin that line and the
 * FAQ answer that has to agree with it — the pairing matters, because a
 * page that says "nothing sends" in the hero and "replies go out on their
 * own" in the FAQ is the #301 self-contradiction rebuilt.
 *
 * WHEN THE HOLD IS LIFTED: flip the schema default, then delete this
 * block and the two pieces of copy it guards. The failure will be these
 * tests passing while the page understates what ships — the opposite
 * error, and the reason the skip below is deliberately absent.
 */
describe("what the landing page says about sending, while the hold is on", () => {
  const landingRaw = () => readFileSync(join(__dirname, "..", "..", "app", "page.tsx"), "utf8");
  const landingCopy = () =>
    landingRaw()
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\s+/g, " ");

  const schema = () => readFileSync(join(__dirname, "..", "..", "..", "prisma", "schema.prisma"), "utf8");

  it("new accounts still hold by default — the whole page depends on it", () => {
    // The hero's "nothing sends without your OK" is true because a fresh
    // account holds until its owner grants permission in Settings
    // (src/app/api/automation/settings/route.ts). Flip this default and
    // the line becomes a lie for every new signup on day one, which is
    // the exact failure this file exists to catch.
    expect(
      schema(),
      "holdAllForApproval is no longer default-true — a new account now sends before anyone asked it to, and the landing page still promises the opposite"
    ).toMatch(/holdAllForApproval\s+Boolean\s+@default\(true\)/);
  });

  it("says plainly in the hero that nothing sends without approval", () => {
    // Founder's framing: the pitch stays ("it follows up for you"), the
    // supervision is the trust line beside it. Both halves are asserted,
    // because dropping the first is how the honest version of this line
    // threw the whole product away in its first draft.
    expect(landingCopy(), "the hero lost the pitch while stating the hold").toMatch(/It follows up for you/i);
    expect(
      landingCopy(),
      "the hero lost the beta sending caveat while the hold is still on"
    ).toMatch(/nothing sends without your OK/i);
  });

  it("the FAQ agrees with the hero rather than contradicting it", () => {
    const faq = landingCopy().slice(landingCopy().indexOf("Will it send things I did not approve?"));
    expect(faq, "the FAQ answer no longer states the hold").toMatch(/nothing goes out on its own until you allow it/i);
    expect(faq, "the FAQ does not say where permission is granted").toMatch(/turn that on in Settings/i);
    expect(faq, "the FAQ lost the on-your-behalf framing the hero leads with").toMatch(/on your behalf, under your eye/i);
  });

  it("the FAQ no longer claims a lead can be switched to fully automatic", () => {
    // holdAll wins over Lead.automationTier, so "turn it fully on for any
    // customer" was false in exactly the place a cautious buyer checks.
    const faq = landingCopy().slice(landingCopy().indexOf("Will it send things I did not approve?"));
    expect(faq, "the FAQ promises a per-customer fully-on switch the hold overrides").not.toMatch(
      /turn it fully on/i
    );
  });

  it("still describes what automatic sending will be, rather than deleting the idea", () => {
    // The founder chose "keep the pitch, add the caveat". An answer that
    // only said "nothing sends" would have thrown away the product's
    // actual design along with the false claim.
    const faq = landingCopy().slice(landingCopy().indexOf("Will it send things I did not approve?"));
    // Matches the guarantee, not the adverb — this pinned "always" and
    // failed on a reword to "still", which is the test being about
    // phrasing when it is supposed to be about the promise.
    expect(faq, "the FAQ dropped the money/sensitive guarantee entirely").toMatch(
      /anything about price[^.]*waits for you/i
    );
  });
});
