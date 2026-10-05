import { describe, it, expect } from "vitest";
import { safeBannerText } from "@/lib/bannerText";

const F = "Couldn't connect Gmail.";

describe("safeBannerText (security review L1)", () => {
  it("keeps FollowUp's own short sentences", () => {
    expect(safeBannerText("This Gmail is already connected to another FollowUp account.", F)).toBe(
      "This Gmail is already connected to another FollowUp account."
    );
    expect(safeBannerText("Only an admin can connect Gmail", F)).toBe("Only an admin can connect Gmail");
  });

  it("replaces anything that sends people somewhere else", () => {
    for (const bad of [
      "Your account is locked. Visit https://evil.example to unlock it",
      "Go to www.evil.example",
      "Sign in again at followup-support.com",
      "Email help@evil.example",
      "Account suspended. Call 1-800-555-0199 now",
      "Call +1 (416) 555 0199",
      "<b>hi</b>",
      "x".repeat(201),
    ]) {
      expect(safeBannerText(bad, F)).toBe(F);
    }
  });

  it("falls back when there is no message", () => {
    expect(safeBannerText(null, F)).toBe(F);
    expect(safeBannerText("   ", F)).toBe(F);
  });
});
