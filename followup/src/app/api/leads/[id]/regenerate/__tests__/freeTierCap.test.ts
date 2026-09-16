/**
 * Regression: POST /api/leads/[id]/regenerate reached the OpenAI client
 * behind requireActiveBilling() alone, which admits Free tier by design.
 * That made it a way to walk straight past Free's defining restriction —
 * "AI processing pauses past lead #20, and for channels Free doesn't
 * cover" — which was otherwise enforced only inside scoreAndDraftForLead(),
 * runAutomationForBusiness() and runSequencesForBusiness(). A $0 business
 * could draft against lead #500 of the month, on any channel, up to the
 * route's rate limit (15 per 10 minutes) on the platform's shared key.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { leadFindUnique, leadUpdate, leadCount, businessFindUnique } = vi.hoisted(() => ({
  leadFindUnique: vi.fn(),
  leadUpdate: vi.fn(async () => ({})),
  leadCount: vi.fn(async () => 0),
  // checkAiEligibility reads the business's subscription status directly —
  // AI pauses on a lapsed card even though capture no longer does. These
  // cases are all about the TIER cap, so the subscription is in good
  // standing throughout (see billingLockout.test.ts for the other axis).
  businessFindUnique: vi.fn(async () => ({ subscriptionStatus: "active" })),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    lead: { findUnique: leadFindUnique, update: leadUpdate, count: leadCount },
    business: { findUnique: businessFindUnique },
  },
}));

const { getSessionContext } = vi.hoisted(() => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionContext }));

const { requireActiveBilling } = vi.hoisted(() => ({ requireActiveBilling: vi.fn(async () => true) }));
vi.mock("@/lib/billing", async (importOriginal) => ({
  // The Free-tier helpers are the real ones — they're pure enough to run
  // against the mocked prisma.lead.count above, and mocking them would be
  // mocking the thing under test.
  ...(await importOriginal<typeof import("@/lib/billing")>()),
  requireActiveBilling,
  billingLockedMessage: async () => "locked",
}));

const { tooManyRecentActions } = vi.hoisted(() => ({ tooManyRecentActions: vi.fn(async () => false) }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions }));

const { generateFollowUpMessage } = vi.hoisted(() => ({
  generateFollowUpMessage: vi.fn(async () => ({ subject: "s", body: "b" })),
}));
vi.mock("@/lib/integrations/openai", () => ({ generateFollowUpMessage }));
vi.mock("@/lib/sender", () => ({
  composeFollowUpEmail: async (_n: string, _b: string, body: string) => body,
  latestInboundText: () => "hi",
}));
vi.mock("@/lib/voice", () => ({ getVoiceSamples: async () => [] }));

import { POST } from "@/app/api/leads/[id]/regenerate/route";

const params = Promise.resolve({ id: "lead1" });
const req = {} as Parameters<typeof POST>[0];

function lead(tier: string, source: string) {
  return {
    id: "lead1",
    businessId: "biz1",
    name: "Dana Reed",
    source,
    createdAt: new Date("2026-09-10T00:00:00Z"),
    conversations: [
      { channel: "email", messages: [{ id: "m1", direction: "inbound", body: "hi", sentAt: new Date(), opened: false }] },
    ],
    business: { tier },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "user1", email: "owner@acme.com" });
  requireActiveBilling.mockResolvedValue(true);
  businessFindUnique.mockResolvedValue({ subscriptionStatus: "active" });
  tooManyRecentActions.mockResolvedValue(false);
  leadCount.mockResolvedValue(1);
});

describe("POST /api/leads/[id]/regenerate — Free-tier AI cap", () => {
  it("refuses a Free-tier lead past the monthly cap, without calling OpenAI", async () => {
    leadFindUnique.mockResolvedValue(lead("free", "Website form"));
    leadCount.mockResolvedValue(21); // this lead ranks 21st that month

    const res = await POST(req, { params });

    expect(res.status).toBe(402);
    expect(generateFollowUpMessage).not.toHaveBeenCalled();
    expect(leadUpdate).not.toHaveBeenCalled();
  });

  it("refuses a Free-tier lead on a channel Free doesn't cover", async () => {
    leadFindUnique.mockResolvedValue(lead("free", "SMS"));
    leadCount.mockResolvedValue(1);

    const res = await POST(req, { params });

    expect(res.status).toBe(402);
    expect(generateFollowUpMessage).not.toHaveBeenCalled();
  });

  it("still drafts for a Free-tier lead within the cap on an allowed channel", async () => {
    leadFindUnique.mockResolvedValue(lead("free", "Website form"));
    leadCount.mockResolvedValue(3);

    const res = await POST(req, { params });

    expect(res.status).toBe(200);
    expect(generateFollowUpMessage).toHaveBeenCalled();
  });

  it("never applies the cap to a paying tier", async () => {
    leadFindUnique.mockResolvedValue(lead("pro", "SMS"));
    leadCount.mockResolvedValue(5000);

    const res = await POST(req, { params });

    expect(res.status).toBe(200);
    expect(generateFollowUpMessage).toHaveBeenCalled();
  });
});
