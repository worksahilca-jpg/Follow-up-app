/**
 * Gmail's status is a yes/no question and must be answered without
 * decrypting the inbox's credentials (daily-path audit 2026-09-25 F12).
 *
 * getGmailStatus runs on every dashboard load, every email send, the setup
 * checklist and the booking-source check. It used to load the whole
 * Integration row, and src/lib/db.ts decrypts the refresh and access tokens
 * on every read, so a real Google credential was decrypted on each of those
 * to produce an email address and two timestamps.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { integrationFindFirst } = vi.hoisted(() => ({ integrationFindFirst: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { integration: { findFirst: integrationFindFirst } } }));

// gmail.ts's own imports, none of which a status read touches.
vi.mock("googleapis", () => ({ google: {} }));
vi.mock("@/lib/integrations/openai", () => ({ classifyAsProspect: vi.fn(), classifyWithSecondLook: vi.fn() }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn() }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn() }));
vi.mock("@/lib/engagement", () => ({ checkRapidEngagement: vi.fn() }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn() }));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead: vi.fn() }));

import { getGmailStatus } from "@/lib/integrations/gmail";

const TOKEN_COLUMNS = ["accessToken", "refreshToken"];

/** Every key anywhere in a query's arguments, so a token nested under a relation select is caught too. */
function keysDeep(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => [k, ...keysDeep(v)]);
}

function expectNoCredentialRead() {
  expect(integrationFindFirst).toHaveBeenCalled();
  for (const [args] of integrationFindFirst.mock.calls as [Record<string, unknown>][]) {
    // `include` returns every scalar column, tokens included.
    expect(args).not.toHaveProperty("include");
    expect(args).toHaveProperty("select");
    const selected = keysDeep(args.select);
    for (const column of TOKEN_COLUMNS) expect(selected).not.toContain(column);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getGmailStatus", () => {
  it("answers a connected inbox from plain columns only", async () => {
    const lastSyncedAt = new Date("2026-09-25T12:00:00Z");
    integrationFindFirst.mockResolvedValueOnce({
      accountEmail: "info@samsplumbing.ca",
      watchExpiration: new Date(Date.now() + 60 * 60_000),
      lastSyncedAt,
      user: { email: "sam.smith@gmail.com" },
    });

    const status = await getGmailStatus("biz1");

    expect(status).toEqual({
      connected: true,
      email: "info@samsplumbing.ca",
      pushActive: true,
      lastSyncedAt: lastSyncedAt.toISOString(),
    });
    expectNoCredentialRead();
    // Still scoped to this business's connected inbox.
    expect(integrationFindFirst.mock.calls[0][0].where).toEqual({ provider: "gmail", status: "connected", user: { businessId: "biz1" } });
  });

  it("answers a parked inbox (token died) from plain columns only", async () => {
    integrationFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ accountEmail: null, user: { email: "owner@example.com" } });

    const status = await getGmailStatus("biz1");

    expect(status).toEqual({ connected: false, needsReconnect: true, email: "owner@example.com" });
    expectNoCredentialRead();
    expect(integrationFindFirst.mock.calls[1][0].where).toEqual({ provider: "gmail", status: "needs_reconnect", user: { businessId: "biz1" } });
  });

  it("says never-connected when there is no row at all", async () => {
    integrationFindFirst.mockResolvedValue(null);
    expect(await getGmailStatus("biz1")).toEqual({ connected: false });
    expectNoCredentialRead();
  });

  it("reports push as inactive once the watch has lapsed", async () => {
    integrationFindFirst.mockResolvedValueOnce({
      accountEmail: "info@samsplumbing.ca",
      watchExpiration: new Date(Date.now() - 60_000),
      lastSyncedAt: null,
      user: { email: "sam.smith@gmail.com" },
    });
    const status = await getGmailStatus("biz1");
    expect(status.pushActive).toBe(false);
    expect(status.lastSyncedAt).toBeUndefined();
  });
});
