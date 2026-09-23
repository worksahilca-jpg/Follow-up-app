/**
 * Who is allowed to create an account (the gate in src/lib/auth.ts's
 * signIn callback).
 *
 * ## The incident these exist for — 2026-09-23
 *
 * The founder searched for the product on a friend's phone, found it
 * through Google, tapped "Get Started", and watched his friend's Google
 * account sign in, complete onboarding, and land on a working dashboard.
 * The database confirmed it: a real User row, ADMIN of a real, onboarded
 * Business, created that minute, by an address on no list anywhere.
 *
 * The gate was:
 *
 *     if (allowedEmails.length > 0 && !isTester) return false;
 *
 * which fails OPEN. `ALLOWED_EMAILS` was not set in production, so the
 * condition was never true and the door stood open to anyone who could
 * find the URL — against the product's own rule that sign-up is
 * invite-only (R-012). Nothing in the app said so, and nothing would
 * have: the disabled state was indistinguishable from a missing variable.
 *
 * Multi-tenant scoping did hold — the friend got his own empty business
 * and could not see anyone else's leads — but that is the second line of
 * defence, and it was the only one working.
 *
 * ## What is pinned here
 *
 * Closed is the DEFAULT, not a configuration. The first test is the
 * incident itself, and it must fail if anyone ever restores a default
 * that depends on a variable being present.
 *
 * The other half matters just as much: closing the door must not lock
 * anyone out or break team invites, because a security fix that strands
 * the founder or silently breaks invites gets reverted, and then the door
 * is open again.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { txBusinessCreate, txUserCreate, txUserUpdate, txInviteFindFirst, txInviteDeleteMany, gateInviteFindFirst } =
  vi.hoisted(() => ({
    txBusinessCreate: vi.fn(),
    txUserCreate: vi.fn(),
    txUserUpdate: vi.fn(),
    txInviteFindFirst: vi.fn(),
    txInviteDeleteMany: vi.fn(),
    gateInviteFindFirst: vi.fn(),
  }));

vi.mock("@/lib/billing", () => ({ grantBetaPlan: vi.fn(async () => true) }));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    accessRequest: { findUnique: vi.fn(async () => null) },
    // The gate's lookup, outside the transaction.
    invite: { findFirst: gateInviteFindFirst },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({
        invite: { findFirst: txInviteFindFirst, deleteMany: txInviteDeleteMany },
        business: { create: txBusinessCreate },
        user: { update: txUserUpdate, create: txUserCreate },
      })
    ),
  },
}));

import { prisma } from "@/lib/db";
import { authOptions, inviteAloneIsEnough } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const signIn = authOptions.callbacks!.signIn as any;

const stranger = { email: "thakur2005harsh@gmail.com", name: "Harsh Thakur" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  p.user.findUnique.mockResolvedValue(null);
  p.accessRequest.findUnique.mockResolvedValue(null);
  gateInviteFindFirst.mockResolvedValue(null);
  txInviteFindFirst.mockResolvedValue(null);
  txBusinessCreate.mockResolvedValue({ id: "newBiz" });
});

describe("a stranger who found the site", () => {
  it("is refused when nothing is configured at all", async () => {
    // THE incident. No ALLOWED_EMAILS, no PUBLIC_SIGNUP, no invite —
    // which is precisely the production state that let a real account be
    // created. Closed has to be what an unconfigured deployment does.
    await expect(signIn({ user: stranger })).resolves.toBe(false);
  });

  it("creates absolutely nothing when refused", async () => {
    // A refusal that still wrote a User or a Business would leave the
    // mess behind while reporting a failure, and the next attempt would
    // find a half-made account.
    await signIn({ user: stranger });
    expect(txBusinessCreate, "a refused signup created a business").not.toHaveBeenCalled();
    expect(txUserCreate, "a refused signup created a user").not.toHaveBeenCalled();
    expect(p.$transaction, "a refused signup opened the signup transaction").not.toHaveBeenCalled();
  });

  it("is still refused when the tester list is empty rather than absent", async () => {
    // The exact shape of the old bug: an EMPTY allowlist used to mean
    // "everyone welcome". Emptiness must never be permission.
    vi.stubEnv("ALLOWED_EMAILS", "");
    await expect(signIn({ user: stranger })).resolves.toBe(false);
  });

  it("is not let in by a half-set or misspelled PUBLIC_SIGNUP", async () => {
    // Opening up is a deliberate act, so only the exact string counts.
    // Anything else is somebody's typo, and a typo must fail safe.
    for (const value of ["", "false", "1", "yes", "TRUE", "True", " true"]) {
      vi.stubEnv("PUBLIC_SIGNUP", value);
      expect(await signIn({ user: stranger }), `PUBLIC_SIGNUP="${value}" opened signup`).toBe(false);
    }
  });

  it("is let in only when the deployment says so out loud", async () => {
    vi.stubEnv("PUBLIC_SIGNUP", "true");
    await expect(signIn({ user: stranger })).resolves.toBe(true);
    expect(txBusinessCreate).toHaveBeenCalled();
  });
});

describe("the three ways in that are a real invitation", () => {
  it("lets in an address on the tester list", async () => {
    vi.stubEnv("ALLOWED_EMAILS", "friend@example.com, harsh@example.com");
    await expect(signIn({ user: { email: "Harsh@Example.com", name: "Harsh" } })).resolves.toBe(true);
  });

  it("lets in an address approved from /admin, with no redeploy", async () => {
    p.accessRequest.findUnique.mockResolvedValue({ status: "approved" });
    await expect(signIn({ user: stranger })).resolves.toBe(true);
  });

  it("does not let in an access request that was never approved", async () => {
    // Asking is not being granted. R-012 also forbids a request form as a
    // way in — a pending row is a request, not an invitation.
    p.accessRequest.findUnique.mockResolvedValue({ status: "pending" });
    await expect(signIn({ user: stranger })).resolves.toBe(false);
  });

  it("lets in someone an admin invited to their team", async () => {
    // Without this the fail-closed gate would break team invites on every
    // deployment: the invite is consumed AFTER the gate, so a gate that
    // could not see it would refuse every invited teammate.
    gateInviteFindFirst.mockResolvedValue({ id: "invite1" });
    txInviteFindFirst.mockResolvedValue({ id: "invite1", businessId: "theirBiz", role: "SALES" });
    await expect(signIn({ user: { email: "teammate@example.com", name: "Teammate" } })).resolves.toBe(true);
    // …and into the inviting business, not one of their own.
    expect(txBusinessCreate).not.toHaveBeenCalled();
    expect(txUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ businessId: "theirBiz", role: "SALES" }) })
    );
  });

  it("only counts an invite inside the same window the consumer uses", async () => {
    // The gate and the transaction both filter on createdAt. If the gate
    // were the more generous of the two, a stale invite would get someone
    // past the door and then be ignored — landing an invited teammate in
    // a brand-new business of their own instead of the team that asked
    // for them. Both read INVITE_VALID_DAYS from one place; this pins
    // that the gate filters at all.
    await signIn({ user: { email: "stale@example.com" } });
    expect(gateInviteFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ createdAt: expect.objectContaining({ gte: expect.any(Date) }) }) })
    );
  });

  it("reports to Settings that an invite is enough", async () => {
    // Settings tells owners "they'll join automatically the next time
    // they sign in". That was false while the allowlist was set. It is
    // true now, and this is the function that panel reads.
    expect(inviteAloneIsEnough()).toBe(true);
  });
});

describe("closing the door must not lock anyone out", () => {
  it("lets an existing member sign in even though they are on no list", async () => {
    // The failure that would get this whole fix reverted. The founder's
    // own address is not necessarily in ALLOWED_EMAILS; if tightening the
    // gate locked him out of his own product, the gate would come straight
    // back out and the door would be open again.
    p.user.findUnique.mockResolvedValue({ id: "u1", email: "founder@example.com", businessId: "biz1", name: "Founder" });
    await expect(signIn({ user: { email: "founder@example.com", name: "Founder" } })).resolves.toBe(true);
  });

  it("never even asks about invites for someone who already has a business", async () => {
    // This is a sign-IN, not a sign-up. Nothing about the gate applies.
    p.user.findUnique.mockResolvedValue({ id: "u1", email: "member@example.com", businessId: "biz1", name: "Member" });
    await signIn({ user: { email: "member@example.com", name: "Member" } });
    expect(gateInviteFindFirst).not.toHaveBeenCalled();
  });

  it("does gate a user who was removed from their team", async () => {
    // The other side of it: removeMember() nulls businessId precisely to
    // take access away. Treating "has a row" as "is allowed" would make
    // removal useless — they would sign straight back in.
    p.user.findUnique.mockResolvedValue({ id: "u1", email: "removed@example.com", businessId: null, name: "Removed" });
    await expect(signIn({ user: { email: "removed@example.com", name: "Removed" } })).resolves.toBe(false);
  });

  it("lets a removed user back in on a fresh invite", async () => {
    p.user.findUnique.mockResolvedValue({ id: "u1", email: "removed@example.com", businessId: null, name: "Removed" });
    gateInviteFindFirst.mockResolvedValue({ id: "invite9" });
    txInviteFindFirst.mockResolvedValue({ id: "invite9", businessId: "biz2", role: "SALES" });
    await expect(signIn({ user: { email: "removed@example.com", name: "Removed" } })).resolves.toBe(true);
  });

  it("still refuses a sign-in with no email", async () => {
    await expect(signIn({ user: {} })).resolves.toBe(false);
  });
});
