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
  // The owner's "Not a customer" on this contact (A-259), and their recent calls.
  verdict: null as null | { verdict: string },
  corrections: [] as unknown[],
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
      senderVerdict: { findUnique: vi.fn(async () => h.verdict), findMany: vi.fn(async () => h.corrections) },
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
  h.verdict = null;
  h.corrections = [];
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

// Founder, 2026-10-12: "for hi we need to analyse whether they talked earlier, since when they're following".
describe("someone new, with what Instagram knows about them", () => {
  const earlierChat = {
    followsBusiness: true,
    businessFollows: true,
    followerCount: 412,
    messages: [
      { ...msg("e1", "bro you coming saturday?"), date: new Date("2025-03-02T20:00:00Z").toISOString() },
      { ...msg("e2", "yes bro", "outbound"), date: new Date("2025-03-02T20:05:00Z").toISOString() },
    ],
  };
  const askWith = (message: Message, background: unknown, hasOwnWords = true) =>
    judgeNewDmContact({
      businessId: "biz1",
      channel: "instagram",
      contactId: "123",
      name: "@friend",
      message,
      hasOwnWords,
      context: dmContextLoader("biz1", "instagram"),
      background: async () => background as never,
    });

  it("judges a 'hi' when they've talked with the business before, with that chat and the follow facts", async () => {
    h.judge.mockResolvedValue({ import: false, reason: "A friend chatting." });
    expect(await askWith(msg("m1", "hiii"), earlierChat)).toEqual({ admit: false });
    const [thread, , , signals] = h.judge.mock.calls[0];
    expect(thread.map((m: Message) => m.body)).toEqual(["bro you coming saturday?", "yes bro", "hiii"]);
    expect(signals.background).toContain("the business follows them back");
    expect(signals.background).toContain("their chat with the business goes back to Mar 2025");
  });

  it("still lets a first-time 'hi' through: nothing earlier to read", async () => {
    expect(await askWith(msg("m1", "Hi"), { followsBusiness: true, businessFollows: false, followerCount: 80, messages: [] })).toEqual({ admit: true, prior: [] });
    expect(h.judge).not.toHaveBeenCalled();
  });

  it("tells the judge it's their first message when there's no earlier chat", async () => {
    h.judge.mockResolvedValue({ import: true });
    await askWith(msg("m1", "Do you have any 2 bed condos under 600k?"), { followsBusiness: true, businessFollows: false, followerCount: 80, messages: [] });
    expect(h.judge.mock.calls[0][3].background).toContain("this is the first time they've messaged the business");
  });

  it("judges as before when Instagram couldn't be read", async () => {
    h.judge.mockResolvedValue({ import: true });
    expect(await askWith(msg("m1", "Hi"), null)).toEqual({ admit: true, prior: [] });
    await askWith(msg("m2", "how much do you charge?"), null);
    expect(h.judge.mock.calls[0][3]).toEqual({ knownOnAnotherChannel: false, background: undefined });
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

// A-259: the owner said who this was on "Not a customer".
describe("someone the owner already said isn't a customer", () => {
  it("is set aside without a fresh look, their 'hi' included", async () => {
    h.verdict = { verdict: "not_customer" };
    const r = await ask(msg("m1", "hi"));
    expect(r).toEqual({ admit: false });
    expect(h.judge).not.toHaveBeenCalled();
    expect(h.upserts[0]).toMatchObject({ create: { provider: "instagram", reason: "You marked this sender as not a customer." } });
  });

  it("stays aside when the owner writes to them from the Instagram app", async () => {
    h.verdict = { verdict: "not_customer" };
    const r = await ask(msg("m2", "haha see you sunday", "outbound"));
    expect(r).toEqual({ admit: false });
    expect(h.judge).not.toHaveBeenCalled();
  });

  it("is judged as before once the owner brought them back (the latest word wins)", async () => {
    h.verdict = { verdict: "customer" };
    h.judge.mockResolvedValue({ import: true });
    const r = await ask(msg("m3", "Is the condo on King St still available?"));
    expect(r).toMatchObject({ admit: true });
    expect(h.judge).toHaveBeenCalled();
  });

  it("hands the checker this owner's answers and standing rules", async () => {
    h.business = { ...h.business, notCustomerAlways: ["selling", "nonsense"] };
    h.corrections = [{ sender: "ig:555", subject: null, verdict: "not_customer", reason: "selling" }];
    h.judge.mockResolvedValue({ import: false, reason: "A marketing offer." });
    await ask(msg("m4", "We can get you 50 buyer leads a month, interested?"));
    const business = h.judge.mock.calls[0][2];
    expect(business.setAsideKinds).toEqual(["selling"]);
    expect(business.corrections).toEqual([{ sender: "an Instagram chat", subject: null, verdict: "not_customer", reason: "selling" }]);
  });
});
