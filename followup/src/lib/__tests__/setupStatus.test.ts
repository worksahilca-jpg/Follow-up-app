/**
 * The setup strip's ordered checklist (src/lib/setupStatus.ts) —
 * research/product/2026-09-10-ux-simplification.md §2/§7.1: replaces the
 * Sidebar's two permanent nag cards with one at-a-time strip on Today.
 * Order matters (billing → Gmail → phone → widget) and it's a pure
 * derivation from facts already stored elsewhere — nothing new tracked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    lead: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/integrations/gmail", () => ({ getGmailStatus: vi.fn() }));

import { prisma } from "@/lib/db";
import { getGmailStatus } from "@/lib/integrations/gmail";
import { getIncompleteSetupSteps } from "@/lib/setupStatus";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const gmailStatus = getGmailStatus as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  // Fully set up by default — each test knocks out just the one thing it cares about.
  p.business.findUnique.mockResolvedValue({ subscriptionStatus: "active", twilioPhoneNumber: "+15551234567" });
  gmailStatus.mockResolvedValue({ connected: true, email: "owner@example.com" });
  p.lead.findFirst.mockResolvedValue({ id: "lead1" }); // a "Website form" lead exists
});

describe("getIncompleteSetupSteps", () => {
  it("returns nothing when everything is already set up", async () => {
    const steps = await getIncompleteSetupSteps("biz1");
    expect(steps).toEqual([]);
  });

  it("flags billing first when the subscription isn't active", async () => {
    p.business.findUnique.mockResolvedValue({ subscriptionStatus: null, twilioPhoneNumber: "+15551234567" });
    const steps = await getIncompleteSetupSteps("biz1");
    expect(steps[0].id).toBe("billing");
  });

  it("flags Gmail when it isn't connected", async () => {
    gmailStatus.mockResolvedValue({ connected: false });
    const steps = await getIncompleteSetupSteps("biz1");
    expect(steps.map((s) => s.id)).toContain("gmail");
  });

  it("flags phone when no Twilio number is on file", async () => {
    p.business.findUnique.mockResolvedValue({ subscriptionStatus: "active", twilioPhoneNumber: null });
    const steps = await getIncompleteSetupSteps("biz1");
    expect(steps.map((s) => s.id)).toContain("phone");
  });

  it("flags the website widget when no lead has ever come from it", async () => {
    p.lead.findFirst.mockResolvedValue(null);
    const steps = await getIncompleteSetupSteps("biz1");
    expect(steps.map((s) => s.id)).toContain("widget");
  });

  it("orders billing, then Gmail, then phone, then widget, regardless of what's incomplete", async () => {
    p.business.findUnique.mockResolvedValue({ subscriptionStatus: null, twilioPhoneNumber: null });
    gmailStatus.mockResolvedValue({ connected: false });
    p.lead.findFirst.mockResolvedValue(null);
    const steps = await getIncompleteSetupSteps("biz1");
    expect(steps.map((s) => s.id)).toEqual(["billing", "gmail", "phone", "widget"]);
  });

  it("every step names a real place to fix it", async () => {
    p.business.findUnique.mockResolvedValue({ subscriptionStatus: null, twilioPhoneNumber: null });
    gmailStatus.mockResolvedValue({ connected: false });
    p.lead.findFirst.mockResolvedValue(null);
    const steps = await getIncompleteSetupSteps("biz1");
    for (const step of steps) {
      expect(step.ctaHref).toMatch(/^\/settings/);
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.ctaLabel.length).toBeGreaterThan(0);
    }
  });
});
