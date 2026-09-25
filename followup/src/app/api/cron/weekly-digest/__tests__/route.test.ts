/**
 * B-004 (research/audit/backend-backlog.md): hasActiveAccess() was called
 * here without the `tier` argument. Per its own contract
 * (src/lib/billing.ts), omitting tier means a Free business (which by
 * design has no Stripe subscription — see checkout/route.ts) reads as
 * fully locked out, identical to canceled/past_due. That silently
 * excluded every Free business from ever receiving "what FollowUp saved
 * you this week" — the route's own doc comment says "every active
 * business" and documents only one exclusion (no connected Gmail), not a
 * tier gate.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/cronAuth", () => ({ requireCronSecret: vi.fn(() => null) }));

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { business: { findMany } } }));

const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn(async () => ({ success: true })) }));
vi.mock("@/lib/integrations/gmail", () => ({ sendEmail }));

const { getRescueReport, renderRescueDigest } = vi.hoisted(() => ({
  getRescueReport: vi.fn(async () => ({ rescued: 2, answeredForYou: 3 })),
  renderRescueDigest: vi.fn(() => "<p>digest</p>"),
}));
vi.mock("@/lib/rescued", () => ({ getRescueReport, renderRescueDigest }));

// How many replies are written and waiting. The digest asks for this so
// it can lead with what needs the owner — on a holding account (the
// default since 2026-09-21) the automated-send counts above are zero by
// construction, and a digest built only from them reports a week of
// nothing to a business sitting on a full approval queue.
const { getPendingApprovals } = vi.hoisted(() => ({ getPendingApprovals: vi.fn(async () => [] as unknown[]) }));
vi.mock("@/lib/pendingApprovals", () => ({ getPendingApprovals }));

vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://followupbase.io" }));

// The once-a-week claim (audit 2026-09-25 daily path, F11) always finds an
// empty week here; what it guarantees is pinned in
// src/lib/__tests__/weeklyDigestOnce.test.ts, against the real claim.
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions: vi.fn(async () => false) }));

import { GET } from "@/app/api/cron/weekly-digest/route";

function business(overrides: Partial<{ id: string; subscriptionStatus: string | null; tier: string }>) {
  return {
    id: "biz-1",
    name: "Acme Plumbing",
    subscriptionStatus: null,
    tier: "free",
    users: [{ email: "owner@acme.com" }],
    ...overrides,
  };
}

function req() {
  return new Request("https://followupbase.io/api/cron/weekly-digest") as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  sendEmail.mockResolvedValue({ success: true });
});

describe("GET /api/cron/weekly-digest — access gating", () => {
  it("sends the digest to a Free-tier business (never subscribed)", async () => {
    findMany.mockResolvedValue([business({ subscriptionStatus: null, tier: "free" })]);
    const res = await GET(req());
    const body = await res.json();
    expect(sendEmail).toHaveBeenCalled();
    expect(body.sent).toBe(1);
    expect(body.skipped).toBe(0);
  });

  it("still sends to an active paid subscription", async () => {
    findMany.mockResolvedValue([business({ subscriptionStatus: "active", tier: "plus" })]);
    const res = await GET(req());
    const body = await res.json();
    expect(sendEmail).toHaveBeenCalled();
    expect(body.sent).toBe(1);
  });

  it("still skips a canceled/past_due business on a paid tier", async () => {
    findMany.mockResolvedValue([business({ subscriptionStatus: "canceled", tier: "plus" })]);
    const res = await GET(req());
    const body = await res.json();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(body.skipped).toBe(1);
  });

  it("still skips a business with no admin users, regardless of tier", async () => {
    findMany.mockResolvedValue([{ ...business({ tier: "free" }), users: [] }]);
    const res = await GET(req());
    const body = await res.json();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(body.skipped).toBe(1);
  });
});
