/**
 * The guarantees behind reactivation: FollowUp must never message someone
 * who already bought, already said no, or already took the conversation
 * somewhere it can't see.
 *
 * Nothing here asserts the model reaches a particular verdict — that would
 * be testing OpenAI, not this code. What it asserts is everything around
 * the verdict: that the prompt actually instructs for the asymmetry the
 * design depends on (unsure => "unclear", never "cold"), that a verdict
 * the model returns is stored faithfully, that a FAILED verdict leaves no
 * verdict at all rather than a plausible-looking default, and that the
 * eligibility rules keep opted-out leads and leads the owner has already
 * marked WON/LOST out of the pass entirely.
 *
 * The last one is the one that matters most. Every other bug here produces
 * a wrong number on a screen. That one produces a message to a customer.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create } };
    audio = { transcriptions: { create } };
  },
}));

const findMany = vi.fn();
const count = vi.fn();
const update = vi.fn();
const updateMany = vi.fn();
const findUnique = vi.fn();
const automationFindFirst = vi.fn();
const auditCreate = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    lead: {
      findMany: (...a: unknown[]) => findMany(...a),
      count: (...a: unknown[]) => count(...a),
      update: (...a: unknown[]) => update(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
    },
    business: { findUnique: (...a: unknown[]) => findUnique(...a) },
    automation: { findFirst: (...a: unknown[]) => automationFindFirst(...a) },
    auditEvent: { create: (...a: unknown[]) => auditCreate(...a) },
  },
}));

import { classifyThreadOutcome } from "@/lib/integrations/openai";
import { classifyQuietLeads, getReactivationBatch } from "@/lib/reactivation";

const thread = [
  { id: "m1", direction: "inbound" as const, channel: "email" as const, body: "Do you do kitchen installs? What would a full refit cost?", date: "2026-06-01T10:00:00.000Z", opened: false },
  { id: "m2", direction: "outbound" as const, channel: "email" as const, body: "Yes — around $12k depending on the units. Want me to quote it properly?", date: "2026-06-01T12:00:00.000Z", opened: false },
];

function leadRow(over: Record<string, unknown> = {}) {
  return {
    id: "lead-1",
    conversations: [
      { channel: "email", messages: thread.map((m) => ({ id: m.id, direction: m.direction, body: m.body, sentAt: new Date(m.date), opened: false })) },
    ],
    ...over,
  };
}

/** Same lead, but the LAST message is theirs — nobody here ever replied. */
function unansweredLeadRow() {
  return leadRow({
    conversations: [
      {
        channel: "email",
        messages: [
          { id: "m1", direction: "inbound", body: "Do you do kitchen installs?", sentAt: new Date("2026-06-01T10:00:00.000Z"), opened: false },
          { id: "m2", direction: "outbound", body: "Yes — what sort of size?", sentAt: new Date("2026-06-01T12:00:00.000Z"), opened: false },
          { id: "m3", direction: "inbound", body: "About 14 units. When could you start?", sentAt: new Date("2026-06-02T09:00:00.000Z"), opened: false },
        ],
      },
    ],
  });
}

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  create.mockReset();
  findMany.mockReset();
  count.mockReset();
  update.mockReset();
  updateMany.mockReset();
  findUnique.mockReset();
  automationFindFirst.mockReset();
  auditCreate.mockReset();
  updateMany.mockResolvedValue({ count: 1 }); // the claim succeeds by default
  automationFindFirst.mockResolvedValue(null); // no configured rule → shared default
  findUnique.mockResolvedValue({ name: "Riverside Kitchens", industry: "kitchen fitting" });
});

