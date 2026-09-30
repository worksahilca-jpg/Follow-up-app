/**
 * Reconnecting a DIFFERENT inbox starts that inbox fresh.
 *
 * "Reconnect" writes onto the same Integration row (one per user and
 * provider), and kept the old mailbox's sync state on it. An owner who
 * first connected their personal Gmail and then reconnected the business's
 * info@ (the case gmailSelfAddress exists for) got:
 *  - no first pass over the new inbox: the cron runs a deep pass only when
 *    deepSyncedAt is a day old, and the old inbox's was fresh, so the
 *    customers already waiting in info@ appeared up to a day later, too
 *    late for the instant reply;
 *  - no push for the new inbox: ensureGmailWatch leaves a watch alone
 *    while watchExpiration is more than a day out, and that was the old
 *    mailbox's watch, good for up to a week.
 * Outlook kept the old mailbox's delta cursor (deltaLink), so the new
 * mailbox's 90-day first pass never ran at all: the sync only asked for
 * what changed after a point in someone else's mailbox.
 *
 * A reconnect of the SAME inbox (a dead token, the seven-day test grant)
 * keeps everything, as before.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { getToken, getProfile, prismaMock } = vi.hoisted(() => ({
  getToken: vi.fn(),
  getProfile: vi.fn(),
  prismaMock: {
    user: { findUnique: vi.fn() },
    integration: { findFirst: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: class {
        getToken = getToken;
        setCredentials() {}
      },
    },
    gmail: () => ({ users: { getProfile } }),
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/integrations/openai", () => ({ classifyAsProspect: vi.fn(), classifyWithSecondLook: vi.fn() }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn() }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn() }));
vi.mock("@/lib/engagement", () => ({ checkRapidEngagement: vi.fn() }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn() }));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead: vi.fn() }));

import { exchangeCodeForTokens } from "@/lib/integrations/gmail";
import { exchangeOutlookAuthCode } from "@/lib/integrations/outlook";

const NOW = Date.now();
const FRESH_SYNC_STATE = {
  lastSyncedAt: new Date(NOW - 2 * 60_000),
  deepSyncedAt: new Date(NOW - 60 * 60_000),
  watchExpiration: new Date(NOW + 5 * 24 * 3_600_000),
  watchHistoryId: "old-history",
};

type Update = Record<string, unknown>;
const updateWritten = (): Update => (prismaMock.integration.upsert.mock.calls[0][0] as { update: Update }).update;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findUnique.mockResolvedValue({ businessId: "biz1" });
  prismaMock.integration.findFirst.mockResolvedValue(null);
  prismaMock.integration.upsert.mockResolvedValue({});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Gmail reconnect", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "client");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
    vi.stubEnv("GOOGLE_REDIRECT_URI", "https://followupbase.io/api/integrations/gmail/callback");
    getToken.mockResolvedValue({ tokens: { access_token: "new-access", refresh_token: "new-refresh" } });
    getProfile.mockResolvedValue({ data: { emailAddress: "info@samsplumbing.ca" } });
  });

  it("to a different inbox clears the old inbox's sync clocks and push watch", async () => {
    prismaMock.integration.findUnique.mockResolvedValue({ accountEmail: "sam.smith@gmail.com", refreshToken: "old", ...FRESH_SYNC_STATE });

    await exchangeCodeForTokens("code", "user1");

    expect(updateWritten()).toMatchObject({
      accountEmail: "info@samsplumbing.ca",
      lastSyncedAt: null,
      deepSyncedAt: null,
      watchExpiration: null,
      watchHistoryId: null,
    });
  });

  it("to the same inbox (any case) keeps them", async () => {
    prismaMock.integration.findUnique.mockResolvedValue({ accountEmail: "Info@SamsPlumbing.ca", refreshToken: "old", ...FRESH_SYNC_STATE });

    await exchangeCodeForTokens("code", "user1");

    const update = updateWritten();
    for (const key of ["lastSyncedAt", "deepSyncedAt", "watchExpiration", "watchHistoryId"]) expect(update).not.toHaveProperty(key);
  });
});

describe("Outlook reconnect", () => {
  beforeEach(() => {
    vi.stubEnv("MICROSOFT_CLIENT_ID", "client");
    vi.stubEnv("MICROSOFT_CLIENT_SECRET", "secret");
    vi.stubEnv("MICROSOFT_REDIRECT_URI", "https://followupbase.io/api/integrations/outlook/callback");
    vi.spyOn(global, "fetch").mockImplementation(async (input) =>
      String(input).includes("/token")
        ? Response.json({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 3600 })
        : Response.json({ mail: "info@samsplumbing.ca" })
    );
  });

  it("to a different mailbox drops the old mailbox's delta cursor, so its first pass runs", async () => {
    prismaMock.integration.findUnique.mockResolvedValue({
      accountEmail: "sam.smith@outlook.com",
      refreshToken: "old",
      deltaLink: "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=old-mailbox",
      lastSyncedAt: FRESH_SYNC_STATE.lastSyncedAt,
    });

    await exchangeOutlookAuthCode("code", "user1");

    expect(updateWritten()).toMatchObject({ accountEmail: "info@samsplumbing.ca", deltaLink: null, lastSyncedAt: null });
  });

  it("to the same mailbox keeps its cursor", async () => {
    prismaMock.integration.findUnique.mockResolvedValue({
      accountEmail: "INFO@samsplumbing.ca",
      refreshToken: "old",
      deltaLink: "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=same",
    });

    await exchangeOutlookAuthCode("code", "user1");

    expect(updateWritten()).not.toHaveProperty("deltaLink");
  });
});
