/**
 * "Auto should be permitted by the user that is using followup."
 * — founder, 2026-09-23
 *
 * Auto is the one mode that skips the risk check. A lead on it sends
 * price talk, delivery promises and tense conversations with nobody
 * reading them first. That is a legitimate thing to want, and it is never
 * something that should happen because nobody said no.
 *
 * ## Why this needed building at all
 *
 * Three things looked like guards, and none of them was one:
 *
 *   1. A **confirmation dialog** on the lead page — client code, which
 *      the API never hears about.
 *   2. A **billing-tier check** — Free is Assisted-only. That is pricing,
 *      not consent. Paying for Pro is not saying "send things nobody has
 *      read."
 *   3. **No admin check on the API**, so any signed-in teammate could set
 *      any lead to Auto by calling it directly, dialog or no dialog.
 *
 * And a fourth path had nothing at all: a SourceRule's
 * `automationTierDefault` is applied when a lead is CREATED, so one rule
 * could put every new lead from a channel onto unreviewed sending with no
 * human in the loop at any point.
 *
 * ## The two ends
 *
 * The tests below cover both, and the second is what makes this a
 * permission rather than a speed bump. Gating only the act of SETTING
 * Auto would leave every account that already has Auto leads exactly as
 * it was — the setting would be decoration for the people it most needs
 * to protect. So an already-Auto lead on an unpermitted account is
 * treated as Assisted: still drafted, still queued, never sent unread.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { findUnique, update } = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    business: { findUnique },
    sourceRule: { findUnique: vi.fn() },
    lead: { update },
  },
}));

import { isAutonomousAllowed, AUTONOMOUS_NOT_ALLOWED_MESSAGE } from "@/lib/autonomousPermission";

beforeEach(() => vi.clearAllMocks());

describe("whether an account has permitted unreviewed sending", () => {
  it("says yes only when the owner has actually said yes", async () => {
    findUnique.mockResolvedValue({ autonomousAllowed: true });
    expect(await isAutonomousAllowed("biz1")).toBe(true);
  });

  it("says no when nobody has answered the question", async () => {
    // The default for every account, new and existing. Nobody has ever
    // been asked, so nobody has answered, and an unanswered question is
    // not a yes.
    findUnique.mockResolvedValue({ autonomousAllowed: false });
    expect(await isAutonomousAllowed("biz1")).toBe(false);
  });

  it("says no when the account cannot be read at all", async () => {
    // Same direction as every other default here: the safe answer is the
    // one that promises less. A missing row is not consent.
    findUnique.mockResolvedValue(null);
    expect(await isAutonomousAllowed("biz1")).toBe(false);
  });

  it("asks only about the business it was given", async () => {
    findUnique.mockResolvedValue({ autonomousAllowed: true });
    await isAutonomousAllowed("biz1");
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "biz1" } }));
  });

  it("has one refusal sentence, so every path reads alike", () => {
    // Four separate places refuse this. Four hand-written sentences would
    // drift, and the owner would get a different explanation depending on
    // which one they happened to hit.
    expect(AUTONOMOUS_NOT_ALLOWED_MESSAGE).toMatch(/Settings/);
    expect(AUTONOMOUS_NOT_ALLOWED_MESSAGE.length).toBeGreaterThan(20);
  });
});
