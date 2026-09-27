import { afterEach, describe, expect, it, vi } from "vitest";
import { followUpSendingAddresses, isFollowUpSender } from "@/lib/ownSenders";

// FollowUp's own alert emails land in the owner's inbox, which is the inbox
// FollowUp reads. These must never become a customer called "FollowUp".
describe("isFollowUpSender", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("recognises the default alerts address in any case", () => {
    vi.stubEnv("ALERT_FROM_EMAIL", "");
    expect(isFollowUpSender("alerts@followupbase.io")).toBe(true);
    expect(isFollowUpSender("Alerts@FollowUpBase.io")).toBe(true);
  });

  it("recognises a configured sender, with or without a display name", () => {
    vi.stubEnv("ALERT_FROM_EMAIL", "FollowUp <notify@mail.example.com>");
    expect(followUpSendingAddresses()).toContain("notify@mail.example.com");
    expect(isFollowUpSender("notify@mail.example.com")).toBe(true);
    // The default stays covered: alerts already sitting in an inbox came from it.
    expect(isFollowUpSender("alerts@followupbase.io")).toBe(true);
  });

  it("leaves real people alone, including other addresses on our domain", () => {
    vi.stubEnv("ALERT_FROM_EMAIL", "");
    expect(isFollowUpSender("grace@example.com")).toBe(false);
    expect(isFollowUpSender("sahil@followupbase.io")).toBe(false);
  });
});
