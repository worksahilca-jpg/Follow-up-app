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
    const copy = read("app/page.tsx")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    expect(copy).not.toMatch(/SMS/);
    // "Twilio" is vendor jargon that stood in for SMS on the logo row. It
    // goes whether or not carrier channels come back — a visitor does not
    // buy Twilio.
    expect(copy).not.toMatch(/Twilio/);
    expect(copy).not.toMatch(/voicemail/i);
  });

  it("still names the channels that do work", () => {
    const landing = read("app/page.tsx");
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
 * The cost of the mistake this file exists to prevent, in its second form.
 * Hiding the carrier offer hid WhatsApp with it, because both were set up
 * from one Twilio panel — so a channel the product offers had no setup UI
 * at all, which is worse than the landing-page version of the bug: the
 * business signed up, was told WhatsApp works, and then could not connect
 * it. Fixed 2026-09-16 by splitting @/components/WhatsAppConfig out of
 * @/components/TwilioConfig.
 *
 * These tests pin the shape of that split, not its wording: WhatsApp's
 * setup stays reachable with the carrier flag off, and the SMS/voice
 * affordances stay behind the flag.
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

  // Read per test, not at collection time: a missing panel should fail as
  // the assertion it is, not as a crash that reports "no tests".
  const readSettings = () => stripComments(read("app/(app)/settings/page.tsx"));
  const readWhatsappPanel = () => {
    let source: string;
    try {
      source = read("../src/components/WhatsAppConfig.tsx");
    } catch {
      throw new Error("WhatsApp has no setup panel — src/components/WhatsAppConfig.tsx is missing.");
    }
    return stripComments(source);
  };

  /**
   * The panel plus the hook it delegates the Meta popup to.
   *
   * The Embedded Signup mechanism moved to src/lib/useWhatsAppSignup.ts on
   * 2026-09-21 so onboarding could offer WhatsApp as well — until then it
   * was the one lead source with no button on the "where do your leads
   * come from?" step. The guarantee below is unchanged ("setup can still
   * reach the values a WhatsApp reply needs"); only the file holding half
   * of it moved, so the assertion reads both rather than pinning the
   * mechanism to one component forever.
   */
  const readWhatsappSetup = () => {
    let hook: string;
    try {
      hook = read("../src/lib/useWhatsAppSignup.ts");
    } catch {
      throw new Error("WhatsApp signup has no mechanism — src/lib/useWhatsAppSignup.ts is missing.");
    }
    return `${readWhatsappPanel()}\n${stripComments(hook)}`;
  };

  it("keeps the WhatsApp panel outside the carrier flag", () => {
    const settings = readSettings();
    const gated = carrierGatedRegion(settings);
    expect(settings).toContain("<WhatsAppConfig />");
    expect(gated).toContain("<TwilioConfig />");
    expect(gated).not.toContain("WhatsAppConfig");
    // …and outside it in the literal sense too: removing the gated region
    // must leave the WhatsApp section still rendered.
    expect(settings.replace(gated, "")).toContain("<WhatsAppConfig />");
  });

  it("reaches every value a WhatsApp reply needs", () => {
    const whatsapp = readWhatsappSetup();
    // Since 2026-09-19 WhatsApp is the owner's own number through Meta
    // (src/lib/whatsappCloud.ts): setup must offer the connect flow, the
    // paste-a-token fallback's three values, and the 24-hour template that
    // a follow-up past the window depends on. The connect flow itself now
    // lives in the shared hook; the rest is still panel-only.
    for (const field of ["/api/whatsapp/connect", "accessToken", "phoneNumberId", "wabaId", "templateName", "templateLanguage", "templateBody"]) {
      expect(whatsapp, `WhatsApp setup can no longer reach ${field}`).toContain(field);
    }
  });

  /**
   * The gap this closes.
   *
   * Onboarding's "where do your leads come from?" step (2026-09-21) let a
   * business connect email, Instagram and Facebook in place — and pointed
   * WhatsApp at Settings, a screen it had not reached yet. A business that
   * runs entirely on WhatsApp is squarely who that step was rebuilt for,
   * so it was the one answer with no button and the worst line on the
   * screen. Meta's Embedded Signup is a popup rather than a redirect,
   * which is why it needed a shared hook rather than a link.
   */
  it("offers WhatsApp during onboarding, not just in Settings", () => {
    const onboarding = stripComments(read("../src/components/OnboardingForm.tsx"));
    expect(onboarding, "onboarding cannot start a WhatsApp connect").toContain("useWhatsAppSignup");
    expect(onboarding, "onboarding has no WhatsApp row").toMatch(/name:\s*"WhatsApp"/);

    // …and the step no longer tells anyone to go elsewhere for it.
    const sources = stripComments(read("../src/components/OnboardingSources.tsx"));
    expect(sources, "the sources step still sends WhatsApp to Settings").not.toMatch(
      /WhatsApp[^\n]*from Settings/
    );
  });

  it("offers no SMS or voice affordance from the WhatsApp panel", () => {
    if (CARRIER_CHANNELS_AVAILABLE) return; // both are offered again; this panel may point at them
    const whatsapp = readWhatsappPanel();

    // The carrier-only controls: the SMS and voice webhook URLs, the
    // outbound SMS number, and the voice-agent toggle.
    for (const affordance of ["smsUrl", "voiceUrl", "voiceAgentEnabled", "phoneNumber:"]) {
      expect(whatsapp, `the WhatsApp panel still offers ${affordance}`).not.toContain(affordance);
    }

    // And no copy promising a channel that isn't there. "text-" is a
    // Tailwind prefix, hence the lookahead rather than the bare word;
    // "SMS" is case-sensitive because Twilio's own console URLs have a
    // lowercase /sms/ path segment, which promises a visitor nothing.
    for (const claim of [/\bSMS\b/, /A2P/i, /voicemail/i, /\btexts?\b(?!-)/i, /texting/i, /\bcalls?\b/i, /voice agent/i]) {
      expect(whatsapp, `the WhatsApp panel's copy still mentions ${claim}`).not.toMatch(claim);
    }
  });
});
