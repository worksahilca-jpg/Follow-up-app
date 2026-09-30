/**
 * Bug b001: one broken Gmail connection stopped all of a business's inboxes.
 *
 * A business can have more than one connected Gmail (each admin can connect
 * their own). The cron treated the business as one connection: when the
 * inbox it read came back `invalid_grant`, the failure was written with an
 * update scoped to the business, which parked EVERY connected Gmail it had
 * at `needs_reconnect` and dropped their tokens. The healthy inbox stopped
 * being read along with the dead one, and the bell/email named whichever
 * row an unordered read happened to return.
 *
 * Driven through the real cron body against a stateful fake of several
 * Integration rows. The fake's updateMany honours `where.id` the way Prisma
 * does (absent means every matching row), so an unscoped write parks both.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type Row = {
  id: string;
  status: string;
  lastSyncedAt: Date | null;
  deepSyncedAt: Date | null;
  connectedAt: Date | null;
  lastSyncError: string | null;
  accountEmail: string | null;
  loginEmail: string;
  accessToken: string | null;
  refreshToken: string | null;
  watchExpiration: Date | null;
  watchHistoryId: string | null;
};
type Note = { userId: string; leadId: string | null; message: string; createdAt: Date };
type Where = { id?: string; status?: string };

const state = vi.hoisted(() => ({ rows: [] as Row[], notes: [] as Note[] }));

const matches = (r: Row, where: Where) => (!where.status || r.status === where.status) && (!where.id || r.id === where.id);
const plain = (r: Row) => ({
  id: r.id,
  lastSyncedAt: r.lastSyncedAt,
  deepSyncedAt: r.deepSyncedAt,
  connectedAt: r.connectedAt,
  lastSyncError: r.lastSyncError,
  accountEmail: r.accountEmail,
  user: { businessId: "biz1", email: r.loginEmail, business: { subscriptionStatus: "active", tier: "plus" } },
});

const { prismaMock, fetchSalesConversations, sendAlertEmail } = vi.hoisted(() => ({
  fetchSalesConversations: vi.fn(),
  sendAlertEmail: vi.fn<(email: { to: string; subject: string; text: string; html: string; idempotencyKey?: string }) => Promise<{ sent: boolean }>>(
    async () => ({ sent: true })
  ),
  prismaMock: {
    integration: {
      findMany: vi.fn(async ({ where }: { where: Where }) => state.rows.filter((r) => matches(r, where)).map(plain)),
      findFirst: vi.fn(async ({ where }: { where: Where }) => {
        const r = state.rows.find((row) => matches(row, where));
        return r ? plain(r) : null;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Where; data: Partial<Row> }) => {
        const hit = state.rows.filter((r) => matches(r, where));
        for (const r of hit) Object.assign(r, data);
        return { count: hit.length };
      }),
    },
    user: {
      findMany: vi.fn(async () => [
        { id: "owner", email: "sam@samsplumbing.ca" },
        { id: "partner", email: "jo@samsplumbing.ca" },
      ]),
    },
    notification: {
      create: vi.fn(async ({ data }: { data: Omit<Note, "createdAt"> }) => {
        state.notes.push({ ...data, createdAt: new Date() });
        return {};
      }),
      count: vi.fn(async () => 0),
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
vi.mock("@/lib/alertEmail", () => ({ sendAlertEmail }));
vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://www.followupbase.io" }));

import { syncGmailForAllBusinesses } from "@/lib/gmailSync";

const T0 = new Date("2026-09-25T09:00:00Z");
const MIN = 60_000;
const HOUR = 60 * MIN;

function inbox(id: string, accountEmail: string, loginEmail: string): Row {
  return {
    id,
    status: "connected",
    lastSyncedAt: new Date(T0.getTime() - 10 * MIN),
    deepSyncedAt: new Date(T0.getTime() - HOUR),
    // Two days in: well clear of the day-6 warning, so only b001 is in play.
    connectedAt: new Date(T0.getTime() - 2 * 24 * HOUR),
    lastSyncError: null,
    accountEmail,
    loginEmail,
    accessToken: `access-${id}`,
    refreshToken: `refresh-${id}`,
    watchExpiration: new Date(T0.getTime() + 3 * 24 * HOUR),
    watchHistoryId: `h-${id}`,
  };
}
const row = (id: string) => state.rows.find((r) => r.id === id)!;
const lostAccess = () => state.notes.filter((n) => n.message.includes("lost access to"));
/** Which inbox each fetch was asked to read. */
const inboxesRead = () => fetchSalesConversations.mock.calls.map(([, opts]) => (opts as { integrationId?: string }).integrationId);

