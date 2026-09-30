/**
 * "Sync now" and a push sync read ONE Gmail inbox, the business's oldest
 * connection (bug b015) — and used to stamp EVERY connected inbox as synced.
 *
 * On a business with two inboxes (each admin can connect their own), the
 * second inbox's own clock was moved by a sync that never read it:
 *  - its lastSyncError was wiped, so a streak of failures there never
 *    reached the "Gmail keeps failing" notice as long as the first inbox
 *    kept getting mail (every push cleared it again), and Settings showed
 *    it healthy;
 *  - its lastSyncedAt jumped forward, so when it recovered, the cron's
 *    incremental window (lastSyncedAt minus 15 minutes) started after mail
 *    that arrived there during the outage — those customers waited for the
 *    next day's deep pass, too old by then for the instant reply;
 *  - "Sync now" also stamped its deepSyncedAt, pushing that deep pass back
 *    another day.
 *
 * Driven through the real sync bodies against a stateful fake of the
 * Integration rows whose updateMany honours `where.id` the way Prisma does
 * (absent means every matching row).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type Row = {
  id: string;
  status: string;
  lastSyncedAt: Date | null;
  deepSyncedAt: Date | null;
  connectedAt: Date | null;
  lastSyncError: string | null;
  pushSyncStartedAt: Date | null;
};
type Where = { id?: string; status?: string };

const state = vi.hoisted(() => ({ rows: [] as Row[] }));
const matches = (r: Row, where: Where) => (!where.status || r.status === where.status) && (!where.id || r.id === where.id);

const { prismaMock, fetchSalesConversations } = vi.hoisted(() => ({
  fetchSalesConversations: vi.fn(async () => []),
  prismaMock: {
    integration: {
      // Rows are kept oldest connection first, which is GMAIL_INBOX_ORDER.
      findFirst: vi.fn(async ({ where }: { where: Where }) => state.rows.find((r) => matches(r, where)) ?? null),
      updateMany: vi.fn(async ({ where, data }: { where: Where; data: Partial<Row> }) => {
        const hit = state.rows.filter((r) => matches(r, where));
        for (const r of hit) Object.assign(r, data);
        return { count: hit.length };
      }),
    },
    business: { findUnique: vi.fn(async () => ({ subscriptionStatus: "active", tier: "plus" })) },
    lead: { findMany: vi.fn(async () => []) },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/integrations/gmail", () => ({
  fetchSalesConversations,
  ensureGmailWatch: vi.fn(async () => ({ active: true })),
  isAuthRevoked: () => false,
}));
vi.mock("@/lib/scoring", () => ({ scoreAndDraftForLead: vi.fn(async () => false) }));
vi.mock("@/lib/outcomes", () => ({ detectReplies: vi.fn(async () => 0) }));
vi.mock("@/lib/billing", () => ({ hasActiveAccess: () => true }));
vi.mock("@/lib/gmailSyncNotices", () => ({
  gmailAccessEndingSoon: () => false,
  notifyGmailAccessLost: vi.fn(),
  notifyIfGmailSyncKeepsFailing: vi.fn(),
  readGmailSyncSnapshot: vi.fn(async () => null),
  warnGmailAccessEndingSoon: vi.fn(),
}));

import { syncGmailForBusiness, syncGmailForBusinessFromPush } from "@/lib/gmailSync";

const T0 = new Date("2026-09-30T15:00:00Z");
const MIN = 60_000;
const HOUR = 60 * MIN;

const row = (id: string) => state.rows.find((r) => r.id === id)!;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  state.rows = [
    // The business's inbox: the oldest connection, healthy.
    {
      id: "gmail-info",
      status: "connected",
      lastSyncedAt: new Date(T0.getTime() - 2 * MIN),
      deepSyncedAt: new Date(T0.getTime() - HOUR),
      connectedAt: new Date(T0.getTime() - 20 * 24 * HOUR),
      lastSyncError: null,
      pushSyncStartedAt: null,
    },
    // A partner's inbox, failing for the last 40 minutes (Gmail 5xx).
    {
      id: "gmail-jo",
      status: "connected",
      lastSyncedAt: new Date(T0.getTime() - 40 * MIN),
      deepSyncedAt: new Date(T0.getTime() - 3 * HOUR),
      connectedAt: new Date(T0.getTime() - 5 * 24 * HOUR),
      lastSyncError: "2026-09-30T14:58:00.000Z Backend Error",
      pushSyncStartedAt: null,
    },
  ];
});

afterEach(() => {
  vi.useRealTimers();
});

function expectJoUntouched() {
  expect(row("gmail-jo").lastSyncError).toBe("2026-09-30T14:58:00.000Z Backend Error");
  expect(row("gmail-jo").lastSyncedAt).toEqual(new Date(T0.getTime() - 40 * MIN));
  expect(row("gmail-jo").deepSyncedAt).toEqual(new Date(T0.getTime() - 3 * HOUR));
}

describe("a sync that reads the business's inbox stamps that inbox only", () => {
  it('"Sync now" (a deep pass) leaves the other inbox\'s clock and error alone', async () => {
    await syncGmailForBusiness("biz1");

    expect(fetchSalesConversations).toHaveBeenCalledTimes(1);
    expect(row("gmail-info")).toMatchObject({ lastSyncedAt: T0, deepSyncedAt: T0, lastSyncError: null });
    expectJoUntouched();
  });

  it("a push sync leaves the other inbox's clock and error alone", async () => {
    const result = await syncGmailForBusinessFromPush("biz1");

    expect(result).not.toBeNull();
    const [, opts] = fetchSalesConversations.mock.calls[0] as unknown as [string, { since?: Date }];
    // The business's inbox's own window: its lastSyncedAt minus the overlap.
    expect(opts.since).toEqual(new Date(T0.getTime() - 17 * MIN));
    expect(row("gmail-info").lastSyncedAt).toEqual(T0);
    expectJoUntouched();
    // The push lock is released on every inbox it was taken on.
    expect(state.rows.every((r) => r.pushSyncStartedAt === null)).toBe(true);
  });

  it("the cron's own per-inbox sync is unchanged: it stamps the inbox it was given", async () => {
    await syncGmailForBusiness("biz1", { integrationId: "gmail-jo", since: new Date(T0.getTime() - 55 * MIN) });

    expect(row("gmail-jo")).toMatchObject({ lastSyncedAt: T0, lastSyncError: null });
    expect(row("gmail-info").lastSyncedAt).toEqual(new Date(T0.getTime() - 2 * MIN));
  });
});
