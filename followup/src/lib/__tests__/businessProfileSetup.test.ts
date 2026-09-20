/**
 * "I don't see any option like business name."
 *
 * The founder, 2026-09-20, after being told to fix his business name in
 * Settings. He was right: there was no such option anywhere. Name and
 * industry were asked once in the onboarding wizard and then unreachable
 * forever — even though /api/onboarding had always accepted a partial
 * update "at any time, not just during first-run".
 *
 * That is the cause behind two things fixed earlier the same day: four
 * real people received "Thank you for contacting My Business", and a
 * photographer pitching a software founder was read as a customer by a
 * classifier with `industry: null` and nothing to judge against.
 *
 * So the setup strip now names it as a step. These tests are about that
 * step existing and clearing correctly — a nag an owner cannot clear is
 * its own bug, and this file already has one of those (the website
 * widget, still open).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { businessFindUnique, leadFindFirst } = vi.hoisted(() => ({
  businessFindUnique: vi.fn(),
  leadFindFirst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { business: { findUnique: businessFindUnique }, lead: { findFirst: leadFindFirst } },
}));
vi.mock("@/lib/integrations/gmail", () => ({ getGmailStatus: vi.fn(async () => ({ connected: true })) }));
vi.mock("@/lib/integrations/outlook", () => ({ getOutlookStatus: vi.fn(async () => ({ connected: false })) }));

import { getIncompleteSetupSteps } from "@/lib/setupStatus";

/** A fully set-up business, so only the field under test varies. */
function business(over: Record<string, unknown> = {}) {
  return {
    subscriptionStatus: "active",
    tier: "pro",
    twilioPhoneNumber: "+15551234567",
    name: "MJ Homes",
    industry: "Real estate",
    ...over,
  };
}

beforeEach(() => {
  businessFindUnique.mockReset();
  // A widget lead exists, so that step (which cannot otherwise be
  // cleared) stays out of these assertions.
  leadFindFirst.mockResolvedValue({ id: "widget-lead" });
});

const ids = async () => (await getIncompleteSetupSteps("biz1")).map((s) => s.id);

describe("the step that did not exist", () => {
  it("appears when the business still has the placeholder name", async () => {
    businessFindUnique.mockResolvedValue(business({ name: "My Business" }));
    expect(await ids()).toContain("business");
  });

  it("appears when the industry is null — the classifier's blind spot", async () => {
    businessFindUnique.mockResolvedValue(business({ industry: null }));
    expect(await ids()).toContain("business");
  });

  it("appears for the founder's exact account: placeholder name AND no industry", async () => {
    businessFindUnique.mockResolvedValue(business({ name: "My Business", industry: null }));
    expect(await ids()).toContain("business");
  });

  it("is gone once both are set", async () => {
    businessFindUnique.mockResolvedValue(business());
    expect(await ids()).not.toContain("business");
  });

  it("points at the section that now exists", async () => {
    businessFindUnique.mockResolvedValue(business({ name: "My Business" }));
    const step = (await getIncompleteSetupSteps("biz1")).find((s) => s.id === "business");
    // SECTION_TAB in settings/page.tsx maps "business" to the Team tab;
    // without that row the anchor opens the wrong tab and scrolls to
    // nothing, which is a bug this codebase has already shipped once
    // (#whatsapp, fixed 2026-09-20).
    expect(step?.ctaHref).toBe("/settings#business");
  });
});

describe("it is cheap and comes early", () => {
  it("sits right after billing when billing is genuinely unfinished", async () => {
    // Note: tier "free" would NOT produce a billing step — hasActiveAccess
    // treats Free as real access, which this file's own comment records as
    // a bug it already fixed. A lapsed paid plan is the state that does.
    businessFindUnique.mockResolvedValue(
      business({ subscriptionStatus: "canceled", tier: "plus", name: "My Business", industry: null })
    );
    const order = await ids();
    expect(order[0]).toBe("billing");
    expect(order[1]).toBe("business");
  });

  it("is first when billing is already sorted", async () => {
    businessFindUnique.mockResolvedValue(business({ name: "My Business" }));
    expect((await ids())[0]).toBe("business");
  });
});

describe("a real name that merely looks like a placeholder is left alone", () => {
  it("does not nag a business genuinely called something with 'Business' in it", async () => {
    businessFindUnique.mockResolvedValue(business({ name: "My Business Solutions Inc" }));
    expect(await ids()).not.toContain("business");
  });

  it("does nag the bare default, whatever the casing", async () => {
    businessFindUnique.mockResolvedValue(business({ name: "  MY BUSINESS " }));
    expect(await ids()).toContain("business");
  });
});
