/**
 * One Outlook mailbox, one business — the Outlook half of daily-path audit
 * F8, which was fixed for Gmail only (gmailOneInboxOneBusiness.test.ts).
 *
 * Nothing stopped the same Outlook mailbox being connected under two
 * FollowUp businesses (an owner who signs up a second account with another
 * login, a former manager's own account). Both then read the same mailbox,
 * and Graph's conversation ids, which key Conversation.externalId across
 * the whole database, are the same for both: whichever business's sync
 * reached a new customer's email first took the lead, and the other skipped
 * it as "another business's conversation" (A-10). The owner's real account
 * silently lost a share of its leads to the other one, and both could send
 * from the mailbox.
 *
 * The connect now refuses, before anything is stored, when another business
 * has that mailbox live, with the sentence the Gmail connect uses.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type IntegrationRow = { provider: string; status: string; accountEmail: string | null; businessId: string | null };

const state = vi.hoisted(() => ({ rows: [] as IntegrationRow[] }));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn() },
    integration: { findFirst: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/integrations/openai", () => ({ classifyWithSecondLook: vi.fn() }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn() }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn() }));
vi.mock("@/lib/engagement", () => ({ checkRapidEngagement: vi.fn() }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn() }));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead: vi.fn() }));

import { exchangeOutlookAuthCode } from "@/lib/integrations/outlook";

/** The "is this mailbox live on another business?" lookup, answered the way Postgres would. */
function integrationMatches(where: Record<string, unknown>, row: IntegrationRow): boolean {
  for (const [key, cond] of Object.entries(where)) {
    if (key === "provider" || key === "status") {
      if (row[key] !== cond) return false;
    } else if (key === "accountEmail") {
      const { equals, mode } = cond as { equals: string; mode?: string };
      if (mode !== "insensitive") throw new Error("mailbox addresses must be compared case-insensitively");
      if (!row.accountEmail || row.accountEmail.toLowerCase() !== equals.toLowerCase()) return false;
    } else if (key === "user") {
      for (const [uKey, uCond] of Object.entries(cond as Record<string, unknown>)) {
        if (uKey === "businessId" && (uCond as { not?: unknown }).not === null) {
          if (row.businessId == null) return false;
        } else if (uKey === "NOT") {
          if (row.businessId === (uCond as { businessId: string }).businessId) return false;
        } else throw new Error(`unexpected user filter ${uKey}`);
      }
    } else throw new Error(`unexpected filter ${key}`);
  }
  return true;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("MICROSOFT_CLIENT_ID", "client");
  vi.stubEnv("MICROSOFT_CLIENT_SECRET", "secret");
  vi.stubEnv("MICROSOFT_REDIRECT_URI", "https://followupbase.io/api/integrations/outlook/callback");
  vi.spyOn(global, "fetch").mockImplementation(async (input) =>
    String(input).includes("/token")
      ? Response.json({ access_token: "fresh-access", refresh_token: "fresh-refresh", expires_in: 3600 })
      : Response.json({ mail: "info@samsplumbing.ca" })
  );
  state.rows = [];
  prismaMock.user.findUnique.mockResolvedValue({ businessId: "bizB" });
  prismaMock.integration.findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
    state.rows.find((r) => integrationMatches(where, r)) ? { id: "taken" } : null
  );
  prismaMock.integration.findUnique.mockResolvedValue(null);
  prismaMock.integration.upsert.mockResolvedValue({});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("exchangeOutlookAuthCode", () => {
  it("refuses a mailbox another business has connected, and stores nothing", async () => {
    state.rows = [{ provider: "outlook", status: "connected", accountEmail: "Info@SamsPlumbing.ca", businessId: "bizA" }];

    await expect(exchangeOutlookAuthCode("code", "userB")).rejects.toThrow("already connected to another FollowUp account");
    expect(prismaMock.integration.upsert).not.toHaveBeenCalled();
  });

  it("does not select the other connection's tokens to find out", async () => {
    state.rows = [{ provider: "outlook", status: "connected", accountEmail: "info@samsplumbing.ca", businessId: "bizA" }];
    await exchangeOutlookAuthCode("code", "userB").catch(() => null);
    const args = prismaMock.integration.findFirst.mock.calls[0][0] as { select: Record<string, unknown> };
    expect(args.select).toEqual({ id: true });
  });

  it("lets a second admin of the SAME business connect it", async () => {
    state.rows = [{ provider: "outlook", status: "connected", accountEmail: "info@samsplumbing.ca", businessId: "bizB" }];
    await expect(exchangeOutlookAuthCode("code", "userB")).resolves.toEqual({ email: "info@samsplumbing.ca" });
    expect(prismaMock.integration.upsert).toHaveBeenCalled();
  });

  it.each(["needs_reconnect", "disconnected"])("does not count another business's %s connection", async (status) => {
    state.rows = [{ provider: "outlook", status, accountEmail: "info@samsplumbing.ca", businessId: "bizA" }];
    await expect(exchangeOutlookAuthCode("code", "userB")).resolves.toEqual({ email: "info@samsplumbing.ca" });
  });

  it("does not count the same address connected as Gmail elsewhere", async () => {
    state.rows = [{ provider: "gmail", status: "connected", accountEmail: "info@samsplumbing.ca", businessId: "bizA" }];
    await expect(exchangeOutlookAuthCode("code", "userB")).resolves.toEqual({ email: "info@samsplumbing.ca" });
  });
});