/** `dead` answers invalid_grant; every other inbox syncs. */
function tokenDiedOn(dead: string, error = "invalid_grant") {
  fetchSalesConversations.mockImplementation(async (_businessId: string, opts: { integrationId?: string }) => {
    if (opts.integrationId === dead) throw new Error(error);
    return [];
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  vi.spyOn(console, "error").mockImplementation(() => {});
  state.notes = [];
  state.rows = [
    inbox("gmail-info", "info@samsplumbing.ca", "sam@samsplumbing.ca"),
    inbox("gmail-jo", "jo.bookings@gmail.com", "jo@samsplumbing.ca"),
  ];
});

afterEach(() => {
  vi.useRealTimers();
});

describe("two Gmail inboxes, one of them loses access (b001)", () => {
  // Both orders: which inbox the cron reaches first must not matter.
  for (const [dead, healthy] of [
    ["gmail-info", "gmail-jo"],
    ["gmail-jo", "gmail-info"],
  ] as const) {
    it(`parks only the broken inbox and keeps syncing the other (${dead} dies)`, async () => {
      tokenDiedOn(dead);
      const result = await syncGmailForAllBusinesses();

      // Both inboxes were read, each on its own.
      expect(inboxesRead().sort()).toEqual(["gmail-info", "gmail-jo"]);
      expect(result).toMatchObject({ businesses: 1, synced: 1, failed: 1 });

      // The broken one is parked, its dead tokens dropped.
      expect(row(dead)).toMatchObject({ status: "needs_reconnect", accessToken: null, refreshToken: null, watchExpiration: null });
      expect(row(dead).lastSyncError).toContain("invalid_grant");

      // The healthy one is untouched by the failure and stamped by its own sync.
      expect(row(healthy)).toMatchObject({
        status: "connected",
        accessToken: `access-${healthy}`,
        refreshToken: `refresh-${healthy}`,
        lastSyncError: null,
      });
      expect(row(healthy).lastSyncedAt).toEqual(T0);
    });
  }

  it("names only the broken inbox in the bell and the email", async () => {
    tokenDiedOn("gmail-jo");
    await syncGmailForAllBusinesses();

    expect(lostAccess().map((n) => n.userId).sort()).toEqual(["owner", "partner"]);
    for (const note of lostAccess()) {
      expect(note.message).toContain("jo.bookings@gmail.com");
      expect(note.message).not.toContain("info@samsplumbing.ca");
    }
    expect(sendAlertEmail).toHaveBeenCalledTimes(2);
    for (const [email] of sendAlertEmail.mock.calls) {
      expect(email.text).toContain("jo.bookings@gmail.com");
      expect(email.text).not.toContain("info@samsplumbing.ca");
      // Keyed on the broken inbox's own connection.
      expect(email.idempotencyKey).toContain(String(row("gmail-jo").connectedAt!.getTime()));
    }
  });

  it("keeps syncing the healthy inbox on the ticks after, and says nothing more", async () => {
    tokenDiedOn("gmail-jo");
    await syncGmailForAllBusinesses();

    for (let tick = 1; tick <= 3; tick++) {
      vi.setSystemTime(new Date(T0.getTime() + tick * 2 * MIN));
      fetchSalesConversations.mockClear();
      const result = await syncGmailForAllBusinesses();
      expect(inboxesRead()).toEqual(["gmail-info"]);
      expect(result).toMatchObject({ synced: 1, failed: 0 });
    }
    expect(row("gmail-info")).toMatchObject({ status: "connected", lastSyncError: null });
    expect(row("gmail-info").lastSyncedAt).toEqual(new Date(T0.getTime() + 6 * MIN));
    expect(lostAccess()).toHaveLength(2);
    expect(sendAlertEmail).toHaveBeenCalledTimes(2);
  });

  it("records any other failure on the failing inbox only", async () => {
    tokenDiedOn("gmail-jo", "Backend Error");
    await syncGmailForAllBusinesses();
    expect(row("gmail-jo")).toMatchObject({ status: "connected", refreshToken: "refresh-gmail-jo" });
    expect(row("gmail-jo").lastSyncError).toContain("Backend Error");
    expect(row("gmail-info").lastSyncError).toBeNull();
  });

  it("reads each inbox's snapshot without a token column", async () => {
    tokenDiedOn("gmail-jo");
    await syncGmailForAllBusinesses();
    const snapshotReads = prismaMock.integration.findFirst.mock.calls.map(([args]) => args as { where: Where; select?: unknown });
    expect(snapshotReads.length).toBeGreaterThan(0);
    for (const read of snapshotReads) {
      expect(read.where.id).toBe("gmail-jo");
      expect(JSON.stringify(read.select ?? "ALL")).not.toMatch(/ALL|Token/);
    }
  });
});

// Written against what a one-inbox business saw before the fix, and passes
// on that code too: the one inbox is "the business's inbox" either way.
describe("a business with one Gmail inbox (regression)", () => {
  beforeEach(() => {
    state.rows = [inbox("gmail-info", "info@samsplumbing.ca", "sam@samsplumbing.ca")];
  });

  it("parks it and tells every admin once, exactly as before", async () => {
    fetchSalesConversations.mockRejectedValue(new Error("invalid_grant"));
    const result = await syncGmailForAllBusinesses();

    expect(result).toEqual({ businesses: 1, synced: 0, newLeads: 0, failed: 1 });
    expect(row("gmail-info")).toMatchObject({ status: "needs_reconnect", accessToken: null, refreshToken: null });
    expect(lostAccess()).toHaveLength(2);
    expect(lostAccess()[0].message).toContain("info@samsplumbing.ca");
    expect(sendAlertEmail).toHaveBeenCalledTimes(2);

    // Parked: the next tick has nothing to read and says nothing.
    fetchSalesConversations.mockClear();
    const next = await syncGmailForAllBusinesses();
    expect(next).toEqual({ businesses: 0, synced: 0, newLeads: 0, failed: 0 });
    expect(fetchSalesConversations).not.toHaveBeenCalled();
    expect(lostAccess()).toHaveLength(2);
  });

  it("syncs a healthy inbox with the same incremental window as before", async () => {
    fetchSalesConversations.mockResolvedValue([]);
    const result = await syncGmailForAllBusinesses();
    expect(result).toEqual({ businesses: 1, synced: 1, newLeads: 0, failed: 0 });
    expect(fetchSalesConversations).toHaveBeenCalledTimes(1);
    const [, opts] = fetchSalesConversations.mock.calls[0] as [string, { since?: Date }];
    // lastSyncedAt (T0 - 10 min) minus the 15-minute overlap.
    expect(opts.since).toEqual(new Date(T0.getTime() - 25 * MIN));
    expect(row("gmail-info")).toMatchObject({ status: "connected", lastSyncError: null, lastSyncedAt: T0 });
  });
});
