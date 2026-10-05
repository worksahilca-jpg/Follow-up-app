/**
 * Security review L6 (2026-10-05): a teammate who leaves used to keep their Gmail and Calendar
 * tokens stored and live at Google. Removal now revokes and clears them first.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { userFindUnique, integrationFindMany, integrationFindUnique, integrationUpdate, transaction, disconnectGmail } = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  integrationFindMany: vi.fn(),
  integrationFindUnique: vi.fn(),
  integrationUpdate: vi.fn(async () => ({})),
  transaction: vi.fn(async () => []),
  disconnectGmail: vi.fn(async () => 1),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: userFindUnique, count: vi.fn(async () => 2), update: vi.fn() },
    lead: { updateMany: vi.fn() },
    integration: { findMany: integrationFindMany, findUnique: integrationFindUnique, update: integrationUpdate },
    $transaction: transaction,
  },
}));
vi.mock("@/lib/integrations/gmail", () => ({ disconnectGmail, sendEmail: vi.fn() }));
vi.mock("@/lib/inviteToken", () => ({ inviteLink: vi.fn() }));

import { removeMember } from "@/lib/team";

const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 200 }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  userFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
    where.id === "admin"
      ? { role: "ADMIN", businessId: "b1" }
      : { id: "leaver", businessId: "b1", role: "MEMBER", integrations: [{ status: "connected" }] }
  );
  integrationFindMany.mockResolvedValue([
    { id: "gm1", provider: "gmail" },
    { id: "cal1", provider: "google_calendar" },
  ]);
  integrationFindUnique.mockResolvedValue({ accessToken: "acc", refreshToken: "ref" });
});

describe("removing a teammate", () => {
  it("disconnects their Gmail inbox and revokes and clears their calendar", async () => {
    const res = await removeMember("leaver", "b1", "admin");
    expect(res.success).toBe(true);
    expect(integrationFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "leaver", status: "connected" } }));
    expect(disconnectGmail).toHaveBeenCalledWith("b1", "gm1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("oauth2.googleapis.com/revoke");
    expect(integrationUpdate).toHaveBeenCalledWith({
      where: { id: "cal1" },
      data: { status: "disconnected", accessToken: null, refreshToken: null },
    });
  });

  it("still removes them when a revoke fails", async () => {
    disconnectGmail.mockRejectedValueOnce(new Error("Google down"));
    const res = await removeMember("leaver", "b1", "admin");
    expect(res.success).toBe(true);
    expect(transaction).toHaveBeenCalled();
  });
});
