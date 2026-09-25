/**
 * Security audit 2026-09-26, A-4: the hot-lead Slack line interpolated a
 * lead's name, company and the AI's summary of their message — all typed
 * by a stranger through the public embed form — straight into Slack
 * mrkdwn. `<https://evil.example|Stripe payout failed>` became a
 * disguised link in the founder's Slack, and `<!channel>` paged the whole
 * channel.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { findUnique, update, updateMany } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(async () => ({})),
  updateMany: vi.fn(async () => ({ count: 1 })),
}));
vi.mock("@/lib/db", () => ({ prisma: { lead: { findUnique, update, updateMany }, notification: { create: vi.fn() } } }));

vi.mock("@/lib/integrations/openai", () => ({
  scoreLead: vi.fn(async () => ({ score: 95, reason: "Ready to buy <!here> <https://evil.example|verify>", factors: [] })),
  generateFollowUpMessage: vi.fn(async () => ({ subject: "Re: your question", body: "Happy to help." })),
}));
vi.mock("@/lib/sender", () => ({
  composeFollowUpEmail: vi.fn(async (_first: string, _biz: string, body: string) => `Hi,\n\n${body}`),
  latestInboundText: vi.fn(() => undefined),
}));
vi.mock("@/lib/voice", () => ({ getVoiceSamples: vi.fn(async () => []) }));
vi.mock("@/lib/leadLanguage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/leadLanguage")>()),
  detectLeadLanguage: vi.fn(async () => null),
}));
vi.mock("@/lib/billing", () => ({ checkAiEligibility: vi.fn(async () => ({ ok: true })) }));

const { notifySlack } = vi.hoisted(() => ({ notifySlack: vi.fn(async () => undefined) }));
vi.mock("@/lib/slack", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/slack")>()),
  notifySlack,
}));

import { escapeSlackText } from "@/lib/slack";
import { scoreAndDraftForLead } from "@/lib/scoring";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
});

describe("escapeSlackText", () => {
  it("escapes exactly Slack's three control characters", () => {
    expect(escapeSlackText("<!channel> & <https://x.example|y>")).toBe("&lt;!channel&gt; &amp; &lt;https://x.example|y&gt;");
  });

  it("leaves ordinary text alone", () => {
    expect(escapeSlackText("Priya Shah (Acme) — asked for a quote")).toBe("Priya Shah (Acme) — asked for a quote");
  });
});

describe("the hot-lead Slack line", () => {
  it("cannot carry a link or a channel ping from a stranger's form fields", async () => {
    findUnique.mockResolvedValue({
      id: "lead1",
      businessId: "biz1",
      name: "<https://evil.example/login|Your Stripe payout failed — verify now>",
      company: "<!channel>",
      priority: "NONE",
      assignedToId: null,
      source: "Website form",
      createdAt: new Date("2026-09-05T12:00:00Z"),
      dealValue: 0,
      lastContacted: null,
      business: { tier: "plus" },
      language: null,
      languageScript: null,
      languageRegister: null,
      languageSetAt: null,
      conversations: [
        { channel: "web", messages: [{ id: "m1", direction: "inbound", body: "Buying today", sentAt: new Date(), opened: false }] },
      ],
    });

    await scoreAndDraftForLead("lead1");

    expect(notifySlack).toHaveBeenCalledTimes(1);
    const text = (notifySlack.mock.calls[0] as unknown as [string])[0];
    expect(text).not.toMatch(/[<>]/);
    expect(text).toContain("&lt;https://evil.example/login|Your Stripe payout failed");
    expect(text).toContain("&lt;!channel&gt;");
    expect(text).toContain("&lt;!here&gt;");
  });
});
