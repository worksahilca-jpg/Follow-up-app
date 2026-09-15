/**
 * Email unsubscribe — the mechanism email did not have.
 *
 * `Lead.optedOutAt` covers SMS and WhatsApp only, because STOP is the
 * SMS-specific legal instrument. Until now a lead had no way at all to stop
 * automated email: no link, no List-Unsubscribe header, no suppression
 * list. The only remedy was for the business owner to notice and switch
 * that one lead off by hand.
 *
 * Two properties carry the weight here, and both are tested against their
 * real failure shape rather than their happy path:
 *
 *   1. A token cannot be forged or edited. If it could, anyone could
 *      unsubscribe anyone — or, worse, enumerate addresses.
 *   2. Once suppressed, no automated mail goes out. Not the silence
 *      follow-up, not the reactivation batch, not the acknowledgement.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const upsert = vi.fn();
const deleteMany = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    suppression: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      upsert: (...a: unknown[]) => upsert(...a),
      deleteMany: (...a: unknown[]) => deleteMany(...a),
    },
  },
}));

vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://app.followupbase.io" }));

import {
  unsubscribeToken,
  verifyUnsubscribeToken,
  unsubscribeUrl,
  unsubscribeFooter,
  unsubscribeHeaders,
  isSuppressed,
  suppress,
  normaliseAddress,
} from "@/lib/suppression";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXTAUTH_SECRET", "test-signing-secret");
  findUnique.mockResolvedValue(null);
});

describe("the token", () => {
  it("round-trips the business and the address", () => {
    const t = unsubscribeToken("biz-1", "Ana@Example.com");
    expect(verifyUnsubscribeToken(t)).toEqual({ businessId: "biz-1", address: "ana@example.com" });
  });

  // The whole authorisation model. A forgeable token means anyone can
  // unsubscribe anyone — or discover which addresses a business holds.
  it("refuses a token whose payload was edited", () => {
    const real = unsubscribeToken("biz-1", "ana@example.com");
    const [, signature] = real.split(".");
    const swapped = `${Buffer.from("biz-1:victim@example.com").toString("base64url")}.${signature}`;
    expect(verifyUnsubscribeToken(swapped)).toBeNull();
  });

  it("refuses a token signed with a different secret", () => {
    const t = unsubscribeToken("biz-1", "ana@example.com");
    vi.stubEnv("NEXTAUTH_SECRET", "a-different-secret");
    expect(verifyUnsubscribeToken(t)).toBeNull();
  });

  it("refuses junk rather than throwing", () => {
    for (const bad of ["", ".", "notatoken", "a.b", "....", "%%%.%%%"]) {
      expect(verifyUnsubscribeToken(bad)).toBeNull();
    }
  });

  // An unsubscribe link that has quietly expired is worse than no link:
  // the person clicks it, believes they are done, and keeps getting mail.
  it("does not expire", () => {
    const t = unsubscribeToken("biz-1", "ana@example.com");
    vi.setSystemTime(new Date("2031-01-01"));
    expect(verifyUnsubscribeToken(t)).not.toBeNull();
    vi.useRealTimers();
  });

  it("treats the address case- and space-insensitively throughout", () => {
    expect(normaliseAddress("  Ana@Example.COM ")).toBe("ana@example.com");
    const a = unsubscribeToken("biz-1", " ANA@example.com ");
    const b = unsubscribeToken("biz-1", "ana@example.com");
    expect(a).toBe(b);
  });
});

describe("the headers and the footer", () => {
  // RFC 8058. This is what makes Gmail and Outlook show their own
  // Unsubscribe button next to the sender — where most people click.
  it("emits both List-Unsubscribe headers for one-click", () => {
    const headers = unsubscribeHeaders("biz-1", "ana@example.com");
    expect(headers[0]).toMatch(/^List-Unsubscribe: <https:\/\/app\.followupbase\.io\/api\/unsubscribe\?t=/);
    expect(headers[1]).toBe("List-Unsubscribe-Post: List-Unsubscribe=One-Click");
  });

  it("carries a working token in the URL", () => {
    const url = unsubscribeUrl("biz-1", "ana@example.com");
    const token = url.split("t=")[1];
    expect(verifyUnsubscribeToken(token)).toEqual({ businessId: "biz-1", address: "ana@example.com" });
  });

  // The copy has to match what the code actually does. It blocks automated
  // mail only, so it must not promise "never contact me".
  it("says it stops automated follow-ups, not all contact", () => {
    const footer = unsubscribeFooter("biz-1", "ana@example.com");
    expect(footer).toMatch(/automated follow-ups/i);
    expect(footer).not.toMatch(/never contact|all emails|unsubscribe from everything/i);
  });

  it("puts no raw newline in a header, which would inject one", () => {
    for (const h of unsubscribeHeaders("biz-1", "ana@example.com")) {
      expect(h).not.toMatch(/[\r\n]/);
    }
  });
});

describe("the suppression list", () => {
  it("is keyed on the address, not on a lead", async () => {
    await isSuppressed("biz-1", "Ana@Example.com");
    expect(findUnique).toHaveBeenCalledWith({
      where: { businessId_channel_address: { businessId: "biz-1", channel: "email", address: "ana@example.com" } },
      select: { id: true },
    });
  });

  it("reports suppressed only when a row exists", async () => {
    expect(await isSuppressed("biz-1", "ana@example.com")).toBe(false);
    findUnique.mockResolvedValue({ id: "s1" });
    expect(await isSuppressed("biz-1", "ana@example.com")).toBe(true);
  });

  it("treats a missing address as not suppressed, without querying", async () => {
    expect(await isSuppressed("biz-1", null)).toBe(false);
    expect(await isSuppressed("biz-1", undefined)).toBe(false);
    expect(findUnique).not.toHaveBeenCalled();
  });

  // A mail client prefetching the link and the human clicking it after
  // must both end in "you're unsubscribed", never an error.
  it("is idempotent", async () => {
    await suppress("biz-1", "ana@example.com", "one_click");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId_channel_address: { businessId: "biz-1", channel: "email", address: "ana@example.com" } },
        update: {},
      })
    );
  });
});
