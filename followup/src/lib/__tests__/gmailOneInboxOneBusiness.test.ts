/**
 * One Gmail inbox, one business (daily-path audit 2026-09-25 F8).
 *
 * Nothing stopped the same inbox being connected under two businesses. The
 * sync finds a thread's Conversation by its Gmail thread id, which is unique
 * across the whole database, so the second business found the first one's
 * conversations: its new mail was written into the FIRST business's lead,
 * and its own leads were drafted from a name with no messages. Push
 * notifications went to whichever of the two a findFirst happened to pick.
 *
 * The connect now refuses, before anything is stored, when another
 * business has that inbox live — and says so through the callback's
 * existing error redirect.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

type IntegrationRow = { provider: string; status: string; accountEmail: string | null; businessId: string | null };

const state = vi.hoisted(() => ({ rows: [] as IntegrationRow[], signedInBusinessId: "bizB" as string | null }));

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
vi.mock("@/lib/integrations/openai", () => ({ classifyAsProspect: vi.fn() }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn() }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn() }));
vi.mock("@/lib/engagement", () => ({ checkRapidEngagement: vi.fn() }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn() }));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead: vi.fn() }));

const ctx = { userId: "userB", businessId: "bizB", email: "owner@b.example", authTime: Date.now() };
vi.mock("@/lib/session", () => ({ getSessionContext: vi.fn(async () => ctx), requireAdmin: vi.fn(async () => true) }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));

import { exchangeCodeForTokens } from "@/lib/integrations/gmail";
import { GET as gmailCallback } from "@/app/api/integrations/gmail/callback/route";

/**
 * Answers the "is this inbox live on another business?" lookup the way
 * Postgres would, over the rows in `state`. Any filter this doesn't
 * recognise fails the test instead of silently matching.
 */
function integrationMatches(where: Record<string, unknown>, row: IntegrationRow): boolean {
  for (const [key, cond] of Object.entries(where)) {
    if (key === "provider" || key === "status") {
      if (row[key] !== cond) return false;
    } else if (key === "accountEmail") {
      const { equals, mode } = cond as { equals: string; mode?: string };
      if (mode !== "insensitive") throw new Error("inbox addresses must be compared case-insensitively");
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
  vi.stubEnv("GOOGLE_CLIENT_ID", "client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
  vi.stubEnv("GOOGLE_REDIRECT_URI", "https://followupbase.io/api/integrations/gmail/callback");
  vi.stubEnv("GMAIL_PUSH_TOPIC", "");
  state.rows = [];
  state.signedInBusinessId = "bizB";
  getToken.mockResolvedValue({ tokens: { access_token: "fresh-access", refresh_token: "fresh-refresh" } });
  getProfile.mockResolvedValue({ data: { emailAddress: "info@samsplumbing.ca" } });
  prismaMock.user.findUnique.mockImplementation(async () => ({ businessId: state.signedInBusinessId }));
  prismaMock.integration.findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
    state.rows.find((r) => integrationMatches(where, r)) ? { id: "taken" } : null
  );
  prismaMock.integration.findUnique.mockResolvedValue(null);
  prismaMock.integration.upsert.mockResolvedValue({});
});

describe("exchangeCodeForTokens", () => {
  it("refuses an inbox another business has connected, and stores nothing", async () => {
    // Different case on purpose: it is the same mailbox.
    state.rows = [{ provider: "gmail", status: "connected", accountEmail: "Info@SamsPlumbing.ca", businessId: "bizA" }];

    await expect(exchangeCodeForTokens("code", "userB")).rejects.toThrow("already connected to another FollowUp account");
    expect(prismaMock.integration.upsert).not.toHaveBeenCalled();
  });

  it("does not select the other connection's tokens to find out", async () => {
    state.rows = [{ provider: "gmail", status: "connected", accountEmail: "info@samsplumbing.ca", businessId: "bizA" }];
    await exchangeCodeForTokens("code", "userB").catch(() => null);
    const args = prismaMock.integration.findFirst.mock.calls[0][0] as { select: Record<string, unknown> };
    expect(args.select).toEqual({ id: true });
  });

  it("lets a second admin of the SAME business connect it", async () => {
    state.rows = [{ provider: "gmail", status: "connected", accountEmail: "info@samsplumbing.ca", businessId: "bizB" }];
    await expect(exchangeCodeForTokens("code", "userB")).resolves.toEqual({ email: "info@samsplumbing.ca" });
    expect(prismaMock.integration.upsert).toHaveBeenCalled();
  });

  it.each(["needs_reconnect", "disconnected"])("does not count another business's %s connection", async (status) => {
    state.rows = [{ provider: "gmail", status, accountEmail: "info@samsplumbing.ca", businessId: "bizA" }];
    await expect(exchangeCodeForTokens("code", "userB")).resolves.toEqual({ email: "info@samsplumbing.ca" });
  });

  it("does not count a connection whose user has left every business", async () => {
    state.rows = [{ provider: "gmail", status: "connected", accountEmail: "info@samsplumbing.ca", businessId: null }];
    await expect(exchangeCodeForTokens("code", "userB")).resolves.toEqual({ email: "info@samsplumbing.ca" });
  });

  it("connects a different inbox as before", async () => {
    state.rows = [{ provider: "gmail", status: "connected", accountEmail: "hello@othershop.ca", businessId: "bizA" }];
    await expect(exchangeCodeForTokens("code", "userB")).resolves.toEqual({ email: "info@samsplumbing.ca" });
    expect(prismaMock.integration.upsert).toHaveBeenCalled();
  });
});

describe("the Gmail OAuth callback", () => {
  const url = "https://followupbase.io/api/integrations/gmail/callback?code=abc&state=s1";
  const cookies = "gmail_oauth_state=s1";

  it("sends the owner back with the reason, through the existing error redirect", async () => {
    state.rows = [{ provider: "gmail", status: "connected", accountEmail: "info@samsplumbing.ca", businessId: "bizA" }];

    const res = await gmailCallback(new NextRequest(url, { headers: { cookie: cookies } }));

    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/settings");
    expect(location.searchParams.get("gmail")).toBe("error");
    expect(location.searchParams.get("message")).toContain("already connected to another FollowUp account");
    expect(prismaMock.integration.upsert).not.toHaveBeenCalled();
  });

  it("still connects when the inbox is free", async () => {
    const res = await gmailCallback(new NextRequest(url, { headers: { cookie: cookies } }));
    expect(new URL(res.headers.get("location")!).searchParams.get("gmail")).toBe("connected");
  });
});
