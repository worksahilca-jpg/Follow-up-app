/**
 * task: scoreAndDraftForLead is the one chokepoint every capture path
 * (Gmail/Outlook sync, CRM sync, and — via scoreUnscoredLeads-style
 * callers — everything else) calls after creating or updating a lead's
 * conversation, which is exactly why Free tier's "AI processing pauses"
 * restriction lives here rather than at each of the ~10 capture routes
 * (research/market/2026-09-11-tier-pricing-recommendation.md §2.2).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { findUnique, update, updateMany } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(async () => ({})),
  // The refusal path's one write — see "records WHY it skipped" below.
  updateMany: vi.fn(async () => ({ count: 1 })),
}));
vi.mock("@/lib/db", () => ({ prisma: { lead: { findUnique, update, updateMany } } }));

vi.mock("@/lib/integrations/openai", () => ({
  scoreLead: vi.fn(async () => ({ score: 80, reason: "Asked about pricing", factors: [] })),
  generateFollowUpMessage: vi.fn(async () => ({ subject: "Re: your question", body: "Happy to help." })),
}));
vi.mock("@/lib/sender", () => ({
  composeFollowUpEmail: vi.fn(async (_first: string, _biz: string, body: string) => `Hi,\n\n${body}`),
  latestInboundText: vi.fn(() => undefined),
}));
vi.mock("@/lib/voice", () => ({ getVoiceSamples: vi.fn(async () => []) }));

// How a lead writes, decided once from their first message.
const { detect } = vi.hoisted(() => ({ detect: vi.fn(async () => null as unknown) }));
vi.mock("@/lib/leadLanguage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/leadLanguage")>()),
  detectLeadLanguage: detect,
}));

// One gate for every tier since 2026-09-15, not two Free-only helpers:
// Plus's 1,500/mo and Pro's 10,000/mo were published policy with nothing
// enforcing them, so a paid account had no AI ceiling at all.
const { aiEligible } = vi.hoisted(() => ({
  aiEligible: vi.fn(
    async (): Promise<{ ok: true } | { ok: false; reason: string; ownerMessage: string }> => ({ ok: true })
  ),
}));
vi.mock("@/lib/billing", () => ({ checkAiEligibility: aiEligible }));

/** update()'s recorded arguments, typed — see the note at its one use. */
function updateCalls(): Array<{ data: Record<string, unknown> }> {
  return update.mock.calls.map((c) => (c as unknown as [{ data: Record<string, unknown> }])[0]);
}

import { scoreAndDraftForLead } from "@/lib/scoring";
import { generateFollowUpMessage as generateFollowUpMessageMock } from "@/lib/integrations/openai";
import { Prisma } from "@prisma/client";

const generateFollowUpMessage = generateFollowUpMessageMock as unknown as ReturnType<typeof vi.fn>;

function leadRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead1",
    businessId: "biz1",
    name: "Priya",
    priority: "NONE",
    assignedToId: null,
    source: "Gmail",
    createdAt: new Date("2026-09-05T12:00:00Z"),
    dealValue: 0,
    lastContacted: null,
    business: { tier: "plus" },
    language: null,
    languageScript: null,
    languageRegister: null,
    languageSetAt: null,
    conversations: [
      { channel: "email", messages: [{ id: "m1", direction: "inbound", body: "What's the price?", sentAt: new Date(), opened: false }] },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  generateFollowUpMessage.mockResolvedValue({ subject: "Re: your question", body: "Happy to help." });
  findUnique.mockResolvedValue(leadRow());
  aiEligible.mockResolvedValue({ ok: true });
  detect.mockResolvedValue(null);
});

describe("scoreAndDraftForLead — the tier's AI allowance", () => {
  // Was "without even asking the Free-tier checks" until 2026-09-15, which
  // is exactly what left Plus and Pro unbounded. A paid tier is checked
  // against its OWN ceiling, so a normal customer notices nothing.
  it("checks a paid business against its own tier, not Free's", async () => {
    const ok = await scoreAndDraftForLead("lead1");
    expect(ok).toBe(true);
    expect(aiEligible).toHaveBeenCalledWith("biz1", expect.anything(), "plus");
    expect(update).toHaveBeenCalled();
  });

  it("skips scoring once the gate refuses", async () => {
    findUnique.mockResolvedValue(leadRow({ business: { tier: "free" } }));
    aiEligible.mockResolvedValue({ ok: false, reason: "past this month's 20-lead AI cap on the Free plan", ownerMessage: "Paused." });
    const ok = await scoreAndDraftForLead("lead1");
    expect(ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  // 2026-09-19: the refusal used to end at `return false`, verdict kept
  // and reasoning dropped. The owner was left with a lead that had no
  // score, no draft and nothing saying why — which reads as a broken
  // product rather than a working one exercising a limit.
  it("records WHY it skipped, on the lead, in the owner's words", async () => {
    findUnique.mockResolvedValue(leadRow({ business: { tier: "free" }, source: "Instagram" }));
    aiEligible.mockResolvedValue({
      ok: false,
      reason: "on a channel the Free plan doesn't cover",
      ownerMessage: "This lead came in on instagram, which the Free plan doesn't cover, so FollowUp didn't read it or write a reply.",
    });

    await scoreAndDraftForLead("lead1");

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "lead1" },
      // The whole sentence, not the run-summary fragment.
      data: { aiPausedReason: "This lead came in on instagram, which the Free plan doesn't cover, so FollowUp didn't read it or write a reply." },
    });
  });

  it("clears the pause the moment a score actually lands, so a fixed account stops explaining itself", async () => {
    await scoreAndDraftForLead("lead1");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ aiPausedReason: null }) })
    );
  });

  it("passes the lead itself, so the gate can rank it and read its channel", async () => {
    findUnique.mockResolvedValue(leadRow({ business: { tier: "free" }, source: "WhatsApp" }));
    await scoreAndDraftForLead("lead1");
    expect(aiEligible).toHaveBeenCalledWith(
      "biz1",
      expect.objectContaining({ source: "WhatsApp" }),
      "free"
    );
  });

  it("still scores a Free-tier lead the gate allows", async () => {
    findUnique.mockResolvedValue(leadRow({ business: { tier: "free" } }));
    const ok = await scoreAndDraftForLead("lead1");
    expect(ok).toBe(true);
    expect(update).toHaveBeenCalled();
  });

  it("still returns false with no OPENAI_API_KEY, before ever touching the Free-tier checks", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const ok = await scoreAndDraftForLead("lead1");
    expect(ok).toBe(false);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("still returns false for a lead with no messages yet, after the Free-tier checks pass", async () => {
    findUnique.mockResolvedValue(leadRow({ conversations: [] }));
    const ok = await scoreAndDraftForLead("lead1");
    expect(ok).toBe(false);
  });
});

