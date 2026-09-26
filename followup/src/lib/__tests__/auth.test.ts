/**
 * Guarantees of the session lifecycle (src/lib/auth.ts):
 *  - authTime is only stamped on an actual sign-in round trip through
 *    Google's own login screen, never on an ordinary request that's just
 *    reusing an existing cookie.
 *  - A user removed from their team (businessId set null) is stripped of
 *    data access within one revalidation interval, rather than keeping
 *    the old token's claim for the rest of its now-7-day life.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { txInviteFindFirst, txInviteDeleteMany, txBusinessCreate, txUserUpdate, txUserCreate, gateInviteFindFirst } = vi.hoisted(() => ({
  txInviteFindFirst: vi.fn(),
  // The signup gate's own invite lookup, OUTSIDE the transaction — it has
  // to answer "is this person invited" before anything is created.
  gateInviteFindFirst: vi.fn(),
  txInviteDeleteMany: vi.fn(),
  txBusinessCreate: vi.fn(),
  txUserUpdate: vi.fn(),
  txUserCreate: vi.fn(),
}));

// The beta plan grant (src/lib/billing.ts) is its own concern, pinned in
// betaPlan.test.ts; here it must simply not throw and not touch the flow.
vi.mock("@/lib/billing", () => ({ grantBetaPlan: vi.fn(async () => true) }));
// Recording a sign-in is its own concern (signIns.test.ts); here it must
// be called on a real sign-in and never on an ordinary request.
const { captureSignIn } = vi.hoisted(() => ({ captureSignIn: vi.fn(async () => {}) }));
vi.mock("@/lib/signIns", () => ({ captureSignIn }));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    invite: { findFirst: gateInviteFindFirst },
    // The tester list is consulted on every sign-in now (see auth.ts's
    // isTester); nobody in these tests is on it.
    accessRequest: { findUnique: vi.fn(async () => null) },
    // signIn's invite-consumption logic runs inside one $transaction (see
    // its own comment — task from research/audit/2026-09-09-fifth-pass-
    // audit.md finding #2) — the mock transaction below just invokes the
    // callback with a `tx` exposing these same-shaped methods.
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
import { authOptions } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jwt = authOptions.callbacks!.jwt as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const session = authOptions.callbacks!.session as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const signIn = authOptions.callbacks!.signIn as any;

beforeEach(() => {
  p.user.findUnique.mockReset();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  txBusinessCreate.mockResolvedValue({ id: "newBiz1" });
});

describe("jwt callback", () => {
  it("stamps authTime only when a real sign-in just happened (`user` present)", async () => {
    const before = Date.now();
    const token = await jwt({
      token: { businessId: "biz1", userId: "u1", checkedAt: Date.now() },
      user: { email: "a@b.com" },
    });
    expect(token.authTime).toBeGreaterThanOrEqual(before);
  });

  it("never touches authTime on an ordinary request reusing an existing token", async () => {
    const token = await jwt({
      token: { businessId: "biz1", userId: "u1", authTime: 123, checkedAt: Date.now() },
    });
    expect(token.authTime).toBe(123);
  });

  it("resolves businessId for a token that never got one yet", async () => {
    p.user.findUnique.mockResolvedValueOnce({ id: "u1", businessId: "biz1" });
    const token = await jwt({ token: { email: "a@b.com" } });
    expect(token.businessId).toBe("biz1");
    expect(token.userId).toBe("u1");
    expect(typeof token.checkedAt).toBe("number");
  });

  it("leaves a token checked moments ago alone — no DB hit", async () => {
    const token = await jwt({ token: { businessId: "biz1", userId: "u1", checkedAt: Date.now() } });
    expect(p.user.findUnique).not.toHaveBeenCalled();
    expect(token.businessId).toBe("biz1");
  });

  it("strips businessId/userId once revalidation finds the user was removed from their team", async () => {
    p.user.findUnique.mockResolvedValueOnce({ businessId: null });
    const staleCheckedAt = Date.now() - 10 * 60 * 1000; // well past the 5-minute interval
    const token = await jwt({ token: { businessId: "biz1", userId: "u1", checkedAt: staleCheckedAt } });
    expect(token.businessId).toBeUndefined();
    expect(token.userId).toBeUndefined();
  });

  it("records the sign-in on a real sign-in, and only then", async () => {
    await jwt({ token: { businessId: "biz1", userId: "u1", checkedAt: Date.now() }, user: { email: "a@b.com" } });
    expect(captureSignIn).toHaveBeenCalledWith("a@b.com");
    captureSignIn.mockClear();
    await jwt({ token: { businessId: "biz1", userId: "u1", authTime: 123, checkedAt: Date.now() } });
    expect(captureSignIn).not.toHaveBeenCalled();
  });

  it("ends a session signed in before 'Sign out everywhere', dropping every claim", async () => {
    const authTime = Date.now() - 60 * 60 * 1000;
    p.user.findUnique.mockResolvedValueOnce({ businessId: "biz1", sessionsRevokedAt: new Date(authTime + 1000) });
    const token = await jwt({ token: { email: "a@b.com", businessId: "biz1", userId: "u1", authTime, checkedAt: Date.now() - 10 * 60 * 1000 } });
    expect(token).toEqual({ expired: true });
  });

  it("keeps a session signed in again after 'Sign out everywhere'", async () => {
    const authTime = Date.now() - 60 * 1000;
    p.user.findUnique.mockResolvedValueOnce({ businessId: "biz1", sessionsRevokedAt: new Date(authTime - 1000) });
    const token = await jwt({ token: { businessId: "biz1", userId: "u1", authTime, checkedAt: Date.now() - 10 * 60 * 1000 } });
    expect(token.businessId).toBe("biz1");
    expect(token.expired).toBeUndefined();
  });

  it("keeps an ended session ended, without looking anyone up", async () => {
    const token = await jwt({ token: { expired: true } });
    expect(token).toEqual({ expired: true });
    expect(p.user.findUnique).not.toHaveBeenCalled();
  });

  it("refreshes businessId on revalidation when it simply changed", async () => {
    p.user.findUnique.mockResolvedValueOnce({ businessId: "biz2" });
    const staleCheckedAt = Date.now() - 10 * 60 * 1000;
    const token = await jwt({ token: { businessId: "biz1", userId: "u1", checkedAt: staleCheckedAt } });
    expect(token.businessId).toBe("biz2");
    expect(token.userId).toBe("u1");
  });
});

describe("session callback", () => {
  it("reads an ended session as no session at all", async () => {
    const out = await session({ session: { user: { email: "a@b.com" }, expires: "x" }, token: { expired: true } });
    expect(out).toEqual({});
  });

  it("carries authTime onto the session even with no user object yet", async () => {
    const result = await session({ session: {}, token: { authTime: 555 } });
    expect(result.authTime).toBe(555);
  });

  it("defaults authTime to 0 for a token that predates this feature", async () => {
    const result = await session({ session: { user: {} }, token: { userId: "u1", businessId: "biz1" } });
    expect(result.authTime).toBe(0);
  });
});

// task (fifth-pass audit, finding #2): invite lookup + user upsert + invite
// deletion run inside one $transaction, and the final delete is
// count-tolerant — a losing concurrent completion of the same sign-in must
// not throw.
describe("signIn callback — invite consumption", () => {
  beforeEach(() => {
    p.user.findUnique.mockResolvedValue(null); // brand-new email, unless a test overrides it
    txInviteFindFirst.mockResolvedValue(null); // no pending invite, unless a test overrides it
    // These are about what happens AFTER someone is let in — which
    // business they land in, at what role, and that a concurrent
    // completion does not throw. Signup is opened here so the gate (added
    // 2026-09-23, and closed by default) does not stand in front of them;
    // the gate itself is pinned in signupGate.test.ts.
    vi.stubEnv("PUBLIC_SIGNUP", "true");
  });

  it("spins up a new business at ADMIN for a brand-new email with no invite", async () => {
    const ok = await signIn({ user: { email: "New@Example.com", name: "New Person" } });
    expect(ok).toBe(true);
    expect(txBusinessCreate).toHaveBeenCalled();
    expect(txUserCreate).toHaveBeenCalledWith({
      data: { email: "new@example.com", name: "New Person", businessId: "newBiz1", role: "ADMIN" },
    });
    expect(txInviteDeleteMany).not.toHaveBeenCalled();
  });

  /**
   * An invite is proof that an admin named this exact email, so joining
   * on one is the intended flow — but it had no expiry until 2026-09-20,
   * and an invite that never expires is a standing key to every lead in
   * the business. A typo'd address, or someone who has since left, could
   * walk in months later.
   *
   * The expiry is expressed in the QUERY, so a stale invite is not found
   * at all rather than found and then rejected — nothing downstream can
   * accidentally consume one.
   */
  it("only looks for invites issued recently, so a forgotten one stops working", async () => {
    await signIn({ user: { email: "new@example.com", name: "New" } });
    const where = txInviteFindFirst.mock.calls.at(-1)?.[0]?.where;
    expect(where.email).toBe("new@example.com");
    expect(where.createdAt?.gte).toBeInstanceOf(Date);
    // Thirty days: long enough that nobody meets it in normal use.
    const days = (Date.now() - (where.createdAt.gte as Date).getTime()) / 86_400_000;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThan(31);
  });

  it("joins the inviting business at the invited role instead of creating a new one", async () => {
    txInviteFindFirst.mockResolvedValue({ id: "invite1", businessId: "existingBiz", role: "SALES" });
    const ok = await signIn({ user: { email: "invited@example.com", name: "Invited Person" } });
    expect(ok).toBe(true);
    expect(txBusinessCreate).not.toHaveBeenCalled();
    expect(txUserCreate).toHaveBeenCalledWith({
      data: { email: "invited@example.com", name: "Invited Person", businessId: "existingBiz", role: "SALES" },
    });
    expect(txInviteDeleteMany).toHaveBeenCalledWith({ where: { id: "invite1" } });
  });

  it("re-attaches a returning, team-less user (removed earlier) to a new invite", async () => {
    p.user.findUnique.mockResolvedValue({ id: "u1", email: "returning@example.com", businessId: null, name: "Old Name" });
    txInviteFindFirst.mockResolvedValue({ id: "invite2", businessId: "otherBiz", role: "SALES" });
    const ok = await signIn({ user: { email: "returning@example.com", name: "New Name" } });
    expect(ok).toBe(true);
    expect(txUserUpdate).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { businessId: "otherBiz", role: "SALES", name: "New Name" },
    });
    expect(txInviteDeleteMany).toHaveBeenCalledWith({ where: { id: "invite2" } });
  });

  it("does not throw when a concurrent sign-in already consumed the invite (deleteMany finds nothing)", async () => {
    txInviteFindFirst.mockResolvedValue({ id: "invite3", businessId: "existingBiz", role: "SALES" });
    txInviteDeleteMany.mockResolvedValue({ count: 0 }); // the other concurrent request already deleted it
    await expect(signIn({ user: { email: "race@example.com", name: "Race Condition" } })).resolves.toBe(true);
  });

  it("rejects sign-in with no email at all", async () => {
    await expect(signIn({ user: {} })).resolves.toBe(false);
  });
});