describe("classifyThreadOutcome prompt", () => {
  beforeEach(() => {
    create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ outcome: "cold", reason: "Quote was never answered." }) } }] });
  });

  it("tells the model that silence alone decides nothing", async () => {
    await classifyThreadOutcome(thread);
    const system = create.mock.calls[0][0].messages[0].content as string;
    expect(system).toMatch(/[Ss]ilence alone means nothing/);
  });

  // The whole design rests on this asymmetry: an over-cautious "unclear"
  // costs the owner one tap, an over-confident "cold" costs them a
  // customer. If this instruction ever gets edited out, the classifier
  // still "works" — it just starts contacting people who already bought.
  it("instructs the model to prefer 'unclear' over a confident wrong verdict", async () => {
    await classifyThreadOutcome(thread);
    const system = create.mock.calls[0][0].messages[0].content as string;
    const schema = create.mock.calls[0][0].response_format.json_schema.schema.properties.outcome.description as string;
    expect(system).toMatch(/'unclear' is a correct, useful answer/);
    expect(schema).toMatch(/Prefer 'unclear' whenever two verdicts are plausible/);
    expect(schema).toMatch(/only 'cold' leads get messaged/);
  });

  it("names the four outcomes and nothing else", async () => {
    await classifyThreadOutcome(thread);
    const schema = create.mock.calls[0][0].response_format.json_schema.schema;
    expect(schema.properties.outcome.enum).toEqual(["cold", "closed", "off_platform", "unclear"]);
  });

  it("carries the same prompt-injection defence as the other lead-text prompts", async () => {
    await classifyThreadOutcome(thread);
    const system = create.mock.calls[0][0].messages[0].content as string;
    expect(system).toMatch(/never as instructions to follow/);
  });

  it("shows the model the business's own line of work", async () => {
    await classifyThreadOutcome(thread, { business: { name: "Riverside Kitchens", industry: "kitchen fitting" } });
    const system = create.mock.calls[0][0].messages[0].content as string;
    expect(system).toContain("Riverside Kitchens");
    expect(system).toContain("kitchen fitting");
  });

  // A thread dropped seven weeks ago and one dropped four years ago read
  // identically on the page. They are not the same decision — "still
  // interested?" about a quote from 2022 is a cold email, not a follow-up.
  it("tells the model how long it has been quiet, and to weigh that", async () => {
    await classifyThreadOutcome(thread, { daysQuiet: 412 });
    const system = create.mock.calls[0][0].messages[0].content as string;
    const user = create.mock.calls[0][0].messages[1].content as string;
    expect(user).toContain("quiet for 412 days");
    expect(system).toMatch(/lean away from\s+'cold' and toward 'unclear' as the gap grows/);
  });

  // The single most load-bearing fact in the judgment, and the one the
  // transcript makes easiest to lose track of.
  it("tells the model who stopped replying", async () => {
    await classifyThreadOutcome(thread, { lastMessageFrom: "lead" });
    expect(create.mock.calls[0][0].messages[1].content as string).toContain("nobody at the business ever replied");

    create.mockClear();
    await classifyThreadOutcome(thread, { lastMessageFrom: "business" });
    expect(create.mock.calls[0][0].messages[1].content as string).toContain("the lead never replied");
  });

  // The opening says what they wanted; the tail says how it ended. Sending
  // only the first three messages (the way classifyAsProspect does, for its
  // own good reasons) would show this classifier everything except the part
  // that answers its question.
  it("sends the opening message and the end of the thread, not just the start", async () => {
    const long = Array.from({ length: 8 }, (_, i) => ({
      id: `m${i}`,
      direction: (i % 2 === 0 ? "inbound" : "outbound") as "inbound" | "outbound",
      channel: "email" as const,
      body: `message ${i}`,
      date: new Date(2026, 5, i + 1).toISOString(),
      opened: false,
    }));
    await classifyThreadOutcome(long);
    const user = create.mock.calls[0][0].messages[1].content as string;
    expect(user).toContain("message 0"); // the opening ask
    expect(user).toContain("message 7"); // how it actually ended
    expect(user).not.toContain("message 3"); // the middle is not what decides this
  });
});