/**
 * The suggested reply takes the shape of the channel the lead last wrote
 * on. Before this, a lead who wrote on Instagram got an email — greeting,
 * sign-off, subject — as their suggested DM, and that is what the
 * automation pass sent into their inbox.
 */
describe("scoreAndDraftForLead — DM-shaped drafts for Instagram and Messenger leads", () => {
  const dmDraft = { subject: "", body: "Happy to price the two-bed. Is this for this week or later in the month?", buttons: [{ title: "This week", exit: false }, { title: "Later", exit: false }] };

  it("stores the bare DM body, no subject, and the buttons beside it", async () => {
    generateFollowUpMessage.mockResolvedValue(dmDraft);
    findUnique.mockResolvedValue(leadRow({ conversations: [{ channel: "instagram", messages: [{ id: "m1", direction: "inbound", body: "How much for a two-bed clean?", sentAt: new Date(), opened: false }] }] }));
    await scoreAndDraftForLead("lead1");
    expect(generateFollowUpMessage.mock.calls[0][3]).toEqual(expect.objectContaining({ id: "price_unanswered" }));
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          suggestedMessage: dmDraft.body,
          suggestedSubject: null,
          suggestedQuickReplies: { question: "price_unanswered", buttons: dmDraft.buttons },
        }),
      })
    );
  });

  it("keeps the draft but stores NO buttons when it fails the shape check twice", async () => {
    generateFollowUpMessage.mockResolvedValue({ subject: "", body: "Is it a two-bed? And is this week ok?", buttons: dmDraft.buttons });
    findUnique.mockResolvedValue(leadRow({ conversations: [{ channel: "messenger", messages: [{ id: "m1", direction: "inbound", body: "How much for a two-bed clean?", sentAt: new Date(), opened: false }] }] }));
    await scoreAndDraftForLead("lead1");
    expect(generateFollowUpMessage).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ suggestedQuickReplies: { question: "price_unanswered", buttons: [] } }) })
    );
  });

  it("still frames an email lead's draft and stores no buttons", async () => {
    await scoreAndDraftForLead("lead1");
    expect(generateFollowUpMessage.mock.calls[0][3]).toBeUndefined();
    const data = (update.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(data.suggestedMessage).toBe("Hi,\n\nHappy to help.");
    expect(data.suggestedSubject).toBe("Re: your question");
    expect(data.suggestedQuickReplies).toEqual(Prisma.JsonNull);
  });
});

/**
 * The founder's instruction, 2026-09-19: replies in "the same language
 * and same tone". Language was already matched per message; tone was
 * not, because nothing was stored and every message decided again. The
 * value is entirely in deciding ONCE — a thread that opens with usted
 * and follows up with tú reads to a native speaker the way "Dear Mr.
 * Smith… hey dude" reads in English.
 */
describe("scoreAndDraftForLead — deciding how a lead writes, once", () => {
  it("detects and stores language, script and register on a lead nobody has judged yet", async () => {
    detect.mockResolvedValue({ language: "es", script: "Latn", register: "formal" });

    await scoreAndDraftForLead("lead1");

    expect(detect).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          language: "es",
          languageScript: "Latn",
          languageRegister: "formal",
          languageSetAt: expect.any(Date),
        }),
      })
    );
  });

  it("never re-decides a lead already judged — that consistency IS the feature", async () => {
    findUnique.mockResolvedValue(
      leadRow({ language: "es", languageScript: "Latn", languageRegister: "usted" as unknown, languageSetAt: new Date("2026-09-01") })
    );

    await scoreAndDraftForLead("lead1");

    expect(detect).not.toHaveBeenCalled();
  });

  // A failed detection must leave the flag null so the NEXT message gets
  // a try. Stamping it anyway would freeze a lead whose first message
  // was "ok thanks" into "unknown" forever.
  it("leaves the lead undecided when the message told it nothing, so it can ask again", async () => {
    detect.mockResolvedValue(null);

    await scoreAndDraftForLead("lead1");

    // Typed on the way in rather than cast on the way out: an untyped
    // vi.fn() infers mock.calls as an empty tuple, which tsc rejects on
    // indexing (the same trap betaPlan.test.ts documents).
    const data = updateCalls()[0].data;
    expect(data).not.toHaveProperty("languageSetAt");
    expect(data).not.toHaveProperty("language");
  });

  it("passes the decision into the draft, so the reply is written to it", async () => {
    detect.mockResolvedValue({ language: "es", script: "Latn", register: "formal" });

    await scoreAndDraftForLead("lead1");

    expect(generateFollowUpMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      undefined,
      undefined,
      { language: "es", script: "Latn", register: "formal" }
    );
  });
});
