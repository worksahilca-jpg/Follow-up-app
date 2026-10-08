import { describe, it, expect } from "vitest";
import { displayChannel, LEAD_AD_SOURCE, LEAD_FORM } from "@/lib/displayChannel";
import { formatDate } from "@/lib/demo-data";

describe("displayChannel", () => {
  // The first Lead Ad test showed "Website form" while "Came from" said Facebook (2026-10-07).
  it("names a Lead Ad's web conversation as the Facebook form it came from", () => {
    expect(displayChannel("web", LEAD_AD_SOURCE)).toBe(LEAD_FORM);
  });

  it("leaves every other channel as stored", () => {
    expect(displayChannel("web", "Website form")).toBe("web");
    expect(displayChannel("messenger", "Facebook Messenger")).toBe("messenger");
    expect(displayChannel("email", LEAD_AD_SOURCE)).toBe("email");
    expect(displayChannel(null, LEAD_AD_SOURCE)).toBeNull();
  });
});

describe("formatDate in the business's time zone", () => {
  it("says the owner's date, not the server's", () => {
    // 8:58 PM on Oct 7 in New York is already Oct 8 in UTC.
    expect(formatDate("2026-10-08T00:58:00Z", "America/New_York")).toBe("Oct 7");
    expect(formatDate("2026-10-08T00:58:00Z", "UTC")).toBe("Oct 8");
  });
});
