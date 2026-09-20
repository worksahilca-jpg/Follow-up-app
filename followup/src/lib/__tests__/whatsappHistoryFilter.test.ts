/**
 * "Make sure no leads slip over" — the founder's bar for this feature,
 * 2026-09-20, and the reason it has two stages instead of one.
 *
 * WhatsApp Coexistence connects the owner's OWN number, so the history
 * import was pulling their accountant, their supplier and their family
 * into the pipeline as scored, drafted-for leads. The mailbox syncs have
 * asked "is this customer business?" since the beginning; this brings
 * WhatsApp to the same standard, with one difference: a single "no" is
 * not enough to set a chat aside.
 *
 * These tests are lopsided on purpose, because the feature is. Missing a
 * real customer is the failure the product exists to prevent. A private
 * chat in the pipeline is untidy and sends nothing. So every uncertain
 * path is asserted to IMPORT.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Message } from "@/lib/types";

const { classifyAsProspect } = vi.hoisted(() => ({
  classifyAsProspect: vi.fn<
    (c: Message[], s: { name: string; email: string }, b?: unknown, o?: unknown) => Promise<{ isProspect: boolean; reason: string }>
  >(async () => ({ isProspect: false, reason: "Not about this business's work." })),
}));
const { leadFindFirst } = vi.hoisted(() => ({ leadFindFirst: vi.fn(async () => null) }));

vi.mock("@/lib/integrations/openai", () => ({ classifyAsProspect }));
vi.mock("@/lib/db", () => ({ prisma: { lead: { findFirst: leadFindFirst } } }));

import { judgeHistoryThread, parseStoredThread } from "@/lib/inbound/whatsappHistoryFilter";

const business = { name: "Acme Plumbing", industry: "plumbing" };
const contact = { name: "Priya", phone: "+14165550100" };
const noSignals = { knownOnAnotherChannel: false };

function msg(direction: "inbound" | "outbound", body: string, minutesAgo = 0): Message {
  return {
    id: `m${body.length}-${minutesAgo}`,
    direction,
    channel: "whatsapp",
    body,
    date: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    opened: false,
  };
}

beforeEach(() => {
  classifyAsProspect.mockReset().mockResolvedValue({ isProspect: false, reason: "Not about this business's work." });
  leadFindFirst.mockReset().mockResolvedValue(null);
});

describe("a chat the first look already recognises", () => {
  it("is a lead, and never reaches the second look", async () => {
    classifyAsProspect.mockResolvedValueOnce({ isProspect: true, reason: "Asking about a blocked drain." });
    const verdict = await judgeHistoryThread([msg("inbound", "Hi, my drain is blocked")], contact, business, noSignals);
    expect(verdict).toEqual({ import: true });
    expect(classifyAsProspect).toHaveBeenCalledTimes(1);
  });
});

describe("a chat the first look rejects", () => {
  // The case this whole feature exists for: "hey" opens the chat, the job
  // arrives ten messages later, and a single glance at the opening would
  // throw away a paying customer.
  it("is still a lead if the second look, reading the recent messages, recognises it", async () => {
    classifyAsProspect
      .mockResolvedValueOnce({ isProspect: false, reason: "Just a greeting." })
      .mockResolvedValueOnce({ isProspect: true, reason: "Asked for a quote on a bathroom." });

    const thread = [
      msg("inbound", "yo", 500),
      msg("outbound", "hey", 499),
      msg("inbound", "can you quote me for a bathroom", 5),
    ];
    const verdict = await judgeHistoryThread(thread, contact, business, noSignals);
    expect(verdict).toEqual({ import: true });
    expect(classifyAsProspect).toHaveBeenCalledTimes(2);
  });

  it("only sets it aside after failing BOTH looks, and keeps the reason verbatim", async () => {
    classifyAsProspect
      .mockResolvedValueOnce({ isProspect: false, reason: "Personal chat." })
      .mockResolvedValueOnce({ isProspect: false, reason: "Family conversation, no work discussed." });

    const verdict = await judgeHistoryThread([msg("inbound", "are we still on for sunday")], contact, business, noSignals);
    // The classifier's own sentence, not ours: it is what the owner reads
    // in the skipped list, and a paraphrase would be worse.
    expect(verdict).toEqual({ import: false, reason: "Family conversation, no work discussed." });
  });

  // The second look sees the NEWEST messages, not the opening again.
  // Re-reading what already failed is the one thing guaranteed to add
  // nothing.
  it("shows the second look the end of the chat, not the start", async () => {
    const thread = Array.from({ length: 30 }, (_, i) => msg("inbound", `message ${i}`, 30 - i));
    await judgeHistoryThread(thread, contact, business, noSignals);
    const secondLook = classifyAsProspect.mock.calls[1][0];
    expect(secondLook.at(-1)?.body).toBe("message 29");
    expect(secondLook.map((m) => m.body)).not.toContain("message 0");
  });
});

describe("the facts a classifier cannot read", () => {
  // Already a customer somewhere else settles it. Asked before either AI
  // call — this is a fact about the business's own records, not a
  // judgement, and there is nothing to weigh against it.
  it("imports without asking the AI at all when the person is a lead on another channel", async () => {
    const verdict = await judgeHistoryThread([msg("inbound", "hi")], contact, business, {
      ...noSignals,
      knownOnAnotherChannel: true,
    });
    expect(verdict).toEqual({ import: true });
    expect(classifyAsProspect).not.toHaveBeenCalled();
  });

  /**
   * "Did the owner quote a price or offer a time?" was a regex list on
   * the day it was written, and it matched "$120" and "Tuesday at 3" and
   * nothing in Hindi, Punjabi or Spanish — weakest for exactly the
   * customers this product's language work exists for. It is now an
   * instruction to the model, which already has the owner's own messages
   * in front of it and can read them in any script.
   */
  it("tells the second look to read the owner's own messages, in any language", async () => {
    await judgeHistoryThread([msg("inbound", "hey"), msg("outbound", "Can do Tuesday at 3")], contact, business, noSignals);
    const deepContext = classifyAsProspect.mock.calls[1][2] as { industry: string };
    expect(deepContext.industry).toMatch(/quoted a price, offered a time/);
    expect(deepContext.industry).toMatch(/ANY language or script/);
    // Named explicitly, because a romanised language is the case a
    // keyword list gets wrong most often and most invisibly.
    expect(deepContext.industry).toMatch(/English letters/);
  });

  // The instruction is unconditional now: there is no precomputed flag
  // left to gate it, and gating it would put us back to deciding in code
  // what only the transcript can show.
  it("gives the second look that instruction every time, not only when a keyword matched", async () => {
    await judgeHistoryThread([msg("inbound", "kal aa sakte ho?"), msg("outbound", "haan, 2000 rupaye")], contact, business, noSignals);
    const deepContext = classifyAsProspect.mock.calls[1][2] as { industry: string };
    expect(deepContext.industry).toMatch(/quoted a price, offered a time/);
  });
});

