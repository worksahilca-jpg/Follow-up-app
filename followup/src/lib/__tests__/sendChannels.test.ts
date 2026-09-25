/**
 * "Nothing connected, no drafting" (src/lib/sendChannels.ts). The case
 * behind it: an owner disconnected Gmail on day two and the hourly
 * automation kept drafting and holding follow-ups for him for twelve days
 * — 97 OpenAI-backed holds that could never be sent.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { businessFindUnique, integrationFindFirst } = vi.hoisted(() => ({
  businessFindUnique: vi.fn(),
  integrationFindFirst: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: { business: { findUnique: businessFindUnique }, integration: { findFirst: integrationFindFirst } },
}));

import { hasAnySendChannel } from "@/lib/sendChannels";

type Row = Record<string, string | null>;

const nothing: Row = {
  instagramUserId: null,
  instagramAccessToken: null,
  facebookPageId: null,
  facebookPageAccessToken: null,
  whatsappPhoneNumberId: null,
  whatsappAccessToken: null,
  twilioAccountSid: null,
  twilioAuthToken: null,
  twilioPhoneNumber: null,
  whatsappPhoneNumber: null,
};

/**
 * The question is asked in the query's WHERE now (audit F12: no token is
 * selected, so none is decrypted), so the fake database has to answer it
 * the way Postgres would: `{ not: null }` is IS NOT NULL, sibling keys are
 * AND, `OR` is OR. Anything else is a filter this test doesn't know, and
 * fails loudly rather than matching by accident.
 */
function matches(where: Record<string, unknown>, row: Row): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === "id") return true; // one business per test
    if (key === "OR") return (cond as Record<string, unknown>[]).some((c) => matches(c, row));
    if (cond && typeof cond === "object" && "not" in cond && (cond as { not: unknown }).not === null) return row[key] != null;
    throw new Error(`unexpected filter on ${key}`);
  });
}

let row: Row = nothing;

beforeEach(() => {
  vi.clearAllMocks();
  row = nothing;
  businessFindUnique.mockImplementation(async (args: { where: Record<string, unknown> }) => (matches(args.where, row) ? { id: "biz1" } : null));
  integrationFindFirst.mockResolvedValue(null);
});

describe("hasAnySendChannel", () => {
  it("is false for a business with an inbox disconnected and nothing else", async () => {
    expect(await hasAnySendChannel("biz1")).toBe(false);
    // Only a CONNECTED Gmail/Outlook counts — "needs_reconnect" and
    // "disconnected" rows are exactly the case this exists for.
    expect(integrationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "connected", provider: { in: ["gmail", "outlook"] }, user: { businessId: "biz1" } } })
    );
  });

  it("is true the moment an inbox is connected again", async () => {
    integrationFindFirst.mockResolvedValueOnce({ id: "int1" });
    expect(await hasAnySendChannel("biz1")).toBe(true);
  });

  it.each([
    ["Instagram", { instagramUserId: "ig", instagramAccessToken: "tok" }],
    ["Facebook", { facebookPageId: "pg", facebookPageAccessToken: "tok" }],
    ["WhatsApp through Meta", { whatsappPhoneNumberId: "pn", whatsappAccessToken: "tok" }],
    ["Twilio", { twilioAccountSid: "AC", twilioAuthToken: "tok", twilioPhoneNumber: "+1" }],
  ])("is true with %s connected", async (_label, fields) => {
    row = { ...nothing, ...fields };
    expect(await hasAnySendChannel("biz1")).toBe(true);
  });

  it("is false for a half-connected channel (an id without its token)", async () => {
    row = { ...nothing, instagramUserId: "ig" };
    expect(await hasAnySendChannel("biz1")).toBe(false);
  });

  it("is false for a Twilio Account SID saved without its Auth Token", async () => {
    // The twilio/config route saves the two independently, which is why
    // the F12 fix tests the token's presence in the query instead of
    // trusting the SID the way the Facebook/WhatsApp GETs trust their ids.
    row = { ...nothing, twilioAccountSid: "AC", twilioPhoneNumber: "+1" };
    expect(await hasAnySendChannel("biz1")).toBe(false);
  });

  it("is false for Twilio credentials with no number to send from", async () => {
    row = { ...nothing, twilioAccountSid: "AC", twilioAuthToken: "tok" };
    expect(await hasAnySendChannel("biz1")).toBe(false);
  });
});

describe("hasAnySendChannel never reads a credential (audit 2026-09-25 F12)", () => {
  // src/lib/db.ts decrypts every token column that comes back in a row.
  // This ran twice per business per hour and on lead pages, decrypting
  // four real credentials each time to test them for null.
  const TOKEN_COLUMNS = ["instagramAccessToken", "facebookPageAccessToken", "whatsappAccessToken", "twilioAuthToken"];

  it("selects only the business id", async () => {
    row = { ...nothing, instagramUserId: "ig", instagramAccessToken: "tok" };
    await hasAnySendChannel("biz1");
    const args = businessFindUnique.mock.calls[0][0] as { select: Record<string, unknown>; include?: unknown };
    expect(args.select).toEqual({ id: true });
    expect(args.include).toBeUndefined();
    for (const column of TOKEN_COLUMNS) expect(args.select).not.toHaveProperty(column);
  });

  it("is still scoped to the one business it was asked about", async () => {
    await hasAnySendChannel("biz1");
    const args = businessFindUnique.mock.calls[0][0] as { where: { id: string } };
    expect(args.where.id).toBe("biz1");
  });
});
