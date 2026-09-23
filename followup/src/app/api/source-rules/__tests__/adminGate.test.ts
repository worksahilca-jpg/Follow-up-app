/**
 * Regression: POST /api/source-rules had no role gate, so a SALES-role user
 * could rewrite the whole business's per-source automation defaults.
 *
 * A source rule is not per-lead work: applySourceRouting() applies it to
 * EVERY future lead from that channel the moment it is created, including
 * setting automationTier to AUTONOMOUS — unreviewed sending — for all of
 * them, or enrolling them all in a workflow. That is the same class of
 * account-level decision requireAdmin() already guards on POST
 * /api/automation/settings, which sits in the same Settings screen.
 *
 * GET stays open: a rep should still be able to see what the rules are.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { sourceRuleUpsert, sourceRuleFindMany, sequenceFindMany, sequenceFindUnique, businessFindUnique } = vi.hoisted(() => ({
  sourceRuleUpsert: vi.fn(async () => ({})),
  sourceRuleFindMany: vi.fn(async () => []),
  sequenceFindMany: vi.fn(async () => []),
  sequenceFindUnique: vi.fn(),
  businessFindUnique: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    sourceRule: { upsert: sourceRuleUpsert, findMany: sourceRuleFindMany },
    sequence: { findMany: sequenceFindMany, findUnique: sequenceFindUnique },
    // Added when this route learned to ask whether the ACCOUNT has
    // permitted unreviewed sending, not just whether the person is an
    // admin. See the second describe block.
    business: { findUnique: businessFindUnique },
  },
}));

const { getSessionContext, requireAdmin } = vi.hoisted(() => ({
  getSessionContext: vi.fn(),
  requireAdmin: vi.fn(async () => true),
}));
vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));

const { requireActiveBilling } = vi.hoisted(() => ({ requireActiveBilling: vi.fn(async () => true) }));
vi.mock("@/lib/billing", () => ({ requireActiveBilling, billingLockedMessage: async () => "locked" }));

import { AUTONOMOUS_NOT_ALLOWED_MESSAGE } from "@/lib/autonomousPermission";
import { GET, POST } from "@/app/api/source-rules/route";

function request(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "user1", email: "rep@acme.com" });
  requireAdmin.mockResolvedValue(true);
  requireActiveBilling.mockResolvedValue(true);
  // Permitted by default here, so the role tests below stay tests of the
  // ROLE gate. The permission gate gets its own block and switches this.
  businessFindUnique.mockResolvedValue({ autonomousAllowed: true });
});

describe("POST /api/source-rules — role gate", () => {
  it("refuses a SALES user and writes nothing", async () => {
    requireAdmin.mockResolvedValue(false);

    const res = await POST(request({ source: "Website form", automationTierDefault: "AUTONOMOUS" }));

    expect(res.status).toBe(403);
    expect(sourceRuleUpsert).not.toHaveBeenCalled();
  });

  it("lets an admin save a rule", async () => {
    // Autonomous, on an account that HAS permitted it (see beforeEach).
    // This test used to pass with no permission involved at all, because
    // the route never asked. It does now, and the two gates are
    // deliberately independent: being an admin is not consent, and
    // consent is not a role.
    const res = await POST(request({ source: "Website form", automationTierDefault: "AUTONOMOUS" }));

    expect(res.status).toBe(200);
    expect(sourceRuleUpsert).toHaveBeenCalledTimes(1);
  });

  it("leaves GET readable by a SALES user", async () => {
    requireAdmin.mockResolvedValue(false);

    const res = await GET();

    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});

/**
 * The third way to Auto, and until 2026-09-23 the only one that did not ask.
 *
 * `POST /api/leads/[id]/automation` refuses with 403 when the account has
 * not permitted unreviewed sending. `POST /api/leads/bulk-automation`
 * refuses with the same message. This route accepted — and then
 * `applySourceRouting` started every lead the rule touched on ASSISTED
 * instead, while the rule row in Settings went on reading "Autonomous"
 * indefinitely. The owner picked a mode, was told nothing, and got a
 * different one.
 *
 * The block above is about WHO is asking. This one is about whether the
 * account has said yes. An admin without the permission is exactly the
 * person who hit the bug, which is why passing the first gate must not
 * imply passing the second.
 */
describe("POST /api/source-rules — the account's permission for unreviewed sending", () => {
  it("refuses an Autonomous rule when the account has not permitted it", async () => {
    businessFindUnique.mockResolvedValue({ autonomousAllowed: false });

    const res = await POST(request({ source: "Instagram", automationTierDefault: "AUTONOMOUS" }));

    expect(res.status).toBe(403);
    // Nothing written. A saved-but-downgraded rule is the original
    // defect: the row says one thing and the leads do another.
    expect(sourceRuleUpsert).not.toHaveBeenCalled();
  });

  it("says the same sentence the other two refusals say", async () => {
    // Three routes refuse this. Three hand-written sentences would drift
    // and an owner would get a different explanation depending on which
    // one they happened to hit.
    businessFindUnique.mockResolvedValue({ autonomousAllowed: false });

    const res = await POST(request({ source: "Instagram", automationTierDefault: "AUTONOMOUS" }));

    expect((await res.json()).message).toBe(AUTONOMOUS_NOT_ALLOWED_MESSAGE);
  });

  it("still saves Assisted, OFF and cleared rules on an unpermitted account", async () => {
    // The gate must be about Auto and nothing else. Refusing these would
    // lock an account out of the very setting that keeps it safe — all
    // eighteen rules in production today are ASSISTED.
    businessFindUnique.mockResolvedValue({ autonomousAllowed: false });

    for (const tier of ["ASSISTED", "OFF", null]) {
      sourceRuleUpsert.mockClear();
      const res = await POST(request({ source: "Instagram", automationTierDefault: tier }));
      expect(res.status, `tier ${tier} was refused`).toBe(200);
      expect(sourceRuleUpsert).toHaveBeenCalledTimes(1);
    }
  });

  it("does not even ask about the permission for a non-Auto rule", async () => {
    // A needless round trip to the database on every rule save, and a
    // sign the condition has been written the wrong way round.
    await POST(request({ source: "Instagram", automationTierDefault: "ASSISTED" }));
    expect(businessFindUnique).not.toHaveBeenCalled();
  });

  it("checks the role before the permission", async () => {
    // A SALES user on an unpermitted account should be told they are not
    // an admin — the first thing that is true of them — rather than
    // learning about an account setting they cannot change anyway.
    requireAdmin.mockResolvedValue(false);
    businessFindUnique.mockResolvedValue({ autonomousAllowed: false });

    const res = await POST(request({ source: "Instagram", automationTierDefault: "AUTONOMOUS" }));

    expect(res.status).toBe(403);
    expect((await res.json()).message).toMatch(/admin/i);
    expect(businessFindUnique).not.toHaveBeenCalled();
  });

  it("tells Settings whether Auto is available, so it can stop offering it", async () => {
    // The GET half. Without this the dropdown cannot know, which is how
    // it came to offer a choice the POST refuses.
    businessFindUnique.mockResolvedValue({ autonomousAllowed: false });

    const body = await (await GET()).json();

    expect(body.autonomousAllowed).toBe(false);
  });
});
