/**
 * The day a Gmail token dies, the owner hears about it in the bell — once
 * (daily-path audit 2026-09-25 F6).
 *
 * While the Google app is in Testing mode, every tester's refresh token
 * dies on day 7. The sync already parked the connection at
 * `needs_reconnect`; what it never did was tell anyone. On an account with
 * leads the only trace was one line at the bottom of Today. And a sync that
 * failed for any other reason (a 403 from an owner who unticked "Read")
 * wrote `lastSyncError` every ten minutes into a column nothing read.
 *
 * Driven through the real cron body against a small stateful fake of the
 * Integration row and the Notification table, because every property here
 * — once per death, silent on the next tick, loud again after a reconnect
 * and a second death, once per failure streak — is about state across
 * ticks, which a single mocked call cannot show.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type IntegrationRow = {
  status: string;
  lastSyncedAt: Date | null;
  deepSyncedAt: Date | null;
  connectedAt: Date | null;
  lastSyncError: string | null;
  accountEmail: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  watchExpiration: Date | null;
  watchHistoryId: string | null;
};
type Note = { userId: string; leadId: string | null; message: string; createdAt: Date };

const state = vi.hoisted(() => ({
  integration: null as unknown as IntegrationRow,
  notes: [] as Note[],
}));

const { prismaMock, fetchSalesConversations } = vi.hoisted(() => ({
  fetchSalesConversations: vi.fn(),
  prismaMock: {
    integration: {
      // The cron's own list: only rows still "connected".
      findMany: vi.fn(async ({ where }: { where: { status: string } }) =>
        state.integration.status === where.status
          ? [
              {
                lastSyncedAt: state.integration.lastSyncedAt,
                deepSyncedAt: state.integration.deepSyncedAt,
                user: { businessId: "biz1", business: { subscriptionStatus: "active", tier: "plus" } },
              },
            ]
          : []
      ),
      findFirst: vi.fn(async ({ where }: { where: { status?: string } }) => {
        if (where.status && where.status !== state.integration.status) return null;
        const i = state.integration;
        return {
          lastSyncError: i.lastSyncError,
          lastSyncedAt: i.lastSyncedAt,
          connectedAt: i.connectedAt,
          accountEmail: i.accountEmail,
          user: { email: "sam.smith@gmail.com" },
        };
      }),
      // The WHERE's status test is what makes the parking update a claim.
      updateMany: vi.fn(async ({ where, data }: { where: { status?: string }; data: Partial<IntegrationRow> }) => {
        if (where.status && where.status !== state.integration.status) return { count: 0 };
        Object.assign(state.integration, data);
        return { count: 1 };
      }),
    },
    user: { findMany: vi.fn(async () => [{ id: "owner" }, { id: "partner" }]) },
    notification: {
      create: vi.fn(async ({ data }: { data: Omit<Note, "createdAt"> }) => {
        state.notes.push({ ...data, createdAt: new Date() });
        return {};
      }),
      count: vi.fn(
        async ({ where }: { where: { userId: { in: string[] }; leadId: null; message: { contains: string }; createdAt: { gte: Date } } }) =>
          state.notes.filter(
            (n) =>
              where.userId.in.includes(n.userId) &&
              n.leadId === where.leadId &&
              n.message.includes(where.message.contains) &&
              n.createdAt >= where.createdAt.gte
          ).length
      ),
    },
    lead: { findMany: vi.fn(async () => []) },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/integrations/gmail", () => ({
  fetchSalesConversations,
  ensureGmailWatch: vi.fn(async () => ({ active: true })),
  isAuthRevoked: (err: unknown) => err instanceof Error && err.message.includes("invalid_grant"),
  gmailSelfAddress: (i: { accountEmail?: string | null; user: { email: string } }) => (i.accountEmail ?? i.user.email).toLowerCase(),
}));
vi.mock("@/lib/scoring", () => ({ scoreAndDraftForLead: vi.fn(async () => false) }));
vi.mock("@/lib/outcomes", () => ({ detectReplies: vi.fn(async () => 0) }));
vi.mock("@/lib/billing", () => ({ hasActiveAccess: () => true }));

import { syncGmailForAllBusinesses } from "@/lib/gmailSync";
import { SYNC_FAILING_MARKER, SYNC_FAILING_NOTICE_AFTER_MS } from "@/lib/gmailSyncNotices";

const T0 = new Date("2026-09-25T09:00:00Z");
const MIN = 60_000;
const HOUR = 60 * MIN;

function at(ms: number) {
  vi.setSystemTime(new Date(T0.getTime() + ms));
}
const tokenDied = () => fetchSalesConversations.mockRejectedValue(new Error("invalid_grant"));
const googleHiccup = () => fetchSalesConversations.mockRejectedValue(new Error("Backend Error"));
const syncWorks = () => fetchSalesConversations.mockResolvedValue([]);
const lostAccess = () => state.notes.filter((n) => n.message.includes("lost access to"));
const keepsFailing = () => state.notes.filter((n) => n.message.includes(SYNC_FAILING_MARKER));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.spyOn(console, "error").mockImplementation(() => {});
  at(0);
  state.notes = [];
  state.integration = {
    status: "connected",
    lastSyncedAt: new Date(T0.getTime() - 10 * MIN),
    deepSyncedAt: new Date(T0.getTime() - HOUR),
    connectedAt: new Date(T0.getTime() - 6 * 24 * HOUR),
    lastSyncError: null,
    accountEmail: "info@samsplumbing.ca",
    accessToken: "access",
    refreshToken: "refresh",
    watchExpiration: new Date(T0.getTime() + 3 * 24 * HOUR),
    watchHistoryId: "h1",
  };
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the day the token dies", () => {
  it("parks the connection and tells every admin, naming the inbox and the fix", async () => {
    tokenDied();
    await syncGmailForAllBusinesses();

    expect(state.integration.status).toBe("needs_reconnect");
    expect(lostAccess().map((n) => n.userId).sort()).toEqual(["owner", "partner"]);
    for (const note of lostAccess()) {
      expect(note.leadId).toBeNull();
      expect(note.message).toContain("info@samsplumbing.ca");
      expect(note.message).toContain("Reconnect Gmail in Settings");
      expect(note.message).toContain("every 7 days");
    }
  });

  it("says nothing more on the ticks after it", async () => {
    tokenDied();
    await syncGmailForAllBusinesses();
    for (let tick = 1; tick <= 6; tick++) {
      at(tick * 10 * MIN);
      await syncGmailForAllBusinesses();
    }
    expect(lostAccess()).toHaveLength(2); // one per admin, from the first tick only
  });

  it("says it once even when two ticks hit the dead token at the same moment", async () => {
    // Vercel can deliver the same cron twice. Both runs select the row
    // while it is still "connected"; only the one whose update actually
    // parks it may speak.
    tokenDied();
    await Promise.all([syncGmailForAllBusinesses(), syncGmailForAllBusinesses()]);
    expect(lostAccess()).toHaveLength(2);
  });

  it("says it again only after a reconnect and a second death", async () => {
    tokenDied();
    await syncGmailForAllBusinesses();
    expect(lostAccess()).toHaveLength(2);

    // What exchangeCodeForTokens does on reconnect.
    at(7 * 24 * HOUR);
    Object.assign(state.integration, { status: "connected", connectedAt: new Date(), accessToken: "a2", refreshToken: "r2" });
    syncWorks();
    await syncGmailForAllBusinesses();
    expect(lostAccess()).toHaveLength(2);

    at(14 * 24 * HOUR);
    tokenDied();
    await syncGmailForAllBusinesses();
    expect(lostAccess()).toHaveLength(4);
  });

  it("is never also reported as a sync that keeps failing", async () => {
    // Already failing for hours when the token finally dies: it is the
    // dead-token notice, and only that.
    state.integration.lastSyncError = "earlier failure";
    state.integration.lastSyncedAt = new Date(T0.getTime() - 5 * HOUR);
    tokenDied();
    await syncGmailForAllBusinesses();
    expect(lostAccess()).toHaveLength(2);
    expect(keepsFailing()).toHaveLength(0);
  });

  it("reads what it needs without a token column", async () => {
    tokenDied();
    await syncGmailForAllBusinesses();
    const selects = prismaMock.integration.findFirst.mock.calls.map(([args]) => JSON.stringify((args as { select?: unknown }).select ?? "ALL"));
    expect(selects.length).toBeGreaterThan(0);
    for (const s of selects) {
      expect(s).not.toBe('"ALL"');
      expect(s).not.toContain("Token");
    }
  });

  it("a notice that cannot be written never changes what the sync records", async () => {
    prismaMock.notification.create.mockRejectedValueOnce(new Error("db blip"));
    tokenDied();
    const result = await syncGmailForAllBusinesses();
    expect(result.failed).toBe(1);
    expect(state.integration.status).toBe("needs_reconnect");
    expect(state.integration.lastSyncError).toContain("invalid_grant");
  });
});

describe("a sync that keeps failing for another reason", () => {
  it("stays quiet for a blip, then tells every admin once past the threshold", async () => {
    googleHiccup();
    at(0);
    await syncGmailForAllBusinesses(); // first failure: not a streak yet
    expect(keepsFailing()).toHaveLength(0);

    // Every ten minutes, still failing, still under the threshold.
    for (let t = 10 * MIN; t < SYNC_FAILING_NOTICE_AFTER_MS - 10 * MIN; t += 10 * MIN) {
      at(t);
      await syncGmailForAllBusinesses();
    }
    expect(keepsFailing()).toHaveLength(0);

    at(SYNC_FAILING_NOTICE_AFTER_MS);
    await syncGmailForAllBusinesses();
    expect(keepsFailing().map((n) => n.userId).sort()).toEqual(["owner", "partner"]);
    expect(keepsFailing()[0].message).toContain("info@samsplumbing.ca");
    expect(keepsFailing()[0].message).toContain("reconnect Gmail in Settings");
    expect(keepsFailing()[0].leadId).toBeNull();
    // Never parked: this may still recover on its own.
    expect(state.integration.status).toBe("connected");
  });

  it("does not repeat for the rest of the same streak", async () => {
    googleHiccup();
    for (let t = 0; t <= SYNC_FAILING_NOTICE_AFTER_MS + 24 * HOUR; t += 10 * MIN) {
      at(t);
      await syncGmailForAllBusinesses();
    }
    expect(keepsFailing()).toHaveLength(2);
  });

  it("tells again about a new streak after the sync has recovered", async () => {
    googleHiccup();
    for (let t = 0; t <= SYNC_FAILING_NOTICE_AFTER_MS; t += 10 * MIN) {
      at(t);
      await syncGmailForAllBusinesses();
    }
    expect(keepsFailing()).toHaveLength(2);

    at(3 * HOUR);
    syncWorks();
    await syncGmailForAllBusinesses();
    expect(state.integration.lastSyncError).toBeNull();

    googleHiccup();
    const start = 3 * HOUR + 10 * MIN;
    for (let t = start; t <= start + SYNC_FAILING_NOTICE_AFTER_MS + 10 * MIN; t += 10 * MIN) {
      at(t);
      await syncGmailForAllBusinesses();
    }
    expect(keepsFailing()).toHaveLength(4);
  });

  it("does not treat one failure after a long quiet stretch as a streak", async () => {
    // E.g. billing lapsed for three days (the cron skips the business), and
    // the first tick back hits a blip. Nothing has failed twice in a row.
    state.integration.lastSyncedAt = new Date(T0.getTime() - 3 * 24 * HOUR);
    googleHiccup();
    await syncGmailForAllBusinesses();
    expect(keepsFailing()).toHaveLength(0);
  });

  it("measures from a reconnect, not from a sync before it", async () => {
    // A reconnect keeps the old lastSyncedAt and does not clear an old
    // error; the clock must restart at the reconnect anyway.
    state.integration.lastSyncedAt = new Date(T0.getTime() - 5 * 24 * HOUR);
    state.integration.connectedAt = new Date(T0.getTime() - 30 * MIN);
    state.integration.lastSyncError = "invalid_grant from before the reconnect";
    googleHiccup();
    await syncGmailForAllBusinesses();
    expect(keepsFailing()).toHaveLength(0);
  });
});
