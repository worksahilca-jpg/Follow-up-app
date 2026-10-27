/**
 * What FollowUp offers, and what it only claims to offer.
 *
 * Founder's call, 2026-09-15: inbound leads are the core; the phone
 * channels (SMS, voicemail, the live voice agent) are dropped for now and
 * picked up later. The reason is A2P 10DLC — a carrier requirement, not a
 * Twilio one, so it survives any provider switch — which would make every
 * customer register a business and wait before sending one text.
 *
 * These tests exist because the expensive half of dropping a channel is
 * not switching it off, it is remembering every place that still promises
 * it. A landing page naming a channel a visitor then cannot connect is
 * worse than never having mentioned it: they find out after signing up.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CARRIER_CHANNELS_AVAILABLE, META_CHANNELS_AVAILABLE, VOICE_ADDON_AVAILABLE } from "@/lib/pricing";

const root = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("dropped channels", () => {
  // The line is the CARRIER, not the vendor and not "is it a phone
  // number". WhatsApp runs through the same Twilio account as SMS and is
  // still on, because A2P 10DLC is an SMS rule and WhatsApp gates on Meta's
  // approval instead. Grouping them cost a round trip on 2026-09-15; this
  // test is where that stays fixed.
  it("drops the carrier channels and keeps the Meta ones", () => {
    expect(CARRIER_CHANNELS_AVAILABLE).toBe(false);
    expect(VOICE_ADDON_AVAILABLE).toBe(false);
    expect(META_CHANNELS_AVAILABLE).toBe(true);
  });

  // The flag is the switch; these are the places that would otherwise
  // keep advertising it. Asserted against the real source rather than a
  // rendered page so it fails in unit tests, where someone will see it.
  it("does not promise a channel it cannot connect", () => {
    if (CARRIER_CHANNELS_AVAILABLE) return; // re-enabled — the claims are true again

    // Only the visitor-facing strings. Comments in that file legitimately
    // discuss the dropped channels — that is where the reason for dropping
    // them is recorded — so every comment form has to come out first,
    // including multi-line {/* ... */} JSX blocks, which a line-by-line
    // filter silently misses on its continuation lines.
    // The home page is one document since 2026-10-09 (src/app/route.ts).
    const copy = read("landing/home.html")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    expect(copy).not.toMatch(/SMS/);
    // The page's own channel list: the strip of app icons in the demo, the
    // order the demo's messages arrive in, and the example customers.
    expect(copy, "the demo's From strip shows text messages").not.toMatch(/<i data-ch="sms"/);
    expect(copy, "a demo message arrives by text").not.toMatch(/FU_CH_LIST = \[[^\]]*'sms'/);
    expect(copy, "an example customer writes by text").not.toMatch(/\["sms", |\['sms', |"ch": "sms"/);
    // "Twilio" is vendor jargon that stood in for SMS on the logo row. It
    // goes whether or not carrier channels come back — a visitor does not
    // buy Twilio.
    expect(copy).not.toMatch(/Twilio/);
    expect(copy).not.toMatch(/voicemail/i);
  });

  it("still names the channels that do work", () => {
    const landing = read("landing/home.html");
    for (const live of ["Gmail", "Outlook", "Instagram", "Messenger", "WhatsApp"]) {
      expect(landing).toContain(live);
    }
  });

  // Hidden, not deleted. The distinction is the whole point of the flag:
  // this is postponed work, and a future session must be able to find the
  // code rather than rebuild it.
  it("keeps the phone code in place", () => {
    expect(() => read("../src/components/TwilioConfig.tsx")).not.toThrow();
    expect(() => read("lib/twilio.ts")).not.toThrow();
  });

  // The Twilio webhook routes stay live on purpose: a business that
  // already pointed a number at FollowUp keeps working rather than having
  // it go dark with no warning. Hiding the setup UI removes the offer, not
  // the capability.
  it("leaves the inbound phone routes intact", () => {
    expect(() => read("app/api/twilio/sms/[secret]/route.ts")).not.toThrow();
    expect(() => read("app/api/twilio/voice/[secret]/route.ts")).not.toThrow();
  });
});

/**
 * The same rule, one directory over.
 *
 * "does not promise a channel it cannot connect" reads `app/page.tsx` and
 * nothing else. That was the whole landing page when it was written; since
 * the 2026-09-18 rebuild the hero is a component, and the component was
 * listing "Missed call · via your phone line" beside Gmail and WhatsApp
 * with no mark on it — the exact promise this file exists to stop, made in
 * the first thing a visitor sees, in a file the guard did not read.
 *
 * Fixed 2026-09-22 on the founder's call ("we are not giving voice agent
 * services right now, but we can do 'coming soon'"): the row stays and
 * carries a "Soon" pill, and the FAQ answers what that means. These tests
 * cover the whole landing directory so the next component cannot slip
 * through the same way.
 */
describe("the landing page's components make the same promises as the page", () => {
  const LANDING = [
    // The home page, one document since 2026-10-09 (A-204 → A-206). The
    // component landing it replaced was removed on 2026-10-27.
    "../src/landing/home.html",
  ];
  const visible = (p: string) =>
    read(p)
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

  it("names no dropped channel in any landing component", () => {
    if (CARRIER_CHANNELS_AVAILABLE) return; // re-enabled — the claims are true again
    for (const path of LANDING) {
      const copy = visible(path);
      for (const claim of [/SMS/, /Twilio/, /voicemail/i]) {
        expect(copy, `${path} promises ${claim}`).not.toMatch(claim);
      }
    }
  });

  /**
   * The old hero carried a "Soon" pill; a visitor deciding whether to sign
   * up needs to know what happens to their phone in the meantime. The home
   * page since 2026-10-09 has no FAQ to answer that, so it must not raise
   * the question: it names no phone line or missed call at all.
   */
  it("does not offer the phone line on the home page", () => {
    if (CARRIER_CHANNELS_AVAILABLE) return;
    const home = visible("../src/landing/home.html");
    expect(home, "the home page offers the phone line, which is not picked up yet").not.toMatch(/phone line|missed call/i);
  });
});

