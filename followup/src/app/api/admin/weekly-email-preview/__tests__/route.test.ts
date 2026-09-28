/**
 * /api/admin/weekly-email-preview — the founder's "send me this week's email
 * now". Platform admins only, only ever to their own address, and through
 * the same render and send the Monday cron uses (logo carried inside).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: { business: { findUnique: vi.fn() } } }));
vi.mock("@/lib/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/platformAdmin", () => ({ isPlatformAdmin: vi.fn() }));
vi.mock("@/lib/integrations/gmail", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://www.followupbase.io" }));
vi.mock("@/lib/weeklyDigest", () => ({
  gatherWeeklyDigest: vi.fn(async () => ({})),
  renderWeeklyDigest: vi.fn(() => ({ subject: "Your week", text: "t", html: "<p>h</p>", inlineImages: [{ cid: "fu-logo@followupbase.io" }] })),
}));

import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { sendEmail } from "@/lib/integrations/gmail";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { GET } from "@/app/api/admin/weekly-email-preview/route";

const m = (f: unknown) => f as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  m(getSessionContext).mockResolvedValue({ businessId: "biz1", userId: "u1", email: "founder@example.com" });
  m(isPlatformAdmin).mockReturnValue(true);
  m(tooManyRecentActions).mockResolvedValue(false);
  m(prisma.business.findUnique).mockResolvedValue({ id: "biz1", name: "Acme", timezone: null });
  m(sendEmail).mockResolvedValue({ success: true });
});

describe("weekly email preview", () => {
  it("is not there for anyone who is not a platform admin", async () => {
    m(isPlatformAdmin).mockReturnValue(false);
    const res = await GET();
    expect(res.status).toBe(404);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("is not there when signed out", async () => {
    m(getSessionContext).mockResolvedValue(null);
    expect((await GET()).status).toBe(404);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends the real email, logo included, to the signed-in address only", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledWith("biz1", {
      to: "founder@example.com",
      subject: "Preview: Your week",
      body: "t",
      html: "<p>h</p>",
      inlineImages: [{ cid: "fu-logo@followupbase.io" }],
    });
  });

  it("sends at most one every two minutes", async () => {
    m(tooManyRecentActions).mockResolvedValue(true);
    const res = await GET();
    expect(res.status).toBe(429);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(tooManyRecentActions).toHaveBeenCalledWith("biz1", "weekly_email_preview", { windowMinutes: 2, max: 1 });
  });
});
