/**
 * The home page demo's live answers (src/lib/demoReply.ts): the limits that
 * keep a stranger from running up the OpenAI bill, and the clean-up of what
 * the model writes before a visitor sees it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  executeRaw: vi.fn(async () => 0),
  count: vi.fn(),
  create: vi.fn(async () => ({})),
  deleteMany: vi.fn(async () => ({ count: 4 })),
  completionsCreate: vi.fn(),
  getClient: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({ $executeRaw: h.executeRaw, demoTry: { count: h.count, create: h.create } })
    ),
    demoTry: { deleteMany: h.deleteMany },
  },
}));
vi.mock("@/lib/integrations/openaiClient", () => ({ FALLBACK_MODEL: "small-model", getClient: h.getClient }));

import {
  DEMO_LIMITS,
  claimDemoTry,
  demoVisitorKey,
  pruneDemoTries,
  readDemoAnswer,
  requestIp,
  writeDemoReply,
} from "@/lib/demoReply";

/** Counts in the order claimDemoTry asks: this visitor today, the site today, the site in 10 minutes. */
function counts(mine: number, today: number, recent: number) {
  h.count.mockResolvedValueOnce(mine).mockResolvedValueOnce(today).mockResolvedValueOnce(recent);
}

beforeEach(() => {
  vi.clearAllMocks();
  h.count.mockReset();
  h.getClient.mockReturnValue({ chat: { completions: { create: h.completionsCreate } } });
  process.env.NEXTAUTH_SECRET = "test-secret";
});

describe("claimDemoTry — the limits", () => {
  it("lets a try through and records it when every limit has room", async () => {
    counts(0, 10, 2);
    expect(await claimDemoTry("v1")).toBeNull();
    expect(h.create).toHaveBeenCalledWith({ data: { visitor: "v1" } });
    // Lock first, then the counts, then the record — all in one transaction.
    expect(h.executeRaw.mock.invocationCallOrder[0]).toBeLessThan(h.count.mock.invocationCallOrder[0]);
    expect(h.count.mock.invocationCallOrder[2]).toBeLessThan(h.create.mock.invocationCallOrder[0]);
  });

  it("refuses a visitor's fourth try in a day, and doesn't record it", async () => {
    counts(DEMO_LIMITS.perVisitorPerDay, 10, 2);
    expect(await claimDemoTry("v1")).toBe("visitor");
    expect(h.create).not.toHaveBeenCalled();
  });

  it("refuses everyone once the site has had its day's answers", async () => {
    counts(0, DEMO_LIMITS.sitePerDay, 0);
    expect(await claimDemoTry("v2")).toBe("site");
    expect(h.create).not.toHaveBeenCalled();
  });

  it("refuses everyone during a burst over the 10-minute ceiling", async () => {
    counts(0, 50, DEMO_LIMITS.sitePer10Minutes);
    expect(await claimDemoTry("v3")).toBe("site");
    expect(h.create).not.toHaveBeenCalled();
  });

  it("the limits are the ones the founder approved", () => {
    expect(DEMO_LIMITS).toEqual({ perVisitorPerDay: 3, sitePer10Minutes: 40, sitePerDay: 300 });
  });
});

describe("the visitor key", () => {
  it("never stores the address: a keyed hash, the same for the same address", () => {
    const a = demoVisitorKey("203.0.113.9");
    expect(a).not.toContain("203.0.113.9");
    expect(a).toBe(demoVisitorKey("203.0.113.9"));
    expect(a).not.toBe(demoVisitorKey("203.0.113.10"));
  });

  it("no secret, no key — and the route then serves the fixed replies", () => {
    delete process.env.NEXTAUTH_SECRET;
    expect(demoVisitorKey("203.0.113.9")).toBeNull();
  });

  it("reads the first forwarded address, then x-real-ip", () => {
    expect(requestIp(new Headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }))).toBe("198.51.100.1");
    expect(requestIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(requestIp(new Headers())).toBeNull();
  });
});

