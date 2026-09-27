/**
 * Sign-ins and the new-sign-in email (design brain A-041).
 *
 * What's kept is coarse on purpose (a browser-and-system label and a city,
 * never the user agent or the IP), and the email goes only when a sign-in
 * comes from a device and place this person hasn't used in 90 days.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { userFindUnique, signInFindMany, signInCreate, signInDeleteMany, sendAlertEmail } = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  signInFindMany: vi.fn(),
  signInCreate: vi.fn(),
  signInDeleteMany: vi.fn(),
  sendAlertEmail: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: { user: { findUnique: userFindUnique }, signIn: { findMany: signInFindMany, create: signInCreate, deleteMany: signInDeleteMany } },
}));
vi.mock("@/lib/alertEmail", () => ({ sendAlertEmail }));
vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://followupbase.io" }));

import { describeDevice, describePlace, isNewSignIn, recordSignIn, signInAlertEmail } from "@/lib/signIns";

const MAC_CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const WIN_EDGE = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0";
const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID_FIREFOX = "Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0";

describe("describeDevice", () => {
  it("names the browser and the system", () => {
    expect(describeDevice(MAC_CHROME)).toBe("Chrome on Mac");
    expect(describeDevice(WIN_EDGE)).toBe("Edge on Windows");
    expect(describeDevice(IPHONE_SAFARI)).toBe("Safari on iPhone");
    expect(describeDevice(ANDROID_FIREFOX)).toBe("Firefox on Android");
  });
  it("says so when it can't tell", () => {
    expect(describeDevice("")).toBe("An unknown browser");
    expect(describeDevice(null)).toBe("An unknown browser");
  });
});

describe("describePlace", () => {
  it("decodes the city and names the country", () => {
    expect(describePlace("S%C3%A3o%20Paulo", "BR")).toBe("São Paulo, Brazil");
    expect(describePlace("Toronto", "CA")).toBe("Toronto, Canada");
  });
  it("uses what it has", () => {
    expect(describePlace(null, "CA")).toBe("Canada");
    expect(describePlace("Toronto", null)).toBe("Toronto");
    expect(describePlace(null, null)).toBeNull();
  });
});

describe("isNewSignIn", () => {
  it("is new only when no earlier sign-in had the same device and place", () => {
    const earlier = [{ device: "Chrome on Mac", place: "Toronto, Canada" }];
    expect(isNewSignIn(earlier, { device: "Chrome on Mac", place: "Toronto, Canada" })).toBe(false);
    expect(isNewSignIn(earlier, { device: "Edge on Windows", place: "Toronto, Canada" })).toBe(true);
    expect(isNewSignIn(earlier, { device: "Chrome on Mac", place: "Lagos, Nigeria" })).toBe(true);
  });
});

describe("signInAlertEmail", () => {
  it("says what, where and when, and links to sign out everywhere", () => {
    const e = signInAlertEmail({
      email: "sahil@example.com",
      device: "Edge on Windows",
      place: "Mississauga, Canada",
      at: new Date("2026-09-27T01:14:00Z"),
      timeZone: "America/Toronto",
      base: "https://followupbase.io",
    });
    expect(e.subject).toBe("New sign-in to FollowUp");
    expect(e.text).toContain("Device: Edge on Windows");
    expect(e.text).toContain("Near: Mississauga, Canada");
    expect(e.text).toContain("When: Sat, Sep 26 at 9:14 PM");
    expect(e.text).toContain("https://followupbase.io/settings#security");
    expect(e.html).toContain("Not you? Sign out everywhere");
  });

  it("escapes what it puts in the HTML", () => {
    const e = signInAlertEmail({ email: "a@b.com", device: "<b>x</b>", place: null, at: new Date(), timeZone: "UTC", base: "https://f.io" });
    expect(e.html).not.toContain("<b>x</b>");
    expect(e.text).not.toContain("Near:");
  });
});

describe("recordSignIn", () => {
  const req = { userAgent: WIN_EDGE, city: "Mississauga", country: "CA" };
  beforeEach(() => {
    vi.clearAllMocks();
    userFindUnique.mockResolvedValue({ id: "u1", email: "sahil@example.com", business: { timezone: "America/Toronto" } });
    signInCreate.mockResolvedValue({ id: "s1" });
    signInDeleteMany.mockResolvedValue({ count: 0 });
    sendAlertEmail.mockResolvedValue({ sent: true });
  });

  it("stores the coarse labels, never the raw user agent", async () => {
    signInFindMany.mockResolvedValue([]);
    await recordSignIn("Sahil@Example.com", req);
    expect(userFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: "sahil@example.com" } }));
    const data = signInCreate.mock.calls[0][0].data;
    expect(data).toEqual(expect.objectContaining({ userId: "u1", device: "Edge on Windows", place: "Mississauga, Canada" }));
    expect(JSON.stringify(data)).not.toContain("Mozilla");
  });

  it("doesn't email with nothing to compare against", async () => {
    signInFindMany.mockResolvedValue([]);
    expect(await recordSignIn("sahil@example.com", req)).toEqual({ recorded: true, emailed: false });
    expect(sendAlertEmail).not.toHaveBeenCalled();
  });

  it("doesn't email a device and place already seen", async () => {
    signInFindMany.mockResolvedValue([{ device: "Edge on Windows", place: "Mississauga, Canada" }]);
    expect((await recordSignIn("sahil@example.com", req)).emailed).toBe(false);
    expect(sendAlertEmail).not.toHaveBeenCalled();
  });

  it("emails the person when the device or place is new, once per sign-in", async () => {
    signInFindMany.mockResolvedValue([{ device: "Chrome on Mac", place: "Toronto, Canada" }]);
    expect((await recordSignIn("sahil@example.com", req)).emailed).toBe(true);
    expect(sendAlertEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "sahil@example.com", subject: "New sign-in to FollowUp", idempotencyKey: "signin-s1" }));
  });

  it("forgets sign-ins older than 90 days", async () => {
    signInFindMany.mockResolvedValue([]);
    const now = new Date("2026-09-26T12:00:00Z");
    await recordSignIn("sahil@example.com", req, now);
    const cutoff = signInDeleteMany.mock.calls[0][0].where.createdAt.lt as Date;
    expect(now.getTime() - cutoff.getTime()).toBe(90 * 24 * 60 * 60 * 1000);
  });

  it("does nothing for an email with no account", async () => {
    userFindUnique.mockResolvedValue(null);
    expect(await recordSignIn("nobody@example.com", req)).toEqual({ recorded: false, emailed: false });
    expect(signInCreate).not.toHaveBeenCalled();
  });
});
