/**
 * getVoiceSamples (src/lib/voice.ts) is the only thing that can make a
 * draft read like the specific person whose name is on it, so what goes
 * into it decides whether the feature works or actively hurts.
 *
 * The failure it must not have: FollowUp's own past sends are outbound
 * Messages too (sendFollowUpToLead writes one for every send), and they
 * are a model's words inside composeFollowUpEmail's fixed frame. Sampling
 * them teaches the model to imitate itself, and the business's voice
 * drifts toward the machine with every pass. Same for Meta's Business AI
 * echoes and the voice agent's spoken turns.
 *
 * The second requirement is recency: the corpus should be how the owner
 * writes now, not whatever their oldest surviving thread looked like.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    message: { findMany: vi.fn() },
    followUp: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { getVoiceSamples } from "@/lib/voice";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;

const HUMAN_A =
  "Hi Sam,\n\nGot your message. Can do Tuesday morning, the lads will be there by 8. Any issue give me a ring.\n\nBest,\nDave";
const HUMAN_B =
  "Priced it up this morning — 2,400 all in including the skip, and we'd need the drive clear on the day.";
const MACHINE =
  "Hi Sam,\n\nI wanted to follow up on your enquiry about the roof. Are you still looking to get that scheduled this month?\n\nBest,\nDave";

type Row = {
  id: string;
  body: string;
  sentAt: Date;
  leadId: string;
  source?: string | null;
};

function message(row: Row) {
  return {
    id: row.id,
    body: row.body,
    sentAt: row.sentAt,
    conversation: { leadId: row.leadId },
  };
}

/** Serve `rows` newest-first through the cursor pagination voice.ts uses. */
function servePages(rows: Row[]) {
  p.message.findMany.mockImplementation(async (args: { take: number; cursor?: { id: string } }) => {
    const start = args.cursor ? rows.findIndex((r) => r.id === args.cursor!.id) + 1 : 0;
    return rows.slice(start, start + args.take).map(message);
  });
}

function serveFollowUps(rows: { leadId: string; message: string | null; sentAt: Date | null }[]) {
  p.followUp.findMany.mockImplementation(async (args: { where: { leadId: { in: string[] } } }) =>
    rows.filter((r) => args.where.leadId.in.includes(r.leadId))
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  p.message.findMany.mockResolvedValue([]);
  p.followUp.findMany.mockResolvedValue([]);
});

describe("getVoiceSamples — the corpus is human-written", () => {
  it("excludes a message FollowUp sent itself, matched against its own FollowUp row", async () => {
    servePages([
      { id: "m1", body: MACHINE, sentAt: new Date("2026-09-14T10:00:00Z"), leadId: "lead1" },
      { id: "m2", body: HUMAN_B, sentAt: new Date("2026-09-10T10:00:00Z"), leadId: "lead2" },
    ]);
    serveFollowUps([{ leadId: "lead1", message: MACHINE, sentAt: new Date("2026-09-14T10:00:00Z") }]);

    expect(await getVoiceSamples("biz1")).toEqual([HUMAN_B]);
  });

  it("excludes the provider's re-ingested copy of a FollowUp send, whose body won't match byte-for-byte", async () => {
    // Outlook sends don't carry an externalId back into the Message row, so
    // sync writes a second row with the provider's own rendering and its
    // own timestamp. Only the send time ties it to the FollowUp row.
    servePages([
      {
        id: "m1",
        body: `${MACHINE}\n\n> On Monday you wrote:\n> is the quote still good`,
        sentAt: new Date("2026-09-14T10:00:12Z"),
        leadId: "lead1",
      },
      { id: "m2", body: HUMAN_B, sentAt: new Date("2026-09-10T10:00:00Z"), leadId: "lead2" },
    ]);
    serveFollowUps([{ leadId: "lead1", message: MACHINE, sentAt: new Date("2026-09-14T10:00:00Z") }]);

    expect(await getVoiceSamples("biz1")).toEqual([HUMAN_B]);
  });

  it("keeps a human message sent to a lead FollowUp has also messaged, at a different time", async () => {
    // The exclusion is per-send, not per-lead: a lead that once got an
    // automated follow-up must not blacklist everything the owner ever
    // typed to that same person.
    servePages([
      { id: "m1", body: HUMAN_A, sentAt: new Date("2026-09-14T15:00:00Z"), leadId: "lead1" },
      { id: "m2", body: MACHINE, sentAt: new Date("2026-09-14T10:00:00Z"), leadId: "lead1" },
    ]);
    serveFollowUps([{ leadId: "lead1", message: MACHINE, sentAt: new Date("2026-09-14T10:00:00Z") }]);

    expect(await getVoiceSamples("biz1")).toEqual([HUMAN_A]);
  });

  it("asks the database for neither third-party echoes nor spoken turns", async () => {
    await getVoiceSamples("biz1");
    const where = p.message.findMany.mock.calls[0][0].where;
    // Meta's Business AI / native-app replies (Message.source, set by
    // captureDirectReply) are machine or unattributable, either way not
    // evidence of how this business writes.
    expect(where.source).toBeNull();
    // The voice agent's own turns are written as outbound messages.
    expect(where.conversation.channel.notIn).toContain("voice-agent");
    expect(where.conversation.lead).toEqual({ businessId: "biz1" });
    expect(where.direction).toBe("outbound");
  });

  it("scopes every follow-up lookup to leads from this business's own messages", async () => {
    servePages([{ id: "m1", body: HUMAN_A, sentAt: new Date("2026-09-14T15:00:00Z"), leadId: "lead1" }]);
    serveFollowUps([]);
    await getVoiceSamples("biz1");
    expect(p.followUp.findMany.mock.calls[0][0].where.leadId.in).toEqual(["lead1"]);
  });
});

