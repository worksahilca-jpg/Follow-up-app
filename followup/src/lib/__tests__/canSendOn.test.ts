/**
 * canSendOn — "can this business send on THIS channel?" (src/lib/sendChannels.ts).
 *
 * Daily-path bug hunt 2026-09-25, F5. hasAnySendChannel asks whether
 * anything at all is connected, so a business whose Gmail had died but
 * whose Instagram token was still stored passed it, and every email lead
 * was drafted and held for a message sendEmail could never send. These pin
 * the per-channel answer the automation and workflow loops now ask before
 * drafting — and that each answer matches what the provider wrapper itself
 * requires, so the check never refuses a send the wire would have made.
 *
 * The fake below EVALUATES the where clause against a stored business row,
 * rather than asserting its shape, so these tests say what canSendOn
 * answers, not how it phrases the query.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;

const { state, businessFindFirst, integrationFindFirst } = vi.hoisted(() => {
  const state = { business: {} as Row, inbox: null as { id: string } | null };
  // Just enough of Prisma's filter language for the queries under test:
  // equality, `{ not: null }` and `OR`.
  const matches = (row: Row, where: Row): boolean =>
    Object.entries(where).every(([key, want]) => {
      if (key === "OR") return (want as Row[]).some((w) => matches(row, w));
      if (want && typeof want === "object" && "not" in (want as Row)) {
        return row[key] != null && row[key] !== (want as Row).not;
      }
      return row[key] === want;
    });
  return {
    state,
    businessFindFirst: vi.fn(async ({ where }: { where: Row; select: Row }) =>
      matches(state.business, where) ? { id: state.business.id } : null
    ),
    integrationFindFirst: vi.fn(async () => state.inbox),
  };
});
vi.mock("@/lib/db", () => ({
  prisma: { business: { findFirst: businessFindFirst }, integration: { findFirst: integrationFindFirst } },
}));

import { canSendOn } from "@/lib/sendChannels";

const nothing: Row = {
  id: "biz1",
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

beforeEach(() => {
  vi.clearAllMocks();
  state.business = { ...nothing };
  state.inbox = null;
});

describe("canSendOn — email", () => {
  it("is false once the inbox is gone, even with Instagram still connected (the production case)", async () => {
    state.business = { ...nothing, instagramUserId: "ig", instagramAccessToken: "tok" };
    expect(await canSendOn("biz1", "email")).toBe(false);
    // …while the business as a whole still "can send", which is exactly
    // why hasAnySendChannel alone let these leads through.
    expect(await canSendOn("biz1", "instagram")).toBe(true);
  });

  it("asks only for a CONNECTED Gmail or Outlook on this business", async () => {
    await canSendOn("biz1", "email");
    expect(integrationFindFirst).toHaveBeenCalledWith({
      where: { status: "connected", provider: { in: ["gmail", "outlook"] }, user: { businessId: "biz1" } },
      select: { id: true },
    });
  });

  it("is true the moment an inbox is connected again", async () => {
    state.inbox = { id: "int1" };
    expect(await canSendOn("biz1", "email")).toBe(true);
  });
});

describe("canSendOn — the business's own credentials", () => {
  it.each([
    // sendInstagramMessage needs only the token (no user id → /me/messages).
    ["instagram", { instagramAccessToken: "tok" }, true],
    ["instagram", { instagramUserId: "ig" }, false],
    // facebook.ts pageToken(): the page id AND its token.
    ["messenger", { facebookPageId: "pg", facebookPageAccessToken: "tok" }, true],
    ["messenger", { facebookPageAccessToken: "tok" }, false],
    ["messenger", { facebookPageId: "pg" }, false],
    // sendSms: SID, token and a number to send from.
    ["text", { twilioAccountSid: "AC", twilioAuthToken: "tok", twilioPhoneNumber: "+15550001111" }, true],
    ["text", { twilioAccountSid: "AC", twilioAuthToken: "tok" }, false],
    ["text", { twilioAccountSid: "AC", twilioAuthToken: "tok", whatsappPhoneNumber: "+15550001111" }, false],
    // WhatsApp: the Cloud API pair, or the older Twilio WhatsApp sender.
    ["whatsapp", { whatsappPhoneNumberId: "pn", whatsappAccessToken: "tok" }, true],
    ["whatsapp", { twilioAccountSid: "AC", twilioAuthToken: "tok", whatsappPhoneNumber: "+15550001111" }, true],
    ["whatsapp", { whatsappPhoneNumberId: "pn" }, false],
    ["whatsapp", { twilioAccountSid: "AC", twilioAuthToken: "tok", twilioPhoneNumber: "+15550001111" }, false],
  ] as const)("%s with %o → %s", async (channel, fields, expected) => {
    state.business = { ...nothing, ...fields };
    expect(await canSendOn("biz1", channel)).toBe(expected);
  });

  it("is false for every channel on a business with nothing stored", async () => {
    for (const channel of ["email", "instagram", "messenger", "text", "whatsapp"] as const) {
      expect(await canSendOn("biz1", channel)).toBe(false);
    }
  });

  it("never answers from another business's credentials", async () => {
    state.business = { ...nothing, id: "biz-other", instagramAccessToken: "tok" };
    expect(await canSendOn("biz1", "instagram")).toBe(false);
  });

  // db.ts decrypts whatever a query returns. A yes/no question must not
  // pull a token out of the database to answer it (audit F12).
  it("never selects a credential column to answer", async () => {
    state.business = { ...nothing, instagramAccessToken: "tok", facebookPageId: "pg", facebookPageAccessToken: "tok" };
    await canSendOn("biz1", "instagram");
    await canSendOn("biz1", "messenger");
    await canSendOn("biz1", "text");
    await canSendOn("biz1", "whatsapp");
    for (const [args] of businessFindFirst.mock.calls) expect(args.select).toEqual({ id: true });
  });
});
