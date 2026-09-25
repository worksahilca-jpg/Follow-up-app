/**
 * The one-off backfill of Business.instagramAccountId
 * (src/lib/instagramAccountBackfill.ts, run by
 * scripts/backfill-instagram-account-id.ts). Accounts connected before
 * 2026-09-25 have no professional-account id, so until this runs they keep
 * the F1/F2 failures (audit 2026-09-24).
 *
 * What is pinned: a dry run writes nothing; a write only fills a value
 * that is still empty; one Instagram account is never attached to two
 * businesses; a token that now answers for a different account is left for
 * a person; and no token ever reaches the output.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { businessFindMany, businessFindFirst, businessUpdateMany, resolveInstagramUserId } = vi.hoisted(() => ({
  businessFindMany: vi.fn(),
  businessFindFirst: vi.fn(async () => null),
  businessUpdateMany: vi.fn(async () => ({ count: 1 })),
  resolveInstagramUserId: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: { business: { findMany: businessFindMany, findFirst: businessFindFirst, updateMany: businessUpdateMany } },
}));
vi.mock("@/lib/instagram", () => ({ resolveInstagramUserId }));

import { backfillInstagramAccountIds, needsAttention } from "@/lib/instagramAccountBackfill";

const APP_SCOPED = "28693476873589439";
const PROFESSIONAL = "17841427527466039";
const TOKEN = "IGAAT-founder-secret";

const founder = { id: "cmtibjn400000iq84yxpzsw45", instagramUserId: APP_SCOPED, instagramUsername: "followupbase", instagramAccessToken: TOKEN };

beforeEach(() => {
  vi.clearAllMocks();
  businessFindMany.mockResolvedValue([founder]);
  businessFindFirst.mockResolvedValue(null);
  businessUpdateMany.mockResolvedValue({ count: 1 });
  resolveInstagramUserId.mockResolvedValue({ id: APP_SCOPED, accountId: PROFESSIONAL, username: "followupbase" });
});

describe("backfillInstagramAccountIds", () => {
  it("only looks at businesses that hold a token and have no professional-account id yet", async () => {
    await backfillInstagramAccountIds({ apply: false });
    expect(businessFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { instagramAccessToken: { not: null }, instagramAccountId: null } })
    );
  });

  it("writes nothing on a dry run, and says what it would write", async () => {
    const results = await backfillInstagramAccountIds({ apply: false });
    expect(results).toEqual([expect.objectContaining({ businessId: founder.id, outcome: "would_fill", accountId: PROFESSIONAL })]);
    expect(businessUpdateMany).not.toHaveBeenCalled();
  });

  it("with apply, fills the value only if it is still empty and the stored id is unchanged", async () => {
    const results = await backfillInstagramAccountIds({ apply: true });
    expect(businessUpdateMany).toHaveBeenCalledWith({
      where: { id: founder.id, instagramAccountId: null, instagramUserId: APP_SCOPED },
      data: { instagramAccountId: PROFESSIONAL },
    });
    expect(results[0].outcome).toBe("filled");
    expect(results.some(needsAttention)).toBe(false);
  });

  it("reports a row that changed mid-run (a reconnect won) instead of overwriting it", async () => {
    businessUpdateMany.mockResolvedValue({ count: 0 });
    const [result] = await backfillInstagramAccountIds({ apply: true });
    expect(result.outcome).toBe("changed_meanwhile");
    expect(needsAttention(result)).toBe(true);
  });

  // The unique index is what stops one Instagram account feeding two
  // businesses; the backfill reports it and leaves both rows alone.
  it("never attaches an account that another business already holds", async () => {
    businessFindFirst.mockResolvedValue({ id: "some-other-business" } as never);
    const [dry] = await backfillInstagramAccountIds({ apply: false });
    expect(dry).toEqual(expect.objectContaining({ outcome: "already_attached", detail: expect.stringContaining("some-other-business") }));

    const [applied] = await backfillInstagramAccountIds({ apply: true });
    expect(applied.outcome).toBe("already_attached");
    expect(businessUpdateMany).not.toHaveBeenCalled();
  });

  // The per-column unique index cannot see an account id sitting in the
  // OTHER column of another business (pr324-review P4), so the holder
  // check looks in both.
  it("looks for another holder in both id columns, never this business", async () => {
    await backfillInstagramAccountIds({ apply: false });
    expect(businessFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { not: founder.id },
          OR: [{ instagramAccountId: PROFESSIONAL }, { instagramUserId: PROFESSIONAL }],
        },
      })
    );
  });

  it("treats the unique index refusing the write as 'already attached', not as a crash", async () => {
    businessUpdateMany.mockRejectedValue(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }));
    const [result] = await backfillInstagramAccountIds({ apply: true });
    expect(result.outcome).toBe("already_attached");
  });

  it("leaves a business alone when its token now answers for a different account", async () => {
    resolveInstagramUserId.mockResolvedValue({ id: "29999999999999999", accountId: "17841400000000001" });
    const [result] = await backfillInstagramAccountIds({ apply: true });
    expect(result.outcome).toBe("different_account");
    expect(businessUpdateMany).not.toHaveBeenCalled();
  });

  it("reports an expired or revoked token with Meta's reason and moves on to the next business", async () => {
    businessFindMany.mockResolvedValue([founder, { ...founder, id: "biz2", instagramUsername: "second" }]);
    resolveInstagramUserId
      .mockResolvedValueOnce({ error: "https://graph.instagram.com/v21.0/me: 400 Error validating access token [190]" })
      .mockResolvedValueOnce({ id: APP_SCOPED, accountId: "17841400000000002" });
    const results = await backfillInstagramAccountIds({ apply: true });
    expect(results.map((r) => r.outcome)).toEqual(["refused", "filled"]);
    expect(results[0].detail).toContain("[190]");
  });

  it("reports an account Meta returns no user_id for, and writes nothing", async () => {
    resolveInstagramUserId.mockResolvedValue({ id: APP_SCOPED });
    const [result] = await backfillInstagramAccountIds({ apply: true });
    expect(result.outcome).toBe("no_user_id");
    expect(businessUpdateMany).not.toHaveBeenCalled();
  });

  it("never puts a token in its output", async () => {
    const lines: string[] = [];
    businessFindMany.mockResolvedValue([founder, { ...founder, id: "biz2" }, { ...founder, id: "biz3" }]);
    resolveInstagramUserId
      .mockResolvedValueOnce({ id: APP_SCOPED, accountId: PROFESSIONAL })
      .mockResolvedValueOnce({ error: "Meta said no" })
      .mockResolvedValueOnce({ id: APP_SCOPED });
    const results = await backfillInstagramAccountIds({ apply: true, log: (line) => lines.push(line) });
    expect(lines.join("\n")).not.toContain(TOKEN);
    expect(JSON.stringify(results)).not.toContain(TOKEN);
    expect(lines.join("\n")).toContain("@followupbase");
  });
});
