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
  it("promises what is now active: a reply within minutes, not after the hours setting", () => {
    // Since the follow-up strategy (2026-09-25) a new message is answered
    // or held within minutes on every channel (the fresh-replies cron); the
    // hours field is only the backstop. The summary sentence used to quote
    // that field — "if you haven't answered within 24 hours (20 on
    // Instagram and Messenger)" — which became untrue the day this shipped.
    expect(settings()).toMatch(/drafts a reply within minutes of a new message/);
    expect(settings()).toMatch(/replies within minutes of a new message, holding anything about price/);
    expect(settings()).not.toMatch(/if you haven't answered within \$\{unansweredHours\}/);
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
    expect(settings()).toMatch(/Meta only lets a business reply freely within a day/i);
    expect(settings()).toMatch(/On Instagram, Messenger and WhatsApp/);
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
/**
 * The landing page's words live in page.tsx and the three client pieces it
 * renders (src/components/landing/v2, A-053 → A-060, A-063), so the copy
 * checks read all four together.
 */
const LANDING_FILES = [
  ["app", "page.tsx"],
  ["components", "landing", "v2", "WatchDemo.tsx"],
  ["components", "landing", "v2", "Pricing.tsx"],
  ["components", "landing", "v2", "Questions.tsx"],
];
const landingSource = () => LANDING_FILES.map((parts) => readFileSync(join(__dirname, "..", "..", ...parts), "utf8")).join("\n");

describe("what the landing page promises about team routing", () => {
  const landing = () =>
    landingSource()
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
    const pro = landing().slice(landing().indexOf("Everything in Plus, plus:"));
    expect(pro, "the Pro tier still sells routing to the right person").not.toMatch(/right person/i);
    expect(pro, "the Pro tier no longer says what team assignment does").toMatch(/shared out evenly/i);
  });
});

/**
 * What the landing page says about sending, now that the owner chooses.
 *
 * Until 2026-09-26 every account held every message, and this block pinned
 * the page to saying so ("nothing sends without your OK"). The founder then
 * set the direction (PRODUCT_DIRECTION, "The auto follow-up direction,
 * complete"): FollowUp follows up on its own, only decisions come to the
 * owner, and onboarding ASKS — Automatic or Assisted. The schema default
 * did not flip: an account still holds until its owner chooses Automatic.
 *
 * So the page may say "follows up on its own" only because the same page
 * says it is a choice, and it must never drop the guarantee that prices,
 * dates and anything tense come to the owner either way. These pin both
 * halves, and the default that makes the page honest on day one.
 */
describe("what the landing page says about sending", () => {
  const landingCopy = () =>
    landingSource()
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\s+/g, " ");

  const schema = () => readFileSync(join(__dirname, "..", "..", "..", "prisma", "schema.prisma"), "utf8");

  it("new accounts still hold until their owner chooses Automatic", () => {
    // The page's "on its own" is true once the owner picks Automatic in
    // onboarding. A default that sent before anyone chose would make the
    // FAQ's "if you choose Automatic" a lie on day one.
    expect(schema(), "holdAllForApproval is no longer default-true — accounts now send before their owner chose to").toMatch(
      /holdAllForApproval\s+Boolean\s+@default\(true\)/
    );
  });

  it("the FAQ names the choice, both ways", () => {
    const faq = landingCopy().slice(landingCopy().indexOf("Will it send things on its own?"));
    expect(faq, "the FAQ no longer says sending on its own is the owner's choice").toMatch(/If you choose Automatic when you set up/i);
    expect(faq, "the FAQ no longer offers the way to check everything").toMatch(/Choose Assisted/i);
  });

  it("never drops the decisions guarantee", () => {
    const faq = landingCopy().slice(landingCopy().indexOf("Will it send things on its own?"));
    expect(faq, "the FAQ lost the price/date/tense guarantee").toMatch(/A price, a date or anything tense comes to you first/i);
    // Said once, in the hero's first line (A-063: each promise once), and
    // shown in the demo, where the price comes to the owner.
    expect(landingCopy(), "the hero lost the guarantee").toMatch(/When something needs your decision, like a price or a date, it hands it to you/i);
    expect(landingCopy(), "the demo no longer shows the price coming to the owner").toMatch(/It comes to you, reply written/i);
  });

  it("does not promise a per-customer fully-automatic mode", () => {
    // AUTONOMOUS (no risk check) stays behind its own permission and is
    // not what Automatic means (PRODUCT_DIRECTION correction, 2026-09-27).
    expect(landingCopy(), "the page promises a mode that skips the decisions").not.toMatch(/turn it fully on|without any checks/i);
  });
});

/**
 * The same false claim, on the screen where it costs most.
 *
 * `HowItWorks` in OnboardingForm is the third thing a new tester sees,
 * and it is shown WHILE asking for permission to send from their inbox.
 * That file's own header singles out its third beat: "The third beat is
 * the one that has to be exactly true. The old Connect Gmail screen
 * described a read-only product at the moment it asked for send access,
 * and the comment there recorded why that mattered: it is the gap
 * between a surprise and a betrayal."
 *
 * The beat read: "Anything it isn't certain about waits for your OK […]
 * and you can turn sending off for one person or for everyone." Both
 * halves stopped being true when holdAllForApproval became
 * @default(true) for every account on 2026-09-21:
 *
 *   - "anything it isn't certain about" tells a reader that some things
 *     go out without asking. Nothing does.
 *   - "turn sending off" is backwards — it is already off. And "for one
 *     person" was false as well, since holdAll short-circuits ahead of a
 *     lead's own automation tier.
 *
 * So the screen that exists to close the surprise/betrayal gap was
 * opening it, in the sentence written to close it.
 */
describe("what onboarding promises while asking for send access", () => {
  const onboarding = () =>
    readFileSync(join(__dirname, "..", "..", "components", "OnboardingForm.tsx"), "utf8")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\s+/g, " ");

  it("does not tell a new business that some messages send unasked", () => {
    expect(
      onboarding(),
      "onboarding says only uncertain drafts wait — every draft waits, on every account"
    ).not.toMatch(/isn't certain about waits for your OK/i);
  });

  // Founder, 2026-09-26: onboarding now ASKS — Automatic or Assisted — so
  // the promise is no longer "every message waits". What has to stay true
  // is that both choices are stated plainly, including what still waits
  // on Automatic, before anything is granted.
  it("names both choices and what each one does", () => {
    const text = onboarding();
    expect(text, "the Assisted choice no longer says every reply waits").toMatch(/Every reply waits for you/i);
    expect(text, "the Automatic choice no longer says what still comes to the owner").toMatch(
      /Prices, dates and tricky moments come to you/i
    );
  });

  it("does not offer to turn OFF something that is already off", () => {
    // The decision a business actually makes is turning sending ON.
    expect(onboarding(), "onboarding still describes the switch backwards").not.toMatch(
      /turn sending off for one person or for everyone/i
    );
  });

  it("keeps the guarantee that holds either way", () => {
    // True with the hold on and true after permission is granted. Losing
    // it while fixing the false half would be the overcorrection.
    expect(onboarding(), "onboarding dropped the stop-on-reply guarantee").toMatch(
      /stops the moment they reply/i
    );
  });
});
