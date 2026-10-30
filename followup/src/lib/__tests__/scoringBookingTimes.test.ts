/**
 * Booking in the chat inside the reply step (src/lib/scoring.ts, A-242): a
 * customer who wants to meet is offered two free times (fixed words on a
 * DM, the writer's words with both times on email); a customer who picks
 * one has the pick stored for the owner's Confirm, the fixed
 * acknowledgement as the draft, one buzz to the business, and no AI call.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const SAT = "2026-10-31T15:00:00.000Z"; // Saturday 11 am Toronto
const MON = "2026-11-02T19:00:00.000Z"; // Monday 2 pm Toronto
const h = vi.hoisted(() => ({
  lead: null as Record<string, unknown> | null,
  update: vi.fn(),
  updateMany: vi.fn(async () => ({ count: 0 })),
  booking: null as { id: string; scheduledAt: Date } | null,
  cancel: vi.fn(async (_id: string, _biz: string, _by: string) => ({ id: "b1", leadId: "lead1", scheduledAt: new Date("2026-10-31T15:00:00.000Z") })),
  score: vi.fn(async () => ({ score: 60, reason: "Wants to see it", factors: [], saysNo: false, asksIfAutomated: false, onlyThanks: false })),
  generate: vi.fn(async (lead: unknown) => {
    void lead;
    return { body: "Happy to show you 42 Elm St. I can do Saturday at 11 am or Monday at 2 pm. Which works for you?", subject: "Re: 42 Elm St" };
  }),
  draftDm: vi.fn(async () => ({ body: "dm draft", quickReplies: { question: "x", buttons: [] }, shapeFailed: null })),
  offer: vi.fn(async (): Promise<{ at: string[]; said: string[] } | null> => ({ at: ["2026-10-31T15:00:00.000Z", "2026-11-02T19:00:00.000Z"], said: ["Saturday at 11 am", "Monday at 2 pm"] })),
  push: vi.fn(async () => ({ delivered: 1, failed: 0 })),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    lead: { findUnique: vi.fn(async () => h.lead), update: h.update, updateMany: h.updateMany },
    notification: { create: vi.fn() },
    booking: { findFirst: vi.fn(async () => h.booking) },
    user: { findMany: vi.fn(async () => [{ id: "owner1" }, { id: "mate1" }]) },
  },
}));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions: vi.fn(async () => false) }));
vi.mock("@/lib/billing", () => ({ checkAiEligibility: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/integrations/openai", () => ({
  scoreLead: h.score,
  generateFollowUpMessage: h.generate,
  extractQualificationFacts: vi.fn(async () => null),
  checkForStop: vi.fn(async () => ({ tries: 5, stops: 0 })),
}));
vi.mock("@/lib/sender", () => ({
  composeFollowUpEmail: vi.fn(async (_n: string, _b: string, body: string) => `Hi Raj,\n\n${body}\n\nBest,\nMaple`),
  latestInboundText: (c: { direction: string; body: string }[]) => [...c].reverse().find((m) => m.direction === "inbound")?.body ?? null,
}));
vi.mock("@/lib/dmDrafting", () => ({ draftDm: h.draftDm }));
vi.mock("@/lib/voice", () => ({ getVoiceSamples: vi.fn(async () => []) }));
vi.mock("@/lib/leadLanguage", () => ({ detectLeadLanguage: vi.fn(async () => null), leadLanguageOf: () => null }));
vi.mock("@/lib/slack", () => ({ notifySlack: vi.fn(), escapeSlackText: (s: string) => s }));
vi.mock("@/lib/businessFacts", () => ({ draftingContext: vi.fn(async () => ({ trade: "Real estate", facts: [] })), getBusinessFacts: vi.fn(async () => []) }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/pendingApprovals", () => ({ heldSince: vi.fn(async () => true) }));
vi.mock("@/lib/crm/notes", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/crm/notes")>()), pushCrmNote: vi.fn() }));
vi.mock("@/lib/crm/stages", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/crm/stages")>()), moveLeadForTier: vi.fn() }));
vi.mock("@/lib/booking", () => ({ offerTwoTimes: h.offer, cancelBooking: h.cancel }));
vi.mock("@/lib/webPush", () => ({ isPushConfigured: () => true, sendPushToUser: h.push }));

process.env.OPENAI_API_KEY = "test-key";

import { scoreAndDraftForLead } from "@/lib/scoring";

function message(direction: "inbound" | "outbound", body: string, minute: number) {
  return { id: `m${minute}`, direction, body, sentAt: new Date(Date.UTC(2026, 9, 28, 13, minute)), opened: false, source: null, trigger: null, quickReplyPayload: null, deliveryStatus: null };
}

function setLead(opts: { messages: ReturnType<typeof message>[]; channel?: string; offeredTimes?: unknown; pickedTime?: Date | null; pickedTimeAt?: Date | null }) {
  h.lead = {
    id: "lead1",
    businessId: "biz1",
    name: "Raj Mehta",
    dealValue: 0,
    lastContacted: null,
    createdAt: new Date(Date.UTC(2026, 9, 27, 9)),
    priority: "NONE",
    automationTier: "ASSISTED",
    assignedToId: "owner1",
    language: null,
    qualification: null,
    qualifiedAt: null,
    email: opts.channel ? null : "raj@example.com",
    crmProvider: null,
    crmId: null,
    dmEmail: null,
    dmContactAskedAt: new Date(Date.UTC(2026, 9, 27, 9)),
    offeredTimes: opts.offeredTimes ?? null,
    pickedTime: opts.pickedTime ?? null,
    pickedTimeAt: opts.pickedTimeAt ?? null,
    business: { tier: "pro", name: "Maple Realty", industry: "Real estate", timezone: "America/Toronto" },
    conversations: [{ channel: opts.channel ?? "email", messages: opts.messages }],
  };
}
const updateData = () => h.update.mock.calls[0][0].data as Record<string, unknown>;
const OFFER_TEXT = "I can do Saturday at 11 am or Monday at 2 pm. Which works for you?";

beforeEach(() => {
  vi.clearAllMocks();
  h.booking = null;
  h.offer.mockResolvedValue({ at: [SAT, MON], said: ["Saturday at 11 am", "Monday at 2 pm"] });
  h.generate.mockResolvedValue({ body: "Happy to show you 42 Elm St. I can do Saturday at 11 am or Monday at 2 pm. Which works for you?", subject: "Re: 42 Elm St" });
});

describe("offering two times", () => {
  it("gives the email writer both times and stores the offer on the customer", async () => {
    setLead({ messages: [message("inbound", "Can we see 42 Elm St this Saturday?", 1)] });
    expect(await scoreAndDraftForLead("lead1")).toBe(true);
    expect(h.offer).toHaveBeenCalledWith("lead1", expect.any(Date), "America/Toronto", { wantDay: 6, avoid: [] });
    const asked = h.generate.mock.calls[0][0] as { offerTimes?: string[]; bookingLink?: string | null; qualify?: unknown };
    expect(asked.offerTimes).toEqual(["Saturday at 11 am", "Monday at 2 pm"]);
    expect(asked.bookingLink).toBeNull();
    expect(asked.qualify).toBeNull();
    expect(updateData().offeredTimes).toMatchObject({ at: [SAT, MON], said: ["Saturday at 11 am", "Monday at 2 pm"] });
    expect(updateData().suggestedMessage).toContain("Saturday at 11 am or Monday at 2 pm");
  });
  it("adds the fixed sentence when the writer dropped a time", async () => {
    h.generate.mockResolvedValueOnce({ body: "Happy to show you around! Saturday at 11 am could work.", subject: "Re: 42 Elm St" });
    setLead({ messages: [message("inbound", "Can we see 42 Elm St this Saturday?", 1)] });
    await scoreAndDraftForLead("lead1");
    expect(updateData().suggestedMessage).toContain(`Saturday at 11 am could work.\n\n${OFFER_TEXT}`);
  });
  it("writes a DM offer in fixed words with the two times as buttons, without the drafter", async () => {
    // The buttons say "Tomorrow" the day before: the clock is pinned to the Wednesday before, as below. Unpinned,
    // this failed every Friday.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-28T14:00:00.000Z"));
    try {
      setLead({ channel: "instagram", messages: [message("inbound", "could we see it this weekend?", 1)] });
      await scoreAndDraftForLead("lead1");
      expect(h.draftDm).not.toHaveBeenCalled();
      expect(updateData().suggestedMessage).toBe(OFFER_TEXT);
      expect(updateData().suggestedQuickReplies).toEqual({ question: "offer_times", buttons: [{ title: "Sat 11 am", exit: false }, { title: "Mon 2 pm", exit: false }] });
    } finally {
      vi.useRealTimers();
    }
  });
  it("falls back to the usual reply when the calendar has nothing free", async () => {
    h.offer.mockResolvedValueOnce(null);
    setLead({ messages: [message("inbound", "Can we see 42 Elm St this Saturday?", 1)] });
    await scoreAndDraftForLead("lead1");
    const asked = h.generate.mock.calls[0][0] as { offerTimes?: string[] | null };
    expect(asked.offerTimes ?? null).toBeNull();
    expect(updateData().offeredTimes).toBeUndefined();
  });
  it("offers nothing to a customer who isn't asking to meet", async () => {
    setLead({ messages: [message("inbound", "What's the price of 42 Elm St?", 1)] });
    await scoreAndDraftForLead("lead1");
    expect(h.offer).not.toHaveBeenCalled();
    expect(updateData().offeredTimes).toBeUndefined();
  });
});

describe("reading the pick", () => {
  const OFFERED = { at: [SAT, MON], said: ["Saturday at 11 am", "Monday at 2 pm"], offeredAt: "2026-10-28T13:40:00.000Z" };
  const THREAD = [
    message("inbound", "Can we see 42 Elm St this Saturday?", 1),
    message("outbound", OFFER_TEXT, 2),
    message("inbound", "Saturday at 11 works for us.", 3),
  ];
  it("stores the pick, drafts the fixed acknowledgement, buzzes the business, and runs no AI", async () => {
    setLead({ messages: THREAD, offeredTimes: OFFERED });
    expect(await scoreAndDraftForLead("lead1")).toBe(true);
    expect(h.score).not.toHaveBeenCalled();
    expect(h.generate).not.toHaveBeenCalled();
    const d = updateData();
    expect(d.pickedTime).toEqual(new Date(SAT));
    expect(d.pickedTimeAt).toEqual(new Date(Date.UTC(2026, 9, 28, 13, 3)));
    expect(d.suggestedMessage).toBe("Hi Raj,\n\nGreat. Let me confirm that and get right back to you.\n\nBest,\nMaple");
    expect(d.suggestedRiskLevel).toBe("low");
    expect(h.push).toHaveBeenCalledTimes(2);
    expect(h.push).toHaveBeenCalledWith("owner1", { title: "Raj picked a time", body: "Raj wants Saturday at 11 am. Tap to confirm.", url: "/leads/lead1", tag: "picked-lead1" });
  });
  it("reads nothing when the offer is no longer the last thing FollowUp said", async () => {
    setLead({ messages: [...THREAD.slice(0, 2), message("outbound", "Also, parking is included.", 3), message("inbound", "Saturday at 11 works for us.", 4)], offeredTimes: OFFERED });
    await scoreAndDraftForLead("lead1");
    expect(updateData().pickedTime).toBeUndefined();
    expect(h.generate).toHaveBeenCalled();
  });
  it("leaves a waiting pick alone until the customer writes again", async () => {
    setLead({ messages: THREAD, pickedTime: new Date(SAT), pickedTimeAt: new Date(Date.UTC(2026, 9, 28, 13, 3)) });
    expect(await scoreAndDraftForLead("lead1")).toBe(false);
    expect(h.update).not.toHaveBeenCalled();
  });
  it("clears a waiting pick when the customer writes something newer", async () => {
    setLead({ messages: [...THREAD, message("inbound", "Actually, can we make it Monday instead?", 9)], pickedTime: new Date(SAT), pickedTimeAt: new Date(Date.UTC(2026, 9, 28, 13, 3)) });
    await scoreAndDraftForLead("lead1");
    expect(updateData().pickedTime).toBeNull();
    expect(updateData().pickedTimeAt).toBeNull();
  });
});

describe("change or cancel in the chat (part 2)", () => {
  const SUN = "2026-11-01T16:00:00.000Z"; // Sunday 11 am Toronto
  const BOOKED = [
    message("inbound", "Can we see 42 Elm St this Saturday?", 1),
    message("outbound", OFFER_TEXT, 2),
    message("inbound", "Saturday at 11 works for us.", 3),
    message("outbound", "Booked: Saturday, Oct 31 at 11 am. See you then.", 4),
  ];
  beforeEach(() => {
    // The words say "Saturday at 11 am" only within the week: the clock is pinned to the Wednesday before.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-28T14:00:00.000Z"));
    h.booking = { id: "b1", scheduledAt: new Date(SAT) };
    h.offer.mockResolvedValue({ at: [SUN, MON], said: ["Sunday at 11 am", "Monday at 2 pm"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it("offers two new times, in the move words, when they ask to move a booked time on a DM", async () => {
    setLead({ channel: "instagram", messages: [...BOOKED, message("inbound", "Something came up, can we reschedule?", 5)] });
    expect(await scoreAndDraftForLead("lead1")).toBe(true);
    expect(h.offer).toHaveBeenCalledWith("lead1", expect.any(Date), "America/Toronto", { wantDay: null, avoid: [SAT] });
    expect(updateData().suggestedMessage).toBe("Sure, let's find another time. I can do Sunday at 11 am or Monday at 2 pm. Which works for you?");
    expect(updateData().offeredTimes).toMatchObject({ at: [SUN, MON] });
    expect(h.cancel).not.toHaveBeenCalled();
  });
  it("tells the email writer the times answer a move, and doesn't read 'can't make Saturday' as a no", async () => {
    h.generate.mockResolvedValueOnce({ body: "No problem at all. I can do Sunday at 11 am or Monday at 2 pm. Which works for you?", subject: "Re: 42 Elm St" });
    setLead({ messages: [...BOOKED, message("inbound", "I can't make Saturday after all, is there another day?", 5)] });
    await scoreAndDraftForLead("lead1");
    const asked = h.generate.mock.calls[0][0] as { offerTimes?: string[]; offerTimesMoving?: boolean };
    expect(asked.offerTimes).toEqual(["Sunday at 11 am", "Monday at 2 pm"]);
    expect(asked.offerTimesMoving).toBe(true);
    expect(updateData().saidNoAt ?? null).toBeNull();
  });
  it("cancels the booking, acknowledges in fixed words, buzzes the business and runs no AI when they cancel", async () => {
    setLead({ channel: "instagram", messages: [...BOOKED, message("inbound", "I need to cancel Saturday, sorry", 5)] });
    expect(await scoreAndDraftForLead("lead1")).toBe(true);
    expect(h.cancel).toHaveBeenCalledWith("b1", "biz1", "customer");
    expect(h.score).not.toHaveBeenCalled();
    expect(h.offer).not.toHaveBeenCalled();
    const d = updateData();
    expect(d.suggestedMessage).toBe("No problem, I've taken Saturday at 11 am off the calendar. Whenever you'd like to set up another time, just let me know.");
    expect(d.suggestedRiskLevel).toBe("low");
    expect(h.push).toHaveBeenCalledWith("owner1", { title: "Raj cancelled", body: "Raj cancelled Saturday at 11 am. Offer another time?", url: "/leads/lead1", tag: "cancelled-lead1" });
  });
  it("leaves a cancel that is really a no to the normal path, booking untouched", async () => {
    setLead({ messages: [...BOOKED, message("inbound", "Cancel it, we're not interested anymore.", 5)] });
    await scoreAndDraftForLead("lead1");
    expect(h.cancel).not.toHaveBeenCalled();
    expect(h.score).toHaveBeenCalled();
  });
  it("buzzes 'wants to move' when they pick one of the new times", async () => {
    const OFFERED = { at: [SUN, MON], said: ["Sunday at 11 am", "Monday at 2 pm"], offeredAt: "2026-10-28T13:40:00.000Z" };
    setLead({
      messages: [...BOOKED, message("inbound", "Can we reschedule?", 5), message("outbound", "Sure, let's find another time. I can do Sunday at 11 am or Monday at 2 pm. Which works for you?", 6), message("inbound", "Sunday works", 7)],
      offeredTimes: OFFERED,
    });
    expect(await scoreAndDraftForLead("lead1")).toBe(true);
    expect(updateData().pickedTime).toEqual(new Date(SUN));
    expect(h.push).toHaveBeenCalledWith("owner1", { title: "Raj wants to move", body: "Raj wants Sunday at 11 am instead of Saturday at 11 am. Tap to confirm.", url: "/leads/lead1", tag: "picked-lead1" });
  });
  it("reads no move or cancel without a booked time", async () => {
    h.booking = null;
    setLead({ messages: [message("inbound", "I need to cancel Saturday, sorry", 1)] });
    await scoreAndDraftForLead("lead1");
    expect(h.cancel).not.toHaveBeenCalled();
    expect(h.score).toHaveBeenCalled();
  });
});
