/**
 * A dead Outlook connection must say so (launch check 2026-09-28). Before,
 * a refused token refresh made the sync return nothing and then stamp the
 * connection "checked just now" with no error, so a dead inbox looked
 * healthy forever while no new customer arrived.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { findFirst, update, updateMany, findAdmins, createNotification } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  findAdmins: vi.fn(),
  createNotification: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    integration: { findFirst, update, updateMany },
    user: { findMany: findAdmins },
    notification: { create: createNotification },
  },
}));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn() }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn() }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn() }));

import { fetchOutlookConversations, getOutlookStatus, OUTLOOK_RECONNECT_MESSAGE } from "@/lib/integrations/outlook";

const EXPIRED = {
  id: "int1",
  accessToken: "old",
  refreshToken: "dead-refresh",
  tokenExpiresAt: new Date(Date.now() - 60_000),
  accountEmail: "owner@outlook.com",
  deltaLink: null,
  user: { email: "owner@outlook.com" },
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  findFirst.mockReset();
  update.mockReset();
  updateMany.mockReset().mockResolvedValue({ count: 1 });
  findAdmins.mockReset().mockResolvedValue([{ id: "u1" }]);
  createNotification.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("MICROSOFT_CLIENT_ID", "abc");
  vi.stubEnv("MICROSOFT_CLIENT_SECRET", "shh");
  vi.stubEnv("MICROSOFT_REDIRECT_URI", "https://followupbase.io/api/integrations/outlook/callback");
});

describe("a refused Outlook token", () => {
  it("parks the connection as needing a reconnect and fails the sync with a plain reason", async () => {
    findFirst
      .mockResolvedValueOnce(EXPIRED) // the connected row, for the refresh
      .mockResolvedValueOnce({ lastSyncError: OUTLOOK_RECONNECT_MESSAGE }); // the row, read back for the reason
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_grant", error_description: "AADSTS70000" }), { status: 400 })
    );

    await expect(fetchOutlookConversations("biz1")).rejects.toThrow(OUTLOOK_RECONNECT_MESSAGE);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "int1", status: "connected" },
      data: { status: "needs_reconnect", lastSyncError: OUTLOOK_RECONNECT_MESSAGE, accessToken: null, refreshToken: null },
    });
    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(createNotification.mock.calls[0][0].data.message).toContain("Reconnect Outlook in Settings");
  });

  it("tells the admins only once, from the call that actually parked it", async () => {
    updateMany.mockResolvedValue({ count: 0 }); // another tick parked it first
    findFirst.mockResolvedValueOnce(EXPIRED).mockResolvedValueOnce({ lastSyncError: OUTLOOK_RECONNECT_MESSAGE });
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }));
    await expect(fetchOutlookConversations("biz1")).rejects.toThrow();
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("keeps a connection connected through an outage, and records it", async () => {
    findFirst.mockResolvedValueOnce(EXPIRED).mockResolvedValueOnce({ lastSyncError: "2026-09-28T01:00:00.000Z Outlook didn't answer. FollowUp will try again in a few minutes." });
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "temporarily_unavailable" }), { status: 503 }));

    await expect(fetchOutlookConversations("biz1")).rejects.toThrow(/^Outlook didn't answer/);
    expect(update).toHaveBeenCalledWith({
      where: { id: "int1" },
      data: { lastSyncError: "Outlook didn't answer. FollowUp will try again in a few minutes." },
    });
  });

  it("shows a parked connection as needing a reconnect, not as never connected", async () => {
    findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ accountEmail: "owner@outlook.com", user: { email: "owner@outlook.com" } });
    expect(await getOutlookStatus("biz1")).toEqual({ connected: false, needsReconnect: true, email: "owner@outlook.com" });
  });
});
