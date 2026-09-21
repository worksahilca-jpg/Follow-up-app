/**
 * The setup strip's ordered checklist (src/lib/setupStatus.ts) —
 * research/product/2026-09-10-ux-simplification.md §2/§7.1: replaces the
 * Sidebar's two permanent nag cards with one at-a-time strip on Today.
 * Order matters (billing → Gmail → phone → widget) and it's a pure
 * derivation from facts already stored elsewhere — nothing new tracked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
import { DISMISSIBLE_SETUP_STEPS, getIncompleteSetupSteps } from "@/lib/setupStatus";
import { CARRIER_CHANNELS_AVAILABLE } from "@/lib/pricing";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const gmailStatus = getGmailStatus as unknown as ReturnType<typeof vi.fn>;
const outlookStatus = getOutlookStatus as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  // Fully set up by default — each test knocks out just the one thing it cares about.
  p.business.findUnique.mockResolvedValue({ subscriptionStatus: "active", tier: "plus", twilioPhoneNumber: "+15551234567", name: "MJ Homes", industry: "Real estate", dismissedSetupSteps: [] });
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
    p.business.findUnique.mockResolvedValue({ subscriptionStatus: null, tier: null, twilioPhoneNumber: "+15551234567", name: "MJ Homes", industry: "Real estate" });
    const steps = await getIncompleteSetupSteps("biz1");
    expect(steps[0].id).toBe("billing");
  });

  it("flags Gmail when it isn't connected", async () => {
    gmailStatus.mockResolvedValue({ connected: false });
    const steps = await getIncompleteSetupSteps("biz1");
    expect(steps.map((s) => s.id)).toContain("gmail");
  });

  it("flags phone when no Twilio number is on file — only while carrier channels are offered", async () => {
    p.business.findUnique.mockResolvedValue({ subscriptionStatus: "active", tier: "plus", twilioPhoneNumber: null, name: "MJ Homes", industry: "Real estate" });
    const steps = await getIncompleteSetupSteps("biz1");
    // Kept rather than deleted so re-enabling the flag restores this coverage
    // instead of silently losing it — same shape as channelAvailability.test.ts.
    expect(steps.map((s) => s.id).includes("phone")).toBe(CARRIER_CHANNELS_AVAILABLE);
  });

  it("flags the website widget when no lead has ever come from it", async () => {
    p.lead.findFirst.mockResolvedValue(null);
    const steps = await getIncompleteSetupSteps("biz1");
    expect(steps.map((s) => s.id)).toContain("widget");
  });

  it("orders billing, then Gmail, then phone, then widget, regardless of what's incomplete", async () => {
    p.business.findUnique.mockResolvedValue({ subscriptionStatus: null, twilioPhoneNumber: null, name: "MJ Homes", industry: "Real estate" });
    gmailStatus.mockResolvedValue({ connected: false });
    p.lead.findFirst.mockResolvedValue(null);
    const steps = await getIncompleteSetupSteps("biz1");
    const expected = CARRIER_CHANNELS_AVAILABLE
      ? ["billing", "gmail", "phone", "widget"]
      : ["billing", "gmail", "widget"];
    expect(steps.map((s) => s.id)).toEqual(expected);
  });

  it("every step names a real place to fix it", async () => {
    p.business.findUnique.mockResolvedValue({ subscriptionStatus: null, twilioPhoneNumber: null, name: "MJ Homes", industry: "Real estate" });
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
    p.business.findUnique.mockResolvedValue({ subscriptionStatus: null, tier: "free", twilioPhoneNumber: "+15551234567", name: "MJ Homes", industry: "Real estate" });
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

/**
 * The bug this file's own subject caused for every new account, 2026-09-16.
 *
 * Dropping the carrier channels hid Settings' phone section behind
 * CARRIER_CHANNELS_AVAILABLE, but the step kept being offered — and
 * twilioPhoneNumber's only writer lives inside that same gate, so the step
 * could never be cleared by anyone. SetupStrip renders steps[0] only, so
 * the consequence was not one dud row in a list: it was every new business
 * stuck on a single unfinishable instruction, with the website widget — the
 * one capture channel needing no third party, no Google review and no Meta
 * approval — never shown to a single person.
 *
 * The rule these pin: never offer a setup step the product will not let
 * them finish.
 */