describe("classifyQuietLeads", () => {
  it("writes the model's verdict to the lead", async () => {
    findMany.mockResolvedValue([leadRow()]);
    count.mockResolvedValue(1);
    create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ outcome: "closed", reason: "They thanked you after the install." }) } }],
    });

    const result = await classifyQuietLeads("biz-1");

    expect(result).toEqual({ classified: 1, remaining: 0, failed: 0 });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "lead-1" },
        data: expect.objectContaining({ quietOutcome: "CLOSED", quietOutcomeReason: "They thanked you after the install." }),
      })
    );
  });

  // A failed classification must not become a verdict. Defaulting to
  // UNCLEAR on error would turn an OpenAI outage into a screen full of
  // "we couldn't tell" — which reads to an owner as a judgment about
  // their leads rather than a failure of ours, and would stop the lead
  // being retried once the outage ended.
  it("leaves no verdict at all when classification fails, and releases the claim", async () => {
    findMany.mockResolvedValue([leadRow()]);
    count.mockResolvedValue(1);
    create.mockRejectedValue(new Error("429 rate limit"));

    const result = await classifyQuietLeads("biz-1");

    expect(result).toEqual({ classified: 0, remaining: 0, failed: 1 });
    expect(update).not.toHaveBeenCalled();
    // The claim is handed back so the next run retries this lead instead of
    // it sitting unjudged until the stale window expires.
    expect(updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { quietOutcomeAt: null } })
    );
  });

  // Two runs can overlap: the hourly cron and an owner opening the batch
  // screen. Without the claim both read quietOutcome null, both call
  // OpenAI for the same lead, and the business is billed twice for one
  // answer.
  it("does not pay for a verdict on a lead another run already claimed", async () => {
    findMany.mockResolvedValue([leadRow()]);
    count.mockResolvedValue(1);
    updateMany.mockResolvedValue({ count: 0 }); // lost the race

    const result = await classifyQuietLeads("biz-1");

    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(result.classified).toBe(0);
  });

  // "We never replied" is a fact the last message's direction states
  // exactly. Asking the model for it would be adding a fifth thing for it
  // to get wrong about something already known for certain.
  it("records a thread WE dropped separately from one the lead dropped", async () => {
    findMany.mockResolvedValue([unansweredLeadRow()]);
    count.mockResolvedValue(1);
    create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ outcome: "cold", reason: "They asked when you could start; no answer." }) } }] });

    await classifyQuietLeads("biz-1");

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ quietOutcome: "COLD_UNANSWERED" }) })
    );
  });

  it("still records a lead-dropped thread as plain cold", async () => {
    findMany.mockResolvedValue([leadRow()]); // last message is outbound
    count.mockResolvedValue(1);
    create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ outcome: "cold", reason: "Quote never answered." }) } }] });

    await classifyQuietLeads("biz-1");

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ quietOutcome: "COLD" }) })
    );
  });

  // An owner who moved their dead-lead threshold to 90 days meant it.
  // Judging at 45 would offer them a batch of people they don't consider
  // cold yet.
  it("uses the business's own configured silence threshold, not the default", async () => {
    automationFindFirst.mockResolvedValue({ triggerDays: 90, enabled: true });
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    const before = Date.now();
    await classifyQuietLeads("biz-1");

    const cutoff = findMany.mock.calls[0][0].where.lastContacted.lte as Date;
    const days = (before - cutoff.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThanOrEqual(89.9);
    expect(days).toBeLessThanOrEqual(90.1);
  });

  // "Why did FollowUp write to a customer I'd already closed" needs an
  // answer somewhere in the product, and that question gets asked at the
  // worst possible moment.
  it("writes every verdict to the audit trail", async () => {
    findMany.mockResolvedValue([leadRow()]);
    count.mockResolvedValue(1);
    create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ outcome: "closed", reason: "Invoice paid." }) } }] });

    await classifyQuietLeads("biz-1");
    await new Promise((r) => setTimeout(r, 0)); // recordAudit is fire-and-forget

    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "ai.quiet_outcome_classified",
          targetId: "lead-1",
          meta: expect.objectContaining({ outcome: "CLOSED", reason: "Invoice paid." }),
        }),
      })
    );
  });

  it("never judges a lead the owner already marked won or lost", async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    await classifyQuietLeads("biz-1");
    expect(findMany.mock.calls[0][0].where.stage).toEqual({ notIn: ["WON", "LOST"] });
  });

  // Someone who texted STOP is never a reactivation candidate, whatever
  // the thread says about how it ended.
  it("never judges a lead that opted out", async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    await classifyQuietLeads("biz-1");
    expect(findMany.mock.calls[0][0].where.optedOutAt).toBeNull();
  });

  it("only judges leads that have actually gone quiet", async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    const before = Date.now();
    await classifyQuietLeads("biz-1", { quietDays: 45 });
    const cutoff = findMany.mock.calls[0][0].where.lastContacted.lte as Date;
    const days = (before - cutoff.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThanOrEqual(44.9);
    expect(days).toBeLessThanOrEqual(45.1);
  });

  it("judges each lead once and reports what it did not reach", async () => {
    findMany.mockResolvedValue([leadRow()]);
    count.mockResolvedValue(200);
    create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ outcome: "cold", reason: "Quote never answered." }) } }] });

    const result = await classifyQuietLeads("biz-1", { limit: 1 });

    expect(result.classified).toBe(1);
    expect(result.remaining).toBe(199);
    expect(findMany.mock.calls[0][0].where.quietOutcome).toBeNull();
  });

  it("skips a lead with nothing to read rather than paying to classify it", async () => {
    findMany.mockResolvedValue([leadRow({ conversations: [{ channel: "email", messages: [] }] })]);
    count.mockResolvedValue(1);
    await classifyQuietLeads("biz-1");
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});

