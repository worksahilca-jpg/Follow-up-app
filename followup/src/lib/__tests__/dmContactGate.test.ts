/**
 * "Is this DM a customer, or someone chatting?" (founder, 2026-10-11: "We'll
 * be picking up only those who are actually customers or leads"). The same
 * two-read judge WhatsApp uses; a chat is set aside only when both reads say
 * no, kept where the owner can bring it back, and never thrown away.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Message } from "@/lib/types";

const h = vi.hoisted(() => ({
  row: null as null | { id: string; threadPayload: unknown },
  lead: null as null | { id: string },
  upserts: [] as unknown[],
  updates: [] as unknown[],
  judge: vi.fn(),
  tooMany: vi.fn<(businessId: string, action: string, opts: unknown) => Promise<boolean>>(async () => false),
  business: { name: "Maple Realty", industry: "Real estate", subscriptionStatus: "beta", tier: "pro" } as Record<string, unknown> | null,
}));

vi.mock("@/lib/db", () => {
  const filteredEmail = {
    findUnique: vi.fn(async () => h.row),
    upsert: vi.fn(async (args: unknown) => {
      h.upserts.push(args);
      return {};
    }),
    deleteMany: vi.fn(async () => ({ count: 1 })),
    updateMany: vi.fn(async (args: unknown) => {
      h.updates.push(args);
      return { count: 1 };
    }),
  };
  const lead = { findFirst: vi.fn(async () => h.lead) };
  const tx = { $executeRaw: vi.fn(async () => 0), filteredEmail, lead, message: { upsert: vi.fn(async () => ({})) } };
  return {
    prisma: {
      filteredEmail,
      lead,
      business: { findUnique: vi.fn(async () => h.business) },
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    },
  };
});
vi.mock("@/lib/inbound/whatsappHistoryFilter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/inbound/whatsappHistoryFilter")>();
  return { ...actual, judgeHistoryThread: h.judge };
});
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions: h.tooMany }));

import { dmContextLoader, isBareGreeting, judgeNewDmContact } from "@/lib/inbound/dmContactGate";

const msg = (id: string, body: string, direction: "inbound" | "outbound" = "inbound"): Message => ({
  id,
  direction,
  channel: "instagram",
  body,
  date: new Date("2026-10-11T15:00:00Z").toISOString(),
  opened: false,
});
const ask = (message: Message, hasOwnWords = true) =>
  judgeNewDmContact({ businessId: "biz1", channel: "instagram", contactId: "123", name: "@friend", message, hasOwnWords, context: dmContextLoader("biz1", "instagram") });

beforeEach(() => {
  vi.clearAllMocks();
  h.row = null;
  h.lead = null;
  h.upserts = [];
  h.updates = [];
  h.business = { name: "Maple Realty", industry: "Real estate", subscriptionStatus: "beta", tier: "pro" };
  h.tooMany.mockResolvedValue(false);
});

describe("someone new", () => {
  it("sets a chat aside when both reads say it isn't a customer, and keeps it to restore", async () => {
    h.judge.mockResolvedValue({ import: false, reason: "A friend catching up, nothing about the business." });
    const r = await ask(msg("m1", "hey bro what's up"));
    expect(r).toEqual({ admit: false });
    expect(h.upserts[0]).toMatchObject({
      create: {
        provider: "instagram",
        threadId: "instagram:123",
        senderName: "@friend",
        reason: "A friend catching up, nothing about the business.",
        threadPayload: { name: "@friend", messages: [{ id: "m1", body: "hey bro what's up" }] },
      },
    });
  });

  it("lets a customer through", async () => {
    h.judge.mockResolvedValue({ import: true });
    expect(await ask(msg("m1", "how much do you charge for a 2 bed?"))).toEqual({ admit: true, prior: [] });
    expect(h.upserts).toHaveLength(0);
  });

  it("never judges a bare greeting or a photo: people say hi and wait, and a photo can be the question", async () => {
    expect(await ask(msg("m1", "Hi"))).toEqual({ admit: true, prior: [] });
    expect(await ask(msg("m2", "Hello there! 👋"))).toEqual({ admit: true, prior: [] });
    expect(await ask(msg("m3", "[Sent image with no message text]"), false)).toEqual({ admit: true, prior: [] });
    expect(h.judge).not.toHaveBeenCalled();
  });

  it("lets everyone through when AI isn't on for the business, or past the hourly limit (fail open)", async () => {
    h.business = { name: "Maple Realty", industry: "Real estate", subscriptionStatus: "canceled", tier: "pro" };
    expect(await ask(msg("m1", "hey bro what's up"))).toEqual({ admit: true, prior: [] });
    h.business = { name: "Maple Realty", industry: "Real estate", subscriptionStatus: "beta", tier: "pro" };
    h.tooMany.mockResolvedValueOnce(true);
    expect(await judgeNewDmContact({ businessId: "biz1", channel: "instagram", contactId: "123", name: undefined, message: msg("m2", "hey bro"), hasOwnWords: true, context: dmContextLoader("biz1", "instagram") })).toEqual({ admit: true, prior: [] });
    expect(h.judge).not.toHaveBeenCalled();
  });

  it("lets someone new through once the business has had its looks for the day", async () => {
    h.tooMany.mockImplementation(async (businessId, action) => businessId === "biz1" && action === "instagram_looks_day");
    expect(await ask(msg("m3", "hey bro what's up"))).toEqual({ admit: true, prior: [] });
    expect(h.judge).not.toHaveBeenCalled();
  });
});

describe("a chat already set aside", () => {
  beforeEach(() => {
    h.row = { id: "row1", threadPayload: { phone: "ig:123", name: "@friend", messages: [{ id: "m1", direction: "inbound", body: "hey bro what's up", date: "2026-10-11T14:00:00Z" }] } };
  });

  it("is judged again on the whole chat when they write more, and comes back whole when they become a customer", async () => {
    h.judge.mockResolvedValue({ import: true });
    const r = await ask(msg("m2", "actually, are you still selling the condo on King?"));
    expect(h.judge).toHaveBeenCalledWith(
      [expect.objectContaining({ id: "m1" }), expect.objectContaining({ id: "m2" })],
      expect.anything(),
      expect.anything(),
      { knownOnAnotherChannel: false },
      { alreadySetAside: true }
    );
    expect(r).toMatchObject({ admit: true, prior: [expect.objectContaining({ id: "m1", channel: "instagram" })] });
  });

  it("learns the handle when the 3-minute check brings a message the webhook already set aside nameless", async () => {
    h.row = { id: "row1", threadPayload: { phone: "ig:123", name: null, messages: [{ id: "m1", direction: "inbound", body: "hey bro what's up", date: "2026-10-11T14:00:00Z" }] } };
    expect(await ask(msg("m1", "hey bro what's up"))).toEqual({ admit: false });
    expect(h.judge).not.toHaveBeenCalled();
    expect(h.updates).toEqual([
      { where: { id: "row1", businessId: "biz1" }, data: { senderName: "@friend", threadPayload: expect.objectContaining({ name: "@friend", phone: "ig:123" }) } },
    ]);
  });

  it("never replaces a name the chat already has", async () => {
    expect(await ask(msg("m1", "hey bro what's up"))).toEqual({ admit: false });
    expect(h.updates).toEqual([]);
  });

  it("does not judge the same message twice when Meta and the 3-minute check both bring it", async () => {
    expect(await ask(msg("m1", "hey bro what's up"))).toEqual({ admit: false });
    expect(h.judge).not.toHaveBeenCalled();
  });
});

describe("a bare greeting", () => {
  it("is hi, hello, hey and the like, and nothing more", () => {
    for (const t of ["Hi", "hii", "Hello!", "hey there", "Good morning", "Sat Sri Akal", "Hi 🙂"]) expect(isBareGreeting(t)).toBe(true);
    for (const t of ["hey bro what's up", "Hi, how much?", "hello is this available", ""]) expect(isBareGreeting(t)).toBe(false);
  });
});
