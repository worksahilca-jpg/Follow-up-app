/**
 * Joining a team needs the invite link (security audit H-2, 2026-09-26),
 * so the two ways an admin hands it out must carry it: the invite email,
 * and the pending-invite list in Team settings — for admins only.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock, sendEmail } = vi.hoisted(() => ({
  sendEmail: vi.fn(async () => ({ success: true })),
  prismaMock: {
    user: { findUnique: vi.fn(), findMany: vi.fn(async () => []) },
    invite: { upsert: vi.fn(), findMany: vi.fn() },
    business: { findUnique: vi.fn(async () => ({ name: "Acme Plumbing" })) },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/integrations/gmail", () => ({ sendEmail }));
vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://followupbase.io" }));

import { inviteMember, getTeamData } from "@/lib/team";
import { inviteLink } from "@/lib/inviteToken";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXTAUTH_SECRET", "test-nextauth-secret");
});

describe("the invite email", () => {
  it("carries the invite's own link, not just a sign-in page", async () => {
    prismaMock.user.findUnique.mockImplementation(async (args: { where: { id?: string; email?: string } }) =>
      args.where.id === "admin1" ? { role: "ADMIN", businessId: "biz1" } : null
    );
    prismaMock.invite.upsert.mockResolvedValue({ id: "inv1", email: "teammate@example.com" });

    const result = await inviteMember("biz1", "admin1", "Teammate@Example.com", "SALES");

    expect(result).toEqual({ success: true, emailSent: true });
    const body = (sendEmail.mock.calls[0] as unknown as [string, { body: string }])[1].body;
    expect(body).toContain(inviteLink("inv1", "teammate@example.com"));
    expect(body).not.toMatch(/added to the team automatically/);
  });
});

describe("the pending-invite list", () => {
  const invites = [{ id: "inv1", email: "teammate@example.com", role: "SALES", createdAt: new Date() }];

  it("gives admins each invite's link", async () => {
    prismaMock.invite.findMany.mockResolvedValue(invites);
    prismaMock.user.findUnique.mockResolvedValue({ role: "ADMIN", businessId: "biz1" });
    const data = await getTeamData("biz1", "admin1");
    expect(data?.invites[0].link).toBe(inviteLink("inv1", "teammate@example.com"));
  });

  it("gives sales members no links", async () => {
    prismaMock.invite.findMany.mockResolvedValue(invites);
    prismaMock.user.findUnique.mockResolvedValue({ role: "SALES", businessId: "biz1" });
    const data = await getTeamData("biz1", "rep1");
    expect(data?.invites[0]).not.toHaveProperty("link");
  });
});
