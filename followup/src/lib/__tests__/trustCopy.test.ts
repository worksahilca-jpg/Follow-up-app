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
  // Since #16 (founder, 2026-10-05, A-094) the rule says less: its sentence and one "stops
  // when" line. Fewer promises, but every one left must still be true. The price, fallback,
  // opt-out and DM-delay sentences went with the cut, not because they stopped being true.
  it("keeps the promises the code actually enforces", () => {
    const copy = settings();
    // The atomic claim on Lead.acknowledgedAt.
    expect(copy).toMatch(/once per customer, in their language/i);
    // The prior-outbound check.
    expect(copy).toMatch(/never if you've already replied/i);
  });

  // The grace period made the old "within a minute" false on DM channels.
  it("never promises a timing the DM grace period breaks", () => {
    expect(settings()).not.toMatch(/within a minute/i);
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
    expect(settings()).toMatch(/FollowUp writes a reply within minutes\./);
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
 * The summary sentence (describeAutomationState, "All four together") was removed with the #16
 * cut (founder, 2026-10-05, A-094), so the self-contradiction it once had can't come back. The
 * guarantee it carried ("nothing above sends on its own") now lives in "Your rules".
 */
describe("the guarantee on a holding account", () => {
  const yourRules = () => readFileSync(join(__dirname, "..", "yourRules.ts"), "utf8");

  it("is stated where the owner reads the rules", () => {
    expect(yourRules()).toMatch(/if \(s\.holdAll\) rules\.push\("Every reply waits for your OK\."\)/);
  });

  it("is not contradicted by a summary that says 'sends'", () => {
    expect(settings()).not.toMatch(/sends an instant acknowledgement/);
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
 * The landing page's words: one document since 2026-10-09
 * (src/landing/home.html, served by src/app/route.ts; A-204 → A-206).
 * Until then they lived in page.tsx and the three client pieces it
 * rendered (A-053 → A-060, A-063).
 */
const landingSource = () => readFileSync(join(__dirname, "..", "..", "landing", "home.html"), "utf8");

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

  // The page of 2026-10-09 has no team section, FAQ or paid tiers, so the
  // honest explanation that lived there ("shared out evenly", "a shared
  // list anyone can pick up", the Pro list) has nothing to explain. What
  // has to hold is the negative above: no routing promise comes back.
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

  // The page of 2026-10-09 says it in its "You stay in charge" section,
  // with the setting itself drawn as it is in Settings, instead of an FAQ.
  it("names the choice: sending on its own, asking first, or off", () => {
    const control = landingCopy().slice(landingCopy().indexOf("You stay"));
    expect(control, "the page no longer shows how sending is chosen").toMatch(/How it sends/);
    for (const choice of ["Auto", "Ask me", "Off"]) {
      expect(control, `the sending choice lost "${choice}"`).toContain(`>${choice}<`);
    }
    expect(control, "the page lost the pause").toMatch(/Pause everything/);
  });

  it("never drops the decisions guarantee", () => {
    // Said in the first screen, and again where the rules are.
    expect(landingCopy(), "the first screen lost the guarantee").toMatch(/Asks you before quoting a price or a date/);
    expect(landingCopy(), "the rules lost the guarantee").toMatch(/Prices and dates ask you first/);
  });

  it("does not claim nothing ever sends unasked", () => {
    // False on Automatic, and the holding message sends on every account.
    expect(landingCopy(), "the page promises every message waits").not.toMatch(/nothing (sends|is sent) without your (ok|okay|approval)/i);
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