/**
 * The cost of the mistake this file exists to prevent, in its second form.
 * Hiding the carrier offer hid WhatsApp with it, because both were set up
 * from one Twilio panel — so a channel the product offers had no setup UI
 * at all, which is worse than the landing-page version of the bug: the
 * business signed up, was told WhatsApp works, and then could not connect
 * it. Fixed 2026-09-16 by splitting WhatsApp's setup out of
 * @/components/TwilioConfig.
 *
 * Since A-253 (2026-10-14) WhatsApp is one row on Settings' "Where customers
 * write" page (@/components/settings/Connections): Connect, or Connected.
 * The paste-a-token fallback and the 24-hour template left the owner's
 * screen with every other technical setting (R-115); what was saved keeps
 * working. These tests pin the shape that still matters: WhatsApp's connect
 * stays reachable with the carrier flag off, and the SMS/voice affordances
 * stay behind the flag.
 */
describe("WhatsApp is set up without the carrier channels", () => {
  const stripComments = (s: string) =>
    s
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

  /**
   * The body of `{CARRIER_CHANNELS_AVAILABLE && ( … )}` in Settings, found
   * by balancing parentheses from that marker. Comments are stripped first
   * (they discuss both channels by design). Assumes the JSX inside keeps
   * its parentheses balanced — true of code, and of the prose in it today.
   */
  function carrierGatedRegion(source: string): string {
    const marker = "CARRIER_CHANNELS_AVAILABLE && (";
    const start = source.indexOf(marker);
    expect(start, "Settings no longer gates anything on CARRIER_CHANNELS_AVAILABLE").toBeGreaterThan(-1);
    let depth = 0;
    for (let i = start + marker.length - 1; i < source.length; i++) {
      if (source[i] === "(") depth++;
      else if (source[i] === ")" && --depth === 0) return source.slice(start, i + 1);
    }
    throw new Error("unbalanced parentheses after CARRIER_CHANNELS_AVAILABLE");
  }

  // Read per test, not at collection time: a missing page should fail as
  // the assertion it is, not as a crash that reports "no tests".
  const readSettings = () => stripComments(read("app/(app)/settings/SettingsClient.tsx"));
  const readConnections = () => {
    let source: string;
    try {
      source = read("../src/components/settings/Connections.tsx");
    } catch {
      throw new Error("Where customers write has no page — src/components/settings/Connections.tsx is missing.");
    }
    return stripComments(source);
  };

  it("keeps WhatsApp's connect outside the carrier flag", () => {
    const settings = readSettings();
    const gated = carrierGatedRegion(settings);
    expect(settings).toContain("<Connections");
    expect(gated).toContain("<TwilioConfig />");
    expect(gated).not.toContain("Connections");
    // …and outside it in the literal sense too: removing the gated region
    // must leave the connections page still rendered.
    expect(settings.replace(gated, "")).toContain("<Connections");
  });

  it("connects WhatsApp in one tap, through Meta's own window", () => {
    const connections = readConnections();
    expect(connections, "Where customers write has no WhatsApp row").toContain('name="WhatsApp"');
    expect(connections, "the WhatsApp row lost its connect flow").toContain("useWhatsAppSignup");
    expect(connections, "the WhatsApp row doesn't start the signup").toContain("signup.start");
    expect(stripComments(read("../src/lib/useWhatsAppSignup.ts")), "the signup no longer finishes the connect").toContain("/api/whatsapp/connect");
  });

  /**
   * Where WhatsApp is offered. Setup is Gmail or Instagram (A-081, A-241),
   * so WhatsApp must stay reachable in Settings with its connect flow
   * intact, so a business that runs on WhatsApp can still connect it there.
   */
  it("setup connects Gmail; WhatsApp stays in Settings with its connect flow", () => {
    const onboarding = stripComments(read("../src/components/OnboardingForm.tsx"));
    expect(onboarding, "setup has no Connect Gmail").toContain("/api/integrations/gmail/connect");
    expect(onboarding, "setup still offers WhatsApp (Gmail first, A-081)").not.toMatch(/name:\s*"WhatsApp"/);
    expect(readConnections(), "the WhatsApp row lost its connect flow").toContain("useWhatsAppSignup");
    expect(readSettings(), "Settings no longer renders Where customers write").toContain("<Connections");
  });

  it("offers no SMS or voice affordance where customers write", () => {
    if (CARRIER_CHANNELS_AVAILABLE) return; // both are offered again; this page may point at them
    const connections = readConnections();

    // The carrier-only controls: the SMS and voice webhook URLs, the
    // outbound SMS number, and the voice-agent toggle.
    for (const affordance of ["smsUrl", "voiceUrl", "voiceAgentEnabled", "phoneNumber:"]) {
      expect(connections, `Where customers write still offers ${affordance}`).not.toContain(affordance);
    }

    // And no copy promising a channel that isn't there. "text-" is a
    // Tailwind prefix, hence the lookahead rather than the bare word.
    for (const claim of [/\bSMS\b/, /A2P/i, /voicemail/i, /\btexts?\b(?!-)/i, /texting/i, /\bcalls?\b/i, /voice agent/i]) {
      expect(connections, `Where customers write still mentions ${claim}`).not.toMatch(claim);
    }
  });
});
