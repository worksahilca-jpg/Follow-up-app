/**
 * The founder's sign-up buzz (founder, 2026-10-11: "yes build the sign-up
 * buzz too"). Who triggers it is pinned in signupGate.test.ts; here, what
 * it says and who it reaches.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { userFindMany, businessFindUnique, sendPushToUser } = vi.hoisted(() => ({
  userFindMany: vi.fn(),
  businessFindUnique: vi.fn(),
  sendPushToUser: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: { user: { findMany: userFindMany }, business: { findUnique: businessFindUnique } } }));
vi.mock("@/lib/webPush", () => ({ sendPushToUser }));
vi.mock("@/lib/alertEmail", () => ({ sendAlertEmail: vi.fn() }));
vi.mock("@/lib/slack", () => ({ notifySlack: vi.fn() }));

import { signupBuzzText, buzzFounderAboutSignup, tellFounderAboutSignup } from "@/lib/signupBuzz";

const asha = { userEmail: "asha@example.com", name: "Asha Patel", businessId: "b1", joinedTeam: false };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PLATFORM_ADMIN_EMAILS", "founder@followupbase.io");
  userFindMany.mockResolvedValue([{ id: "f1" }]);
  sendPushToUser.mockResolvedValue({ delivered: 1, removed: 0, failed: 0 });
});

describe("what the buzz says", () => {
  it("names the person, never their address", () => {
    expect(signupBuzzText("Asha Patel", false)).toEqual({ title: "New sign-up", body: "Asha Patel just signed up." });
    expect(signupBuzzText("Ben", "Maple Realty").body).toBe("Ben joined the team at Maple Realty.");
    expect(signupBuzzText("Ben", null).body).toBe("Ben joined a team.");
    expect(signupBuzzText(null, false).body).toBe("Someone new just signed up.");
  });
});

describe("who it reaches", () => {
  it("buzzes each founder's phone, opening /admin", async () => {
    expect(await buzzFounderAboutSignup(asha)).toBe(1);
    expect(sendPushToUser).toHaveBeenCalledWith("f1", {
      title: "New sign-up",
      body: "Asha Patel just signed up.",
      url: "/admin",
      tag: expect.stringMatching(/^signup-[0-9a-f]{16}$/),
    });
  });

  it("names the team someone joined", async () => {
    businessFindUnique.mockResolvedValue({ name: "Maple Realty" });
    await buzzFounderAboutSignup({ ...asha, joinedTeam: true });
    expect(sendPushToUser).toHaveBeenCalledWith("f1", expect.objectContaining({ body: "Asha Patel joined the team at Maple Realty." }));
  });

  it("doesn't buzz the founder about their own sign-up, or when nobody is set to hear it", async () => {
    expect(await buzzFounderAboutSignup({ ...asha, userEmail: "Founder@FollowUpBase.io" })).toBe(0);
    vi.stubEnv("PLATFORM_ADMIN_EMAILS", "");
    expect(await buzzFounderAboutSignup(asha)).toBe(0);
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it("never throws into the sign-in, even when the buzz fails", async () => {
    userFindMany.mockRejectedValue(new Error("database down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(tellFounderAboutSignup(asha)).resolves.toBeUndefined();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