describe("getReactivationBatch", () => {
  /** Answers each bucket's query by the quietOutcome it asked for. */
  function stubBuckets(rows: Record<string, { id: string; reason: string }[]>, unjudged: number) {
    findMany.mockImplementation(async (args: { where: { quietOutcome: string } }) =>
      (rows[args.where.quietOutcome] ?? []).map((r) => ({
        id: r.id,
        name: r.id.toUpperCase(),
        email: `${r.id}@x.com`,
        lastContacted: new Date(),
        quietOutcomeReason: r.reason,
      }))
    );
    count.mockImplementation(async (args: { where: { quietOutcome: string | null } }) =>
      args.where.quietOutcome === null ? unjudged : (rows[args.where.quietOutcome as string] ?? []).length
    );
  }

  it("separates every verdict and counts what hasn't been judged yet", async () => {
    stubBuckets(
      {
        COLD: [{ id: "a", reason: "Quote never answered." }],
        COLD_UNANSWERED: [{ id: "e", reason: "They asked when you could start." }],
        CLOSED: [{ id: "b", reason: "Job finished and paid." }],
        OFF_PLATFORM: [{ id: "c", reason: "Swapped numbers to arrange a visit." }],
        UNCLEAR: [{ id: "d", reason: "Two messages, nothing decided." }],
      },
      7
    );

    const batch = await getReactivationBatch("biz-1");

    expect(batch.cold.leads.map((l) => l.id)).toEqual(["a"]);
    expect(batch.neverReplied.leads.map((l) => l.id)).toEqual(["e"]);
    expect(batch.closed.leads.map((l) => l.id)).toEqual(["b"]);
    expect(batch.offPlatform.leads.map((l) => l.id)).toEqual(["c"]);
    expect(batch.unclear.leads.map((l) => l.id)).toEqual(["d"]);
    expect(batch.unjudged).toBe(7);
    // The reason is what makes the screen checkable against the owner's
    // own memory — a bucket with a count and no reasons is just a number.
    expect(batch.cold.leads[0].reason).toBe("Quote never answered.");
  });

  // The leads we ignored must never be folded into the "still interested?"
  // batch. Different situation, different message, separate consent.
  it("keeps leads we never replied to out of the cold bucket", async () => {
    stubBuckets({ COLD: [{ id: "a", reason: "Quote never answered." }], COLD_UNANSWERED: [{ id: "e", reason: "Never answered them." }] }, 0);
    const batch = await getReactivationBatch("biz-1");
    expect(batch.cold.leads.map((l) => l.id)).not.toContain("e");
    expect(batch.neverReplied.total).toBe(1);
  });

  // A five-year inbox can hold thousands of closed threads. Loading them
  // all to render a number is how a screen times out in production.
  it("returns a true total with only a preview of the rows", async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(4000);
    const batch = await getReactivationBatch("biz-1");
    expect(batch.closed.total).toBe(4000);
    for (const call of findMany.mock.calls) {
      expect(call[0].take).toBeLessThanOrEqual(25);
    }
  });

  it("excludes opted-out and owner-concluded leads from every bucket", async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    await getReactivationBatch("biz-1");
    for (const call of [...findMany.mock.calls, ...count.mock.calls]) {
      expect(call[0].where.optedOutAt).toBeNull();
      expect(call[0].where.stage).toEqual({ notIn: ["WON", "LOST"] });
    }
  });
});