describe("getVoiceSamples — the corpus is recent", () => {
  it("reads newest-first", async () => {
    await getVoiceSamples("biz1");
    expect(p.message.findMany.mock.calls[0][0].orderBy).toEqual([{ sentAt: "desc" }, { id: "desc" }]);
  });

  it("prefers recent human mail over an old thread", async () => {
    const rows: Row[] = [];
    for (let i = 0; i < 6; i++) {
      rows.push({
        id: `new${i}`,
        body: `${HUMAN_B} Reference ${i}, quoted this week.`,
        sentAt: new Date(2026, 8, 14 - i),
        leadId: `lead${i}`,
      });
    }
    for (let i = 0; i < 6; i++) {
      rows.push({
        id: `old${i}`,
        body: `${HUMAN_A}\n\nArchive ${i}, from years ago.`,
        sentAt: new Date(2019, 0, 1 + i),
        leadId: "ancient",
      });
    }
    servePages(rows);

    const samples = await getVoiceSamples("biz1");
    expect(samples).toHaveLength(5);
    expect(samples.every((s) => s.includes("quoted this week"))).toBe(true);
  });

  it("walks past a page of FollowUp sends to reach the human mail underneath", async () => {
    // An account that automates heavily has hundreds of its own sends
    // sitting on top of the owner's real mail. One page of recent outbound
    // would find nothing human and starve the feature.
    const rows: Row[] = [];
    const sends: { leadId: string; message: string | null; sentAt: Date | null }[] = [];
    for (let i = 0; i < 200; i++) {
      const sentAt = new Date(2026, 8, 14, 9, 0, i);
      rows.push({ id: `auto${i}`, body: `${MACHINE} ${i}`, sentAt, leadId: `auto-lead${i}` });
      sends.push({ leadId: `auto-lead${i}`, message: `${MACHINE} ${i}`, sentAt });
    }
    rows.push({ id: "human", body: HUMAN_B, sentAt: new Date(2026, 7, 1), leadId: "lead-human" });
    servePages(rows);
    serveFollowUps(sends);

    expect(await getVoiceSamples("biz1")).toEqual([HUMAN_B]);
    expect(p.message.findMany.mock.calls.length).toBeGreaterThan(1);
  });

  it("spreads samples across leads instead of letting one chatty thread supply all five", async () => {
    const rows: Row[] = [];
    for (let i = 0; i < 6; i++) {
      rows.push({ id: `chat${i}`, body: `${HUMAN_A} Thread note ${i}.`, sentAt: new Date(2026, 8, 14, 9, 0, 60 - i), leadId: "chatty" });
    }
    for (let i = 0; i < 3; i++) {
      rows.push({ id: `other${i}`, body: `${HUMAN_B} Other lead ${i}.`, sentAt: new Date(2026, 8, 13, 9, 0, 60 - i), leadId: `other${i}` });
    }
    servePages(rows);

    const samples = await getVoiceSamples("biz1");
    expect(samples).toHaveLength(5);
    expect(samples.filter((s) => s.includes("Thread note"))).toHaveLength(2);
    expect(samples.filter((s) => s.includes("Other lead"))).toHaveLength(3);
  });

  it("still fills up from one lead when that is all there is", async () => {
    const rows: Row[] = [];
    for (let i = 0; i < 6; i++) {
      rows.push({ id: `only${i}`, body: `${HUMAN_A} Note ${i}.`, sentAt: new Date(2026, 8, 14, 9, 0, 60 - i), leadId: "only-lead" });
    }
    servePages(rows);
    expect(await getVoiceSamples("biz1")).toHaveLength(5);
  });
});

describe("getVoiceSamples — degrading and sample shape", () => {
  it("returns nothing at all when every outbound message was sent by FollowUp", async () => {
    // The no-samples branch of generateFollowUpMessage states its own
    // default style; an empty list is the correct, honest answer and is
    // strictly better than a machine-written sample.
    const rows: Row[] = [];
    const sends: { leadId: string; message: string | null; sentAt: Date | null }[] = [];
    for (let i = 0; i < 5; i++) {
      const sentAt = new Date(2026, 8, 14, 9, 0, i);
      rows.push({ id: `m${i}`, body: `${MACHINE} ${i}`, sentAt, leadId: "lead1" });
      sends.push({ leadId: "lead1", message: `${MACHINE} ${i}`, sentAt });
    }
    servePages(rows);
    serveFollowUps(sends);

    expect(await getVoiceSamples("biz1")).toEqual([]);
  });

  it("returns nothing for an account with no outbound messages", async () => {
    expect(await getVoiceSamples("biz1")).toEqual([]);
  });

  it("skips one-liners with no style signal and caps long samples", async () => {
    servePages([
      { id: "m1", body: "Sounds good!", sentAt: new Date(2026, 8, 14), leadId: "lead1" },
      { id: "m2", body: "x".repeat(900), sentAt: new Date(2026, 8, 13), leadId: "lead2" },
    ]);
    const samples = await getVoiceSamples("biz1");
    expect(samples).toHaveLength(1);
    expect(samples[0]).toHaveLength(500);
  });

  it("leaves a sample's own greeting and sign-off in place", async () => {
    // Deliberate (commit f50d9ad): a sign-off a person actually typed is
    // real voice signal and can't be told apart from the one sender.ts
    // adds, so the prompt is told to ignore the frame rather than this
    // stripping it and losing the signal.
    servePages([{ id: "m1", body: HUMAN_A, sentAt: new Date(2026, 8, 14), leadId: "lead1" }]);
    expect(await getVoiceSamples("biz1")).toEqual([HUMAN_A]);
  });
});
