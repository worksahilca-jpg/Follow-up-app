/**
 * Opening an invite link means the next sign-in joins that team, so the
 * sign-in page names the team first — from the database, via the invite
 * the browser's cookie names, never from anything in the URL (security
 * audit 2026-09-26, invite-link follow-up).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { inviteFindUnique, cookieJar } = vi.hoisted(() => ({
  inviteFindUnique: vi.fn(),
  cookieJar: new Map<string, string>(),
}));
vi.mock("@/lib/db", () => ({ prisma: { invite: { findUnique: inviteFindUnique } } }));
vi.mock("@/lib/session", () => ({ getSessionContext: vi.fn(async () => null) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined) }),
}));
vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://followupbase.io" }));
vi.mock("@/components/landing/SignInClient", () => ({ default: () => null }));

import SignInPage from "@/app/signin/page";
import { INVITE_COOKIE } from "@/lib/inviteToken";

beforeEach(() => {
  vi.clearAllMocks();
  cookieJar.clear();
});

describe("the sign-in page after an invite link", () => {
  it("names the inviting business, looked up from the invite itself", async () => {
    cookieJar.set(INVITE_COOKIE, `inv1.${"A".repeat(43)}`);
    inviteFindUnique.mockResolvedValue({ business: { name: "Acme Plumbing" } });
    const el = (await SignInPage()) as unknown as { props: { inviteBusinessName: string | null } };
    expect(inviteFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "inv1" } }));
    expect(el.props.inviteBusinessName).toBe("Acme Plumbing");
  });

  it("says nothing, and asks nothing of the database, without an invite cookie", async () => {
    const el = (await SignInPage()) as unknown as { props: { inviteBusinessName: string | null } };
    expect(inviteFindUnique).not.toHaveBeenCalled();
    expect(el.props.inviteBusinessName).toBeNull();
  });

  it("says nothing for a cancelled invite", async () => {
    cookieJar.set(INVITE_COOKIE, `inv1.${"A".repeat(43)}`);
    inviteFindUnique.mockResolvedValue(null);
    const el = (await SignInPage()) as unknown as { props: { inviteBusinessName: string | null } };
    expect(el.props.inviteBusinessName).toBeNull();
  });
});