describe("when anything is uncertain, it imports", () => {
  it("imports when the classifier throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    classifyAsProspect.mockRejectedValue(new Error("OpenAI is down"));
    const verdict = await judgeHistoryThread([msg("inbound", "hi")], contact, business, noSignals);
    expect(verdict).toEqual({ import: true });
  });

  it("imports when the second look throws after the first said no", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    classifyAsProspect
      .mockResolvedValueOnce({ isProspect: false, reason: "Unclear." })
      .mockRejectedValueOnce(new Error("timeout"));
    const verdict = await judgeHistoryThread([msg("inbound", "hi")], contact, business, noSignals);
    expect(verdict).toEqual({ import: true });
  });

  it("imports an empty thread rather than judging one", async () => {
    expect(await judgeHistoryThread([], contact, business, noSignals)).toEqual({ import: true });
    expect(classifyAsProspect).not.toHaveBeenCalled();
  });

  it("still judges when the business has never said what it does", async () => {
    classifyAsProspect.mockResolvedValue({ isProspect: true, reason: "Enquiry." });
    expect(await judgeHistoryThread([msg("inbound", "hi")], contact, undefined, noSignals)).toEqual({ import: true });
  });
});

/**
 * Restore has to actually restore. Meta delivers a number's history once,
 * in one webhook, so the thread is kept on the skipped row — and read
 * back defensively, because the column is Json and a row written by an
 * older build must fail rather than half-build a conversation.
 */
describe("parseStoredThread", () => {
  it("reads back what the import stored", () => {
    const stored = { phone: "+14165550100", name: "Priya", messages: [msg("inbound", "hello")] };
    const parsed = parseStoredThread(JSON.parse(JSON.stringify(stored)));
    expect(parsed?.phone).toBe("+14165550100");
    expect(parsed?.messages).toHaveLength(1);
    expect(parsed?.messages[0].body).toBe("hello");
  });

  it("refuses anything that is not the shape it wrote", () => {
    expect(parseStoredThread(null)).toBeNull();
    expect(parseStoredThread("nope")).toBeNull();
    expect(parseStoredThread([])).toBeNull();
    expect(parseStoredThread({ messages: [] })).toBeNull();
    expect(parseStoredThread({ phone: "+1", messages: "no" })).toBeNull();
  });

  it("drops individual messages it cannot trust, keeping the rest", () => {
    const parsed = parseStoredThread({
      phone: "+1",
      name: null,
      messages: [{ direction: "sideways", body: "x", date: "2026-01-01" }, { direction: "inbound", body: "real", date: "2026-01-01" }],
    });
    expect(parsed?.messages).toHaveLength(1);
    expect(parsed?.messages[0].body).toBe("real");
  });
});
