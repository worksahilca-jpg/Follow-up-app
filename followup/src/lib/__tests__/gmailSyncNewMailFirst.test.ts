/**
 * New mail is never kept waiting by the daily full read (2026-10-27). A full pass reads up to 150 threads, and
 * Google's limit cut one busy inbox's pass short at the same point on every tick from Oct 21. The pass ran instead
 * of the two-minute check and, cut short, left the clock where it was (gmailSyncRateLimitClock.test.ts), so for six
 * days that inbox took in no new email while Settings said Connected. Now every tick checks new mail first, and the
 * full pass only runs after a check Google let finish. Thread reads are spaced out too (pacer, below).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type Row = { id: string; status: string; lastSyncedAt: Date | null; deepSyncedAt: Date | null; connectedAt: Date | null; lastSyncError: string | null };
type Where = { id?: string; status?: string };
type OnResult = (info: { truncated: boolean; skippedForLimit?: number }) => void;

const state = vi.hoisted(() => ({ rows: [] as Row[], unreadOnTick: 0, unreadOnFullPass: 0 }));
const matches = (r: Row, where: Where) => (!where.status || r.status === where.status) && (!where.id || r.id === where.id);

const { prismaMock, fetchSalesConversations } = vi.hoisted(() => ({
  fetchSalesConversations: vi.fn(async (_businessId: string, opts: { since?: Date; onResult?: OnResult }) => {
    opts.onResult?.({ truncated: false, skippedForLimit: opts.since ? state.unreadOnTick : state.unreadOnFullPass });
    return [];
  }),
  prismaMock: {
    integration: {
      findMany: vi.fn(async () =>
        state.rows.map((r) => ({ ...r, user: { businessId: "biz1", business: { subscriptionStatus: "beta", tier: "pro" } } }))
      ),
      findFirst: vi.fn(async ({ where }: { where: Where }) => state.rows.find((r) => matches(r, where)) ?? null),
      updateMany: vi.fn(async ({ where, data }: { where: Where; data: Partial<Row> }) => {
        const hit = state.rows.filter((r) => matches(r, where));
        for (const r of hit) Object.assign(r, data);
        return { count: hit.length };
      }),
    },
    lead: { findMany: vi.fn(async () => []) },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/integrations/gmail", () => ({ fetchSalesConversations, ensureGmailWatch: vi.fn(async () => undefined), isAuthRevoked: () => false }));
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

import { syncGmailForAllBusinesses } from "@/lib/gmailSync";
import { pacer } from "@/lib/rateLimitRetry";

const T0 = new Date("2026-10-27T18:30:00Z");
const HOUR = 60 * 60_000;
// The inbox on Oct 27: its last full pass six days back, its clock stopped 87 hours back.
const stuck = { lastSyncedAt: new Date(T0.getTime() - 87 * HOUR), deepSyncedAt: new Date(T0.getTime() - 183 * HOUR) };

const passes = () => (fetchSalesConversations.mock.calls as unknown as [string, { since?: Date }][]).map(([, o]) => (o.since ? "tick" : "full"));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  state.unreadOnTick = 0;
  state.unreadOnFullPass = 0;
  state.rows = [{ id: "gmail-1", status: "connected", ...stuck, connectedAt: new Date(T0.getTime() - 11 * 24 * HOUR), lastSyncError: null }];
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the two-minute sync of an inbox whose full pass is due", () => {
  it("takes in new mail even when Google cuts the full pass short every time", async () => {
    state.unreadOnFullPass = 28;
    await syncGmailForAllBusinesses();

    expect(passes()).toEqual(["tick", "full"]);
    const [, tick] = fetchSalesConversations.mock.calls[0] as unknown as [string, { since: Date }];
    expect(tick.since.getTime()).toBe(stuck.lastSyncedAt.getTime() - 15 * 60_000);
    // The new mail counts as read; the full pass does not, so it runs again next time.
    expect(state.rows[0]).toMatchObject({ lastSyncedAt: T0, deepSyncedAt: stuck.deepSyncedAt, lastSyncError: null });
  });

  it("leaves the full pass for later when Google already slowed the new-mail check", async () => {
    state.unreadOnTick = 3;
    await syncGmailForAllBusinesses();

    expect(passes()).toEqual(["tick"]);
    expect(state.rows[0]).toMatchObject(stuck);
  });

  it("stamps both clocks when both reads finish", async () => {
    await syncGmailForAllBusinesses();

    expect(passes()).toEqual(["tick", "full"]);
    expect(state.rows[0]).toMatchObject({ lastSyncedAt: T0, deepSyncedAt: T0 });
  });

  it("only checks new mail when the full pass isn't due", async () => {
    state.rows[0].deepSyncedAt = new Date(T0.getTime() - 2 * HOUR);
    await syncGmailForAllBusinesses();

    expect(passes()).toEqual(["tick"]);
  });

  it("checks new mail first on a brand-new inbox too, then reads everything", async () => {
    Object.assign(state.rows[0], { lastSyncedAt: null, deepSyncedAt: null });
    await syncGmailForAllBusinesses();

    expect(passes()).toEqual(["tick", "full"]);
    expect(state.rows[0]).toMatchObject({ lastSyncedAt: T0, deepSyncedAt: T0 });
  });
});

describe("pacer (how far apart Gmail thread reads start)", () => {
  it("starts calls at least the gap apart however many run at once, and never waits for the first", async () => {
    const waits: number[] = [];
    const next = pacer(100, async (ms) => {
      waits.push(ms);
    });
    await Promise.all([next(), next(), next(), next()]);

    expect(waits).toEqual([100, 200, 300]);
  });

  it("doesn't wait once the gap has already passed", async () => {
    const waits: number[] = [];
    const next = pacer(100, async (ms) => {
      waits.push(ms);
    });
    await next();
    vi.setSystemTime(T0.getTime() + 250);
    await next();

    expect(waits).toEqual([]);
  });
});
