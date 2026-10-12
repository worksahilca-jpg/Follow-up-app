/**
 * A-239 (founder, 2026-10-12: "you gotta make it accurate"): an Instagram or
 * Messenger customer is judged again on each new message with words until a
 * real reply has gone out, and moved to Filtered out the moment two reads
 * agree it's a friend or a pitch. The chats from before the first check are
 * looked at once by the hourly pass.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
  judge: vi.fn(),
  move: vi.fn(),
  limited: vi.fn(),
  pastDaily: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { lead: { findFirst: h.findFirst, findMany: h.findMany, updateMany: h.updateMany } } }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions: h.limited }));
vi.mock("@/lib/inbound/whatsappHistoryFilter", () => ({ judgeHistoryThread: h.judge }));
vi.mock("@/lib/inbound/dmContactGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/inbound/dmContactGate")>()),
  moveDmLeadAside: h.move,
  pastDailyLooks: h.pastDaily,
  dmContextLoader: () => async () => ({ classifier: { name: "Maple Key Realty", industry: "Real estate" }, aiAllowed: true }),
}));

import { dmCustomerSettled, hasWordsToJudge, recheckDmLead, recheckDmLeadsForAllBusinesses } from "@/lib/inbound/dmRecheck";

const at = (min: number) => new Date(Date.UTC(2026, 9, 12, 1, min));
const inbound = (body: string, min: number) => ({ id: `m${min}`, externalId: `mid${min}`, direction: "inbound", body, sentAt: at(min), source: null as string | null, trigger: null as string | null });
const outbound = (body: string, min: number, extra: { source?: string | null; trigger?: string | null } = {}) => ({
  id: `m${min}`,
  externalId: `mid${min}`,
  direction: "outbound",
  body,
  sentAt: at(min),
  source: extra.source ?? null,
  trigger: extra.trigger ?? null,
});

function dmLead(messages: ReturnType<typeof inbound>[], overrides: Record<string, unknown> = {}) {
  return {
    id: "lead1",
    name: "@friend",
    phone: "ig:1784100000000001",
    stage: "NEW",
    email: null,
    talkedAt: null,
    qualifiedAt: null,
    dmConfirmedAt: null,
    dmCheckedAt: null,
    sequenceId: null,
    _count: { bookings: 0 },
    conversations: [{ channel: "instagram", messages }],
    ...overrides,
  };
}

const friendChat = [inbound("😍", 1), inbound("Isme bee bhi dal", 2)];

beforeEach(() => {
  vi.resetAllMocks();
  h.limited.mockResolvedValue(false);
  h.pastDaily.mockResolvedValue(false);
  h.updateMany.mockResolvedValue({ count: 1 });
  h.move.mockResolvedValue(true);
});

describe("hasWordsToJudge", () => {
  it("only real words count", () => {
    expect(hasWordsToJudge("Isme bee bhi dal")).toBe(true);
    expect(hasWordsToJudge("😍")).toBe(false);
    expect(hasWordsToJudge("hi")).toBe(false);
    expect(hasWordsToJudge("[Sent story_mention with no message text]")).toBe(false);
  });
});

describe("dmCustomerSettled", () => {
  const base = { stage: "NEW", email: null, talkedAt: null, qualifiedAt: null, dmConfirmedAt: null, sequenceId: null };
  const none = { hasBooking: false, otherChannel: false };
  it("is settled once FollowUp has really replied", () => {
    expect(dmCustomerSettled(base, [{ direction: "outbound", source: null, trigger: "manual" }], none)).toBe(true);
  });
  it("is not settled by the instant 'got your message' or by a reply typed in the Instagram app", () => {
    expect(dmCustomerSettled(base, [{ direction: "outbound", source: null, trigger: "instant_ack" }], none)).toBe(false);
    expect(dmCustomerSettled(base, [{ direction: "outbound", source: "instagram_direct", trigger: null }], none)).toBe(false);
  });
  it("is settled by anything the owner decided", () => {
    expect(dmCustomerSettled({ ...base, dmConfirmedAt: at(0) }, [], none)).toBe(true);
    expect(dmCustomerSettled({ ...base, talkedAt: at(0) }, [], none)).toBe(true);
    expect(dmCustomerSettled({ ...base, stage: "CONTACTED" }, [], none)).toBe(true);
    expect(dmCustomerSettled(base, [], { hasBooking: true, otherChannel: false })).toBe(true);
  });
});

describe("recheckDmLead", () => {
  it("moves a friend's chat to Filtered out when the judge says it isn't a customer", async () => {
    h.findFirst.mockResolvedValue(dmLead(friendChat));
    h.judge.mockResolvedValue({ import: false, reason: "A friend joking about a story, not an enquiry." });
    expect(await recheckDmLead("biz1", "lead1")).toBe("set_aside");
    expect(h.judge).toHaveBeenCalledTimes(1);
    expect(h.judge.mock.calls[0][0].map((m: { body: string }) => m.body)).toEqual(["😍", "Isme bee bhi dal"]);
    expect(h.move).toHaveBeenCalledWith("biz1", "instagram", "1784100000000001", "lead1", "A friend joking about a story, not an enquiry.");
    expect(h.findFirst.mock.calls[0][0].where).toEqual({ id: "lead1", businessId: "biz1" });
  });

  it("keeps a real customer and remembers it looked", async () => {
    h.findFirst.mockResolvedValue(dmLead([inbound("Hi", 1), inbound("Is the basement on Main still for rent?", 2)]));
    h.judge.mockResolvedValue({ import: true });
    expect(await recheckDmLead("biz1", "lead1")).toBe("kept");
    expect(h.move).not.toHaveBeenCalled();
    expect(h.updateMany).toHaveBeenCalledWith({ where: { id: "lead1", businessId: "biz1" }, data: { dmCheckedAt: expect.any(Date) } });
  });

  it("still checks after the instant acknowledgement or an owner's reply in the Instagram app", async () => {
    h.findFirst.mockResolvedValue(dmLead([inbound("😍", 1), outbound("Thanks for your message!", 2, { trigger: "instant_ack" }), outbound("haha", 3, { source: "instagram_direct" }), inbound("Isme bee bhi dal", 4)]));
    h.judge.mockResolvedValue({ import: false, reason: "Friends chatting." });
    expect(await recheckDmLead("biz1", "lead1")).toBe("set_aside");
  });

  it("never second-guesses someone FollowUp has really answered", async () => {
    h.findFirst.mockResolvedValue(dmLead([inbound("How much do you charge?", 1), outbound("My commission is 2.5%.", 2, { trigger: "manual" }), inbound("lol ok", 3)]));
    expect(await recheckDmLead("biz1", "lead1")).toBe("settled");
    expect(h.judge).not.toHaveBeenCalled();
  });

  it("never second-guesses someone the owner brought back", async () => {
    h.findFirst.mockResolvedValue(dmLead(friendChat, { dmConfirmedAt: at(0) }));
    expect(await recheckDmLead("biz1", "lead1")).toBe("settled");
    expect(h.judge).not.toHaveBeenCalled();
  });

  it("doesn't judge the same words twice", async () => {
    h.findFirst.mockResolvedValue(dmLead(friendChat, { dmCheckedAt: at(5) }));
    expect(await recheckDmLead("biz1", "lead1")).toBe("skipped");
    expect(h.judge).not.toHaveBeenCalled();
  });

  it("lets it stay when a limit is reached", async () => {
    h.findFirst.mockResolvedValue(dmLead(friendChat));
    h.limited.mockResolvedValue(true);
    expect(await recheckDmLead("biz1", "lead1")).toBe("skipped");
    expect(h.judge).not.toHaveBeenCalled();
    expect(h.move).not.toHaveBeenCalled();
  });
});

describe("recheckDmLeadsForAllBusinesses", () => {
  it("looks once at the chats never checked, ten per business, and marks the ones it can't judge", async () => {
    h.findMany.mockResolvedValue(Array.from({ length: 12 }, (_, i) => ({ id: `lead${i}`, businessId: "biz1" })));
    h.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => (where.id === "lead0" ? dmLead(friendChat, { id: "lead0" }) : null));
    h.judge.mockResolvedValue({ import: false, reason: "Friends chatting." });
    const result = await recheckDmLeadsForAllBusinesses();
    expect(result).toEqual({ checked: 10, setAside: 1 });
    expect(h.findMany.mock.calls[0][0].where).toMatchObject({ dmCheckedAt: null, dmConfirmedAt: null, stage: "NEW" });
  });
});
