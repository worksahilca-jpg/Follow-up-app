/**
 * Landing back on the right onboarding step (src/lib/onboardingResume.ts).
 *
 * Onboarding is three steps now — details, how it works, where your leads
 * come from — and the third one is full of buttons that leave the app
 * entirely. Every trip back is a fresh page load with no client state, so
 * something has to work out where the owner was.
 */
import { describe, it, expect } from "vitest";
import { cameBackFromConnect, shouldResumeAtSources, CONNECT_RESULT_KEYS } from "@/lib/onboardingResume";

const none = { anyConnected: false, anyDismissed: false, cameBackFromConnect: false };

describe("shouldResumeAtSources", () => {
  it("shows the explainer to someone who has done nothing yet", () => {
    expect(shouldResumeAtSources(none)).toBe(false);
  });

  it("skips the explainer once a source is connected", () => {
    expect(shouldResumeAtSources({ ...none, anyConnected: true })).toBe(true);
  });

  it("skips the explainer once a source has been passed over", () => {
    // Someone who pressed Continue with nothing connected: their "I don't
    // use these" answers are already recorded, so re-explaining the
    // product to them would be starting over.
    expect(shouldResumeAtSources({ ...none, anyDismissed: true })).toBe(true);
  });

  /**
   * The case that decides whether the product feels broken.
   *
   * A refused connect — "Only an admin can connect Instagram", a cancelled
   * Meta login — comes back with nothing connected and nothing dismissed.
   * Without this clause the owner is dropped two steps back onto the
   * explainer, and the error message is handed to a step that does not
   * render errors: the button appears to have done nothing at all.
   */
  it("stays on the sources step when a connect attempt failed", () => {
    expect(shouldResumeAtSources({ ...none, cameBackFromConnect: true })).toBe(true);
  });
});

describe("cameBackFromConnect", () => {
  it("recognises every provider's callback", () => {
    for (const key of CONNECT_RESULT_KEYS) {
      expect(cameBackFromConnect({ [key]: "connected" })).toBe(true);
      expect(cameBackFromConnect({ [key]: "error" })).toBe(true);
    }
  });

  it("reads presence, not value — a half-finished result still counts", () => {
    // Facebook's multi-Page case comes back as choose_page: the owner
    // pressed Connect and got somewhere, just not all the way.
    expect(cameBackFromConnect({ facebook: "choose_page" })).toBe(true);
    expect(cameBackFromConnect({ gmail: "" })).toBe(true);
  });

  it("ignores unrelated query params", () => {
    expect(cameBackFromConnect({})).toBe(false);
    expect(cameBackFromConnect({ ref: "email", utm_source: "x" })).toBe(false);
    // `message` rides along with an error, but on its own it is not a result.
    expect(cameBackFromConnect({ message: "Couldn't connect" })).toBe(false);
  });

  it("covers both inbox providers, not just Gmail", () => {
    // Outlook was missing from onboarding entirely once before, and the
    // symptom was exactly this: a business on Microsoft 365 with no way
    // through and a nag it could never clear.
    expect(CONNECT_RESULT_KEYS).toContain("gmail");
    expect(CONNECT_RESULT_KEYS).toContain("outlook");
  });
});
