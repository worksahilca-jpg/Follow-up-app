/**
 * The team-invite link (security audit 2026-09-16 H-2, fixed 2026-09-26):
 * the token binds an invite id to the invited address, can't be made up,
 * and /api/invite/accept only remembers a link that belongs to a live
 * invite. What happens at sign-in is pinned in signupGate.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { inviteFindUnique } = vi.hoisted(() => ({ inviteFindUnique: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { invite: { findUnique: inviteFindUnique } } }));
vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://followupbase.io" }));
vi.mock("@/lib/billing", () => ({ grantBetaPlan: vi.fn() }));

import {
  INVITE_COOKIE,
  inviteLink,
  inviteToken,
  inviteTokenMatches,
  parseInviteCookie,
  inviteCookieValue,
} from "@/lib/inviteToken";
import { GET as accept } from "@/app/api/invite/accept/route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("NEXTAUTH_SECRET", "test-nextauth-secret");
});

describe("invite tokens", () => {
  it("match only the invite id and address they were issued for", () => {
    const t = inviteToken("inv1", "Teammate@Example.com");
    expect(inviteTokenMatches("inv1", "teammate@example.com", t)).toBe(true);
    expect(inviteTokenMatches("inv1", "someone-else@example.com", t)).toBe(false);
    expect(inviteTokenMatches("inv2", "teammate@example.com", t)).toBe(false);
    expect(inviteTokenMatches("inv1", "teammate@example.com", "A".repeat(43))).toBe(false);
  });

  it("depend on the server secret, so a token from another key is worthless", () => {
    const t = inviteToken("inv1", "teammate@example.com");
    vi.stubEnv("NEXTAUTH_SECRET", "a-different-secret");
    expect(inviteTokenMatches("inv1", "teammate@example.com", t)).toBe(false);
  });

  it("cannot be issued without a secret", () => {
    vi.stubEnv("NEXTAUTH_SECRET", "");
    expect(() => inviteToken("inv1", "teammate@example.com")).toThrow(/NEXTAUTH_SECRET/);
  });

  it("round-trip through the cookie format, and junk parses to nothing", () => {
    const t = inviteToken("inv1", "a@b.com");
    expect(parseInviteCookie(inviteCookieValue("inv1", t))).toEqual({ inviteId: "inv1", token: t });
    expect(parseInviteCookie("nodot")).toBeNull();
    expect(parseInviteCookie("inv1.short")).toBeNull();
    expect(parseInviteCookie(undefined)).toBeNull();
  });

  it("build the link to the accept route", () => {
    const url = new URL(inviteLink("inv1", "a@b.com"));
    expect(url.origin + url.pathname).toBe("https://followupbase.io/api/invite/accept");
    expect(url.searchParams.get("i")).toBe("inv1");
    expect(url.searchParams.get("t")).toBe(inviteToken("inv1", "a@b.com"));
  });
});

describe("GET /api/invite/accept", () => {
  const open = (url: string) => accept(new NextRequest(url));

  it("remembers a valid link in an httpOnly cookie and sends them to sign in", async () => {
    inviteFindUnique.mockResolvedValue({ id: "inv1", email: "teammate@example.com", createdAt: new Date() });
    const res = await open(inviteLink("inv1", "teammate@example.com"));
    expect(res.headers.get("location")).toBe("https://followupbase.io/signin?invite=1");
    const cookie = res.cookies.get(INVITE_COOKIE);
    expect(cookie?.value).toBe(inviteCookieValue("inv1", inviteToken("inv1", "teammate@example.com")));
    expect(cookie?.httpOnly).toBe(true);
  });

  it("refuses a token that isn't this invite's, and sets nothing", async () => {
    inviteFindUnique.mockResolvedValue({ id: "inv1", email: "teammate@example.com", createdAt: new Date() });
    const res = await open(inviteLink("inv1", "attacker@example.com"));
    expect(res.headers.get("location")).toBe("https://followupbase.io/signin?error=InviteInvalid");
    expect(res.cookies.get(INVITE_COOKIE)).toBeUndefined();
  });

  it("refuses a cancelled invite and an expired one the same way", async () => {
    inviteFindUnique.mockResolvedValue(null);
    const gone = await open(inviteLink("inv1", "teammate@example.com"));
    expect(gone.headers.get("location")).toContain("error=InviteInvalid");

    inviteFindUnique.mockResolvedValue({ id: "inv1", email: "teammate@example.com", createdAt: new Date("2020-01-01") });
    const stale = await open(inviteLink("inv1", "teammate@example.com"));
    expect(stale.headers.get("location")).toContain("error=InviteInvalid");
    expect(stale.cookies.get(INVITE_COOKIE)).toBeUndefined();
  });
});