describe("readDemoAnswer — what a visitor may see", () => {
  const full = {
    reply: "Haanji, haje available hai! Saturday 10 vaje dekhan aa sakde ho?",
    language: "Punjabi",
    englishLetters: true,
    price: false,
    followUp: "Bas check kar rahe si ji.",
    yes: "Haanji, Saturday theek hai",
    bookingReply: "Saturday 10 vaje pakka.",
    booked: "Viewing booked",
    deal: "$9,800",
  };

  it("keeps a good answer, with its story", () => {
    const r = readDemoAnswer(full)!;
    expect(r).toMatchObject({ kind: "reply", language: "Punjabi", englishLetters: true });
    expect(r.story).toMatchObject({ booked: "Viewing booked", deal: "$9,800" });
  });

  it("never quotes a price on a business's behalf", () => {
    const r = readDemoAnswer({ ...full, reply: "A full detail is $240, or $ 1,200.50 for the works.", price: true })!;
    expect(r.reply).toBe("A full detail is $___, or $___ for the works.");
    expect(r.kind).toBe("needs");
  });

  it("strips markup and keeps lengths bounded", () => {
    const r = readDemoAnswer({ ...full, reply: "<img src=x onerror=alert(1)>Hi " + "a".repeat(900) })!;
    expect(r.reply).not.toMatch(/[<>]/);
    expect(r.reply.length).toBeLessThanOrEqual(300);
  });

  it("English is no language tag; an odd language value is dropped", () => {
    expect(readDemoAnswer({ ...full, language: "English" })!.language).toBeNull();
    expect(readDemoAnswer({ ...full, language: "Punjabi\"><b>" })!.language).toBeNull();
  });

  it("falls back to safe story values", () => {
    const r = readDemoAnswer({ ...full, booked: "Free money", deal: "a million" })!;
    expect(r.story).toMatchObject({ booked: "Call booked", deal: "$1,200" });
    expect(readDemoAnswer({ ...full, yes: "" })!.story).toBeNull();
  });

  it("no reply, no answer", () => {
    expect(readDemoAnswer({ ...full, reply: "  " })).toBeNull();
    expect(readDemoAnswer("nope")).toBeNull();
    expect(readDemoAnswer(null)).toBeNull();
  });
});

describe("writeDemoReply", () => {
  it("uses the small model, a short answer, and keeps the visitor's text out of the instructions", async () => {
    h.completionsCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ reply: "Yes, it is!" }) } }] });
    const r = await writeDemoReply("Is it still available?");
    expect(r?.reply).toBe("Yes, it is!");
    const [body, opts] = h.completionsCreate.mock.calls[0];
    expect(body.model).toBe("small-model");
    expect(body.max_tokens).toBeLessThanOrEqual(400);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).not.toContain("Is it still available?");
    expect(body.messages[1]).toEqual({ role: "user", content: "Is it still available?" });
    expect(opts).toMatchObject({ maxRetries: 0 });
  });

  it("any failure is null, never a throw: no key, an error, unreadable output", async () => {
    h.getClient.mockImplementationOnce(() => {
      throw new Error("OPENAI_API_KEY is not set");
    });
    expect(await writeDemoReply("hi")).toBeNull();
    h.completionsCreate.mockRejectedValueOnce(new Error("timeout"));
    expect(await writeDemoReply("hi")).toBeNull();
    h.completionsCreate.mockResolvedValueOnce({ choices: [{ message: { content: "not json" } }] });
    expect(await writeDemoReply("hi")).toBeNull();
  });
});

describe("pruneDemoTries", () => {
  it("deletes tries older than two days", async () => {
    const now = new Date("2026-10-09T12:00:00Z");
    expect(await pruneDemoTries(now)).toEqual({ deleted: 4 });
    expect(h.deleteMany).toHaveBeenCalledWith({ where: { createdAt: { lt: new Date("2026-10-07T12:00:00Z") } } });
  });
});
