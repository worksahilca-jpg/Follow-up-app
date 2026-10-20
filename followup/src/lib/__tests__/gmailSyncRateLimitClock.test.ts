/**
 * A sync that left threads unread for Gmail's per-minute limit (gmailRateLimit.test.ts) must not count as having
 * read them. On 2026-10-18 a full pass with 28 such threads was stamped done, so they waited a day for the next one,
 * and an incremental tick stamped the same way would move its window past them for good. The clock stays where it
 * was, and it is not an error: the "Gmail keeps failing" notice is for an inbox that can't be read at all.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type Row = { id: string; status: string; lastSyncedAt: Date | null; deepSyncedAt: Date | null; lastSyncError: string | null };
type Where = { id?: string; status?: string };
type OnResult = (info: { truncated: boolean; skippedForLimit?: number }) => void;

const state = vi.hoisted(() => ({ rows: [] as Row[], skippedForLimit: 0 }));
const matches = (r: Row, where: Where) => (!where.status || r.status === where.status) && (!where.id || r.id === where.id);

const { prismaMock, fetchSalesConversations } = vi.hoisted(() => ({
  fetchSalesConversations: vi.fn(async (_businessId: string, opts: { onResult?: OnResult }) => {
    opts.onResult?.({ truncated: false, skippedForLimit: state.skippedForLimit });
    return [];
  }),
  prismaMock: {
    integration: {
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
vi.mock("@/lib/integrations/gmail", () => ({ fetchSalesConversations, ensureGmailWatch: vi.fn(), isAuthRevoked: () => false }));
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

import { syncGmailForBusiness } from "@/lib/gmailSync";

const T0 = new Date("2026-10-19T02:56:40Z");
const MIN = 60_000;
const before = { lastSyncedAt: new Date(T0.getTime() - 2 * MIN), deepSyncedAt: new Date(T0.getTime() - 25 * 60 * MIN) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  state.skippedForLimit = 0;
  state.rows = [{ id: "gmail-info", status: "connected", ...before, lastSyncError: null }];
});

afterEach(() => {
  vi.useRealTimers();
});

describe("a sync that left threads unread for Gmail's limit", () => {
  it("a full pass is not stamped done, so the next tick runs it again", async () => {
    state.skippedForLimit = 28;
    const result = await syncGmailForBusiness("biz1", { integrationId: "gmail-info" });

    expect(state.rows[0]).toMatchObject({ ...before, lastSyncError: null });
    expect(result.truncated).toBe(true);
  });

  it("an incremental tick keeps its window, so the next one still covers those threads", async () => {
    state.skippedForLimit = 3;
    await syncGmailForBusiness("biz1", { integrationId: "gmail-info", since: new Date(T0.getTime() - 17 * MIN) });

    expect(state.rows[0].lastSyncedAt).toEqual(before.lastSyncedAt);
  });

  it("a sync that read everything is stamped as before", async () => {
    await syncGmailForBusiness("biz1", { integrationId: "gmail-info" });

    expect(state.rows[0]).toMatchObject({ lastSyncedAt: T0, deepSyncedAt: T0, lastSyncError: null });
  });
});
