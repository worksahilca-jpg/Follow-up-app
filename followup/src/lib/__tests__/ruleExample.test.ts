/**
 * "See an example" (A-044): a real customer that fits the rule, the rule's
 * own instructions, and nothing stored or sent.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { gen, ack, dm } = vi.hoisted(() => ({ gen: vi.fn(), ack: vi.fn(), dm: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/integrations/openai", () => ({ generateFollowUpMessage: gen, generateInstantReply: ack }));
vi.mock("@/lib/dmDrafting", () => ({ draftDm: dm }));
vi.mock("@/lib/voice", () => ({ getVoiceSamples: vi.fn(async () => []) }));
vi.mock("@/lib/sender", () => ({ getSenderFirstName: vi.fn(async () => "Sahil") }));

import { pickExampleLead, writeRuleExample } from "@/lib/ruleExample";
import type { Lead } from "@/lib/types";

const NOW = new Date("2026-09-26T16:00:00Z");
const d = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString();
function lead(id: string, dir: "inbound" | "outbound", daysAgo: number, channel = "email", stage = "new"): Lead {
  return {
    id, name: `${id} Test`, stage, lastContacted: d(daysAgo), languageRead: null,
    conversation: [{ id: "m", direction: dir, channel, body: "hello", date: d(daysAgo) }],
  } as unknown as Lead;
}
beforeEach(() => vi.clearAllMocks());

describe("which customer the example is for", () => {
  const leads = [lead("Wrote", "inbound", 1), lead("Quiet", "outbound", 3), lead("LongQuiet", "outbound", 60), lead("Won", "outbound", 1, "email", "won")];
  it("uses someone waiting on a reply for the reply rule", () => {
    expect(pickExampleLead(leads, "unanswered")?.id).toBe("Wrote");
  });
  it("uses the most recent quiet customer for check-ins, never a closed one", () => {
    expect(pickExampleLead(leads, "silence")?.id).toBe("Quiet");
  });
  it("uses the one quiet longest for the welcome back", () => {
    expect(pickExampleLead(leads, "dead_lead_reactivation")?.id).toBe("LongQuiet");
  });
  it("skips who was already shown, and says nothing when nobody fits", () => {
    expect(pickExampleLead(leads, "unanswered", ["Wrote"])).toBeNull();
  });
});

describe("writing it", () => {
  it("steers a check-in with the rule's own hint and returns only text", async () => {
    gen.mockResolvedValue({ subject: "s", body: "Hi, checking in." });
    const ex = await writeRuleExample("biz", lead("Quiet", "outbound", 3), "silence", {}, NOW);
    expect(ex).toEqual({ text: "Hi, checking in.", what: "the first check-in" });
    expect(gen.mock.calls[0][2]).toMatch(/nudge/i);
  });
  it("writes a DM for an Instagram customer", async () => {
    dm.mockResolvedValue({ body: "Hey!", quickReplies: [], shapeFailed: null });
    const l = lead("Ig", "inbound", 1, "instagram");
    expect((await writeRuleExample("biz", l, "unanswered", {}, NOW)).text).toBe("Hey!");
    expect(gen).not.toHaveBeenCalled();
  });
  it("uses the instant-reply writer for the thank-you", async () => {
    ack.mockResolvedValue("Thanks Wrote!");
    expect((await writeRuleExample("biz", lead("Wrote", "inbound", 1), "instant_ack", {}, NOW)).what).toBe("the first thank-you");
    expect(ack).toHaveBeenCalledWith(expect.objectContaining({ ownerFirstName: "Sahil" }));
  });
});