describe("the setup strip never offers a step nobody can complete", () => {
  beforeEach(() => {
    // The state every brand-new business is in: nothing connected, no
    // Twilio number, no widget lead yet.
    p.business.findUnique.mockResolvedValue({ subscriptionStatus: "active", tier: "plus", twilioPhoneNumber: null, name: "MJ Homes", industry: "Real estate" });
    gmailStatus.mockResolvedValue({ connected: true, email: "owner@example.com" });
    outlookStatus.mockResolvedValue({ connected: false });
    p.lead.findFirst.mockResolvedValue(null);
  });

  it("does not offer phone setup while the carrier channels are switched off", async () => {
    if (CARRIER_CHANNELS_AVAILABLE) return; // offered again — the step is real
    const steps = await getIncompleteSetupSteps("biz1");
    expect(steps.map((s) => s.id)).not.toContain("phone");
  });

  it("shows the website widget as the next step instead", async () => {
    if (CARRIER_CHANNELS_AVAILABLE) return;
    const steps = await getIncompleteSetupSteps("biz1");
    // steps[0] specifically: SetupStrip renders only the first one, so a
    // widget step buried behind a dead phone step is a widget step nobody
    // ever sees. This is the assertion that would have caught the bug.
    expect(steps[0]?.id).toBe("widget");
  });

  it("offers only steps whose Settings anchor actually exists", async () => {
    // The deeper rule. "/settings#phone" pointed at an id rendered inside
    // {CARRIER_CHANNELS_AVAILABLE && (...)}, so the link opened Settings,
    // scrolled nowhere and raised nothing — indistinguishable from a page
    // that simply ignored the click.
    const settings = readFileSync(join(__dirname, "..", "..", "app", "(app)", "settings", "page.tsx"), "utf8");
    const gatedStart = settings.indexOf("CARRIER_CHANNELS_AVAILABLE && (");
    const steps = await getIncompleteSetupSteps("biz1");
    for (const step of steps) {
      const anchor = step.ctaHref.split("#")[1];
      if (!anchor) continue;
      const idAt = settings.indexOf(`id="${anchor}"`);
      expect(idAt, `no id="${anchor}" in Settings for step "${step.id}"`).toBeGreaterThan(-1);
      // …and not inside the carrier-gated region, which renders nothing today.
      if (!CARRIER_CHANNELS_AVAILABLE && gatedStart > -1) {
        expect(idAt, `step "${step.id}" points at an anchor hidden behind CARRIER_CHANNELS_AVAILABLE`).toBeLessThan(gatedStart);
      }
    }
  });
});

/**
 * The one step that could never be finished.
 *
 * Every other step clears by being done. "Add your website widget"
 * cleared only when a lead actually arrived through the widget, which a
 * business with no website can never cause — so the strip on Today asked
 * them, forever, to do something they had no way to do. It was recorded
 * as a known bug on 2026-09-20 and left open because "can a setup step be
 * skipped at all?" is a product question; the founder answered it on
 * 2026-09-21.
 */
describe("a step a business can honestly not do", () => {
  beforeEach(() => {
    // No widget lead — the state that produced the permanent nag.
    p.lead.findFirst.mockResolvedValue(null);
  });

  it("still asks for the widget when nothing has been skipped", async () => {
    const steps = await getIncompleteSetupSteps("biz1");
    expect(steps.map((s) => s.id)).toContain("widget");
  });

  it("stops asking once the owner says they have no website", async () => {
    p.business.findUnique.mockResolvedValue({
      subscriptionStatus: "active",
      tier: "plus",
      twilioPhoneNumber: "+15551234567",
      name: "MJ Homes",
      industry: "Real estate",
      dismissedSetupSteps: ["widget"],
    });

    const steps = await getIncompleteSetupSteps("biz1");
    expect(steps.map((s) => s.id)).not.toContain("widget");
    // And setup is genuinely finishable now, which is the whole point.
    expect(steps).toEqual([]);
  });

  it("carries a label that says what skipping means, not just 'skip'", async () => {
    const [widget] = (await getIncompleteSetupSteps("biz1")).filter((s) => s.id === "widget");
    expect(widget.dismissible).toBe(true);
    // brand-principles.md #4: the reader will not work out what "Skip"
    // refers to or what it costs them.
    expect(widget.dismissLabel).toMatch(/website/i);
  });

  /**
   * The rule that matters more than the fix. A dismiss on billing or the
   * inbox would hide a real failure behind a tidy screen — the owner
   * would stop being told the product is not working, which is exactly
   * the dark pattern brand-principles.md #1 rules out.
   */
  it("never lets billing, business details or the inbox be skipped", async () => {
    p.business.findUnique.mockResolvedValue({
      subscriptionStatus: "canceled",
      tier: "plus",
      twilioPhoneNumber: null,
      name: "",
      industry: null,
      // Someone posting every id at the route, or a future bug widening
      // the allow-list — either way these must survive.
      dismissedSetupSteps: ["billing", "business", "gmail", "phone", "widget"],
    });
    gmailStatus.mockResolvedValue({ connected: false });

    const ids = (await getIncompleteSetupSteps("biz1")).map((s) => s.id);
    expect(ids).toContain("billing");
    expect(ids).toContain("business");
    expect(ids).toContain("gmail");
  });

  it("marks exactly the optional capture channels as skippable", async () => {
    // Guards the list itself: a step added later is not skippable by
    // accident, and neither of these two silently stops being skippable.
    expect([...DISMISSIBLE_SETUP_STEPS].sort()).toEqual(["phone", "widget"]);
  });
});
