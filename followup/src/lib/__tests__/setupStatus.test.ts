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
vi.mock("@/lib/integrations/outlook", () => ({ getOutlookStatus: vi.fn() }));

import { prisma } from "@/lib/db";
import { getGmailStatus } from "@/lib/integrations/gmail";
import { getOutlookStatus } from "@/lib/integrations/outlook";
import { getIncompleteSetupSteps } from "@/lib/setupStatus";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const gmailStatus = getGmailStatus as unknown as ReturnType<typeof vi.fn>;
const outlookStatus = getOutlookStatus as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  // Fully set up by default — each test knocks out just the one thing it cares about.
  p.business.findUnique.mockResolvedValue({ subscriptionStatus: "active", tier: "plus", twilioPhoneNumber: "+15551234567" });
  gmailStatus.mockResolvedValue({ connected: true, email: "owner@example.com" });
  outlookStatus.mockResolvedValue({ connected: false });
  p.lead.findFirst.mockResolvedValue({ id: "lead1" }); // a "Website form" lead exists
});

describe("getIncompleteSetupSteps", () => {
  it("returns nothing when everything is already set up", async () => {
    const steps = await getIncompleteSetupSteps("biz1");
    expect(steps).toEqual([]);
  });

  it("flags billing first when the subscription isn't active", async () => {
    p.business.findUnique.mockResolvedValue({ subscriptionStatus: null, tier: null, twilioPhoneNumber: "+15551234567" });
    const steps = await getIncompleteSetupSteps("biz1");
    expect(steps[0].id).toBe("billing");
  });

  it("flags Gmail when it isn't connected", async () => {
    gmailStatus.mockResolvedValue({ connected: false });
    const steps = await getIncompleteSetupSteps("biz1");
    expect(steps.map((s) => s.id)).toContain("gmail");
  });

  it("flags phone when no Twilio number is on file", async () => {
    p.business.findUnique.mockResolvedValue({ subscriptionStatus: "active", tier: "plus", twilioPhoneNumber: null });
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

  /**
   * Three bugs a 2026-09-15 real-user audit found in this one function, all
   * the same class: telling an owner something untrue about their own
   * account, on the dashboard, forever.
   */

  it("does NOT nag a business that connected Outlook instead of Gmail", async () => {
    // The check read Gmail alone. A business fully connected to Microsoft 365
    // — capturing leads, running automation, working exactly as intended —
    // was told "Connect your inbox" on every visit, with a remaining-steps
    // count it had no way to clear.
    gmailStatus.mockResolvedValue({ connected: false });
    outlookStatus.mockResolvedValue({ connected: true, email: "owner@contoso.com" });
    const steps = await getIncompleteSetupSteps("biz1");
    expect(steps.map((s) => s.id)).not.toContain("gmail");
  });

  it("does NOT tell a working Free-tier business to start a trial", async () => {
    // hasActiveAccess treats tier "free" as real access, but `tier` was being
    // dropped at this call site. So the dashboard demanded a trial while
    // Settings → Billing said "Free… this is where you are now" — two screens
    // making opposite claims, which reads as a dark pattern, not a bug.
    p.business.findUnique.mockResolvedValue({ subscriptionStatus: null, tier: "free", twilioPhoneNumber: "+15551234567" });
    const steps = await getIncompleteSetupSteps("biz1");
    expect(steps.map((s) => s.id)).not.toContain("billing");
  });

  it("asks a business with a revoked Gmail grant to RECONNECT, not to connect", async () => {
    // "You never connected an inbox" and "the inbox you connected has stopped
    // working" are different problems with different fixes, and the second one
    // means leads are actively being missed right now.
    gmailStatus.mockResolvedValue({ connected: false, needsReconnect: true, email: "owner@example.com" });
    const steps = await getIncompleteSetupSteps("biz1");
    const inbox = steps.find((s) => s.id === "gmail");
    expect(inbox?.title).toBe("Reconnect your inbox");
    expect(inbox?.description).toContain("owner@example.com");
  });

  it("stays quiet about the inbox when a revoked Gmail sits alongside a working Outlook", async () => {
    // Leads are still being captured, so there is nothing for the owner to do.
    gmailStatus.mockResolvedValue({ connected: false, needsReconnect: true, email: "owner@example.com" });
    outlookStatus.mockResolvedValue({ connected: true, email: "owner@contoso.com" });
    const steps = await getIncompleteSetupSteps("biz1");
    expect(steps.map((s) => s.id)).not.toContain("gmail");
  });
});
