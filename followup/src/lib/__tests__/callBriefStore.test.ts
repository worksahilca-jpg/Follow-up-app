/**
 * "Before your call" (A-268), kept with the booking: asked of the model only when the conversation has moved on,
 * within the daily AI ceilings, and never shown unchecked. The customer below is made up.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Message } from "@/lib/types";

const { updateMany, extractCallBrief, tooManyRecentActions, leadAiRefusal } = vi.hoisted(() => ({
  updateMany: vi.fn(async () => ({ count: 1 })),
  extractCallBrief: vi.fn(),
  tooManyRecentActions: vi.fn(async () => false),
  leadAiRefusal: vi.fn(async () => null),
}));
vi.mock("@/lib/db", () => ({ prisma: { booking: { updateMany } } }));
vi.mock("@/lib/integrations/openai", () => ({ extractCallBrief }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions }));
vi.mock("@/lib/billing", () => ({ leadAiRefusal }));
vi.mock("@/lib/scoring", () => ({ AI_RUNS_PER_LEAD_PER_DAY: { windowMinutes: 1440, max: 30 }, AI_RUNS_PER_BUSINESS_PER_DAY: { windowMinutes: 1440, max: 500 } }));

import { currentCallBrief, type BriefInput } from "@/lib/callBriefStore";
import { checkBrief } from "@/lib/callBrief";

const chat: Message[] = [
  { id: "m1", direction: "inbound", channel: "email", body: "We're pre-approved up to 950. Saturdays are easiest for us.", date: "2026-10-09T14:00:00.000Z" },
  { id: "m2", direction: "outbound", channel: "email", body: "Thanks Aisha, I'll send a few homes.", date: "2026-10-09T15:00:00.000Z" },
];
const input = (over: Partial<BriefInput> = {}): BriefInput => ({
  bookingId: "bk1",
  businessId: "biz1",
  leadId: "lead1",
  leadName: "Aisha Rahman",
  conversation: chat,
  qualification: null,
  stored: null,
  ...over,
});
const proposal = [{ section: "next" as const, text: "A Saturday viewing.", quotes: [{ quote: "Saturdays are easiest for us", by: "customer" as const }] }];

beforeEach(() => {
  vi.clearAllMocks();
  tooManyRecentActions.mockResolvedValue(false);
  leadAiRefusal.mockResolvedValue(null);
  extractCallBrief.mockResolvedValue(proposal);
});

describe("currentCallBrief", () => {
  it("uses the stored note while no message has come since, without asking the model", async () => {
    const stored = checkBrief(proposal, chat);
    expect(await currentCallBrief(input({ stored }))).toEqual(stored);
    expect(extractCallBrief).not.toHaveBeenCalled();
  });

  it("writes it again once the conversation has moved on, checked, and keeps it on this business's booking", async () => {
    const old = checkBrief(proposal, chat.slice(0, 1));
    const b = await currentCallBrief(input({ stored: old }));
    expect(extractCallBrief).toHaveBeenCalledWith(chat, "Aisha");
    expect(b?.next[0].text).toBe("A Saturday viewing.");
    expect(b?.messages).toBe(2);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "bk1", businessId: "biz1" } }));
  });

  it("drops what the model made up before anything is kept or shown", async () => {
    extractCallBrief.mockResolvedValue([{ section: "mind", text: "Worried about money.", quotes: [{ quote: "we can't afford it", by: "customer" }] }]);
    expect(await currentCallBrief(input())).toBeNull();
  });

  it("counts against the daily AI ceilings and, past them, shows what it had without asking", async () => {
    tooManyRecentActions.mockResolvedValueOnce(true);
    const stored = checkBrief(proposal, chat.slice(0, 1));
    expect(await currentCallBrief(input({ stored }))).toEqual(stored);
    expect(extractCallBrief).not.toHaveBeenCalled();
    expect(tooManyRecentActions).toHaveBeenCalledWith("biz1", "ai.run:lead1", expect.anything());
  });

  it("doesn't ask when the plan doesn't cover this customer", async () => {
    leadAiRefusal.mockResolvedValueOnce({ ok: false, reason: "x", ownerMessage: "x" } as never);
    expect(await currentCallBrief(input())).toBeNull();
    expect(extractCallBrief).not.toHaveBeenCalled();
  });

  it("falls back to what the Ready card knows when the model can't be asked", async () => {
    extractCallBrief.mockRejectedValue(new Error("down"));
    const qualification = { v: 2, template: "realtor", items: [{ key: "budget", value: "Pre-approved to $950k", quote: "pre-approved up to 950" }], offered: [] };
    const b = await currentCallBrief(input({ qualification }));
    expect(b?.wants[0].text).toBe("Pre-approved to $950k.");
    expect(updateMany).not.toHaveBeenCalled();
  });
});
