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
