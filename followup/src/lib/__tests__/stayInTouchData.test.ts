/**
 * "Stay in touch" (A-260): the yes is only heard as an answer to the
 * close-the-loop question, a stop ends it without asking anyone, and notes
 * are written only for customers they fit, held for the owner, never sent.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { lead, business, stayInTouchNews } = vi.hoisted(() => ({
  lead: { update: vi.fn(), updateMany: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  business: { findUnique: vi.fn(), update: vi.fn() },
  stayInTouchNews: { create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: { lead, business, stayInTouchNews } }));
const { recordAudit } = vi.hoisted(() => ({ recordAudit: vi.fn(async () => true) }));
vi.mock("@/lib/audit", () => ({ recordAudit }));
const { tooManyRecentActions } = vi.hoisted(() => ({ tooManyRecentActions: vi.fn(async () => false) }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions }));
const { heldSince } = vi.hoisted(() => ({ heldSince: vi.fn<(businessId: string, leadId: string, since: Date) => Promise<boolean>>(async () => false) }));
vi.mock("@/lib/pendingApprovals", () => ({ heldSince }));
const { classifyStayInTouchAnswer, writeStayInTouchNote } = vi.hoisted(() => ({
  classifyStayInTouchAnswer: vi.fn(),
  writeStayInTouchNote: vi.fn(),
}));
vi.mock("@/lib/integrations/openai", () => ({ classifyStayInTouchAnswer, writeStayInTouchNote }));
vi.mock("@/lib/scoring", () => ({ AI_RUNS_PER_LEAD_PER_DAY: { windowMinutes: 1440, max: 30 }, AI_RUNS_PER_BUSINESS_PER_DAY: { windowMinutes: 1440, max: 500 } }));

import { judgeStayInTouchReply, writeStayNotes, type StayLead } from "@/lib/stayInTouchData";

const H = 3_600_000;
const D = 24 * H;
const NOW = new Date(Date.UTC(2026, 9, 15, 15));
let n = 0;
const msg = (direction: "inbound" | "outbound", at: number, body = "…") => ({ id: `m${++n}`, direction, body, sentAt: new Date(at), trigger: null, quickReplyPayload: null });

/** A customer who wrote, got a reply, then the five Fast messages (the last closes the loop), then answered. */
function afterClose(answer: string, overrides: Partial<StayLead> = {}): StayLead {
  const start = NOW.getTime() - 40 * D;
  const messages = [
    msg("inbound", start - H, "Hi, we're thinking of moving to Oakville next spring."),
    msg("outbound", start, "Hi, yes, Oakville is where I do most of my work."),
    ...[1, 3, 7, 14].map((d) => msg("outbound", start + d * D)),
    msg("outbound", start + 30 * D, "Should I keep sending you Oakville homes, or close your file for now?"),
    msg("inbound", start + 30 * D + 2 * H, answer),
  ];
  return {
    id: "lead1",
    businessId: "biz1",
    createdAt: new Date(start - H),
    lastContacted: new Date(start + 30 * D),
    followUpPlan: null,
    followUpNotBefore: null,
    qualification: null,
    stayInTouchAt: null,
    stayInTouchMessageId: null,
    stayInTouchNoteAt: null,
    conversations: [{ channel: "email", messages }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  n = 0;
  lead.update.mockResolvedValue({});
  lead.updateMany.mockResolvedValue({ count: 1 });
  business.update.mockResolvedValue({});
  stayInTouchNews.create.mockResolvedValue({ id: "news1" });
  stayInTouchNews.update.mockResolvedValue({});
});

describe("hearing the yes", () => {
  it("a yes to the close-the-loop question starts it, with the message and the date kept", async () => {
    classifyStayInTouchAnswer.mockResolvedValue("yes");
    const l = afterClose("Yes please keep sending, we're still looking");
    const yesId = l.conversations[0].messages.at(-1)!.id;
    expect(await judgeStayInTouchReply(l, null, NOW)).toBe("yes");
    expect(classifyStayInTouchAnswer.mock.calls[0][0].asked).toMatch(/close your file/);
    expect(lead.update).toHaveBeenCalledWith({ where: { id: "lead1" }, data: { stayInTouchAt: NOW, stayInTouchMessageId: yesId, stayInTouchNoteAt: null } });
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), "lead.stay_in_touch", expect.objectContaining({ meta: { decision: "yes" } }));
  });

  it("an unclear answer changes nothing, and isn't asked about twice", async () => {
    classifyStayInTouchAnswer.mockResolvedValue("unclear");
    const l = afterClose("What about Burlington?");
    expect(await judgeStayInTouchReply(l, null, NOW)).toBe("unclear");
    expect(lead.update).not.toHaveBeenCalled();
    const id = l.conversations[0].messages.at(-1)!.id;
    expect(lead.updateMany.mock.calls[0][0].data).toEqual({ stayInTouchMessageId: id });
    expect(await judgeStayInTouchReply({ ...l, stayInTouchMessageId: id }, null, NOW)).toBeNull();
    expect(classifyStayInTouchAnswer).toHaveBeenCalledTimes(1);
  });

  it("isn't asked at all when the last message wasn't the close-the-loop one", async () => {
    const start = NOW.getTime() - 5 * D;
    const l = afterClose("", {
      conversations: [{ channel: "email", messages: [msg("inbound", start - H, "Hi"), msg("outbound", start, "Hello"), msg("outbound", start + 3 * D), msg("inbound", start + 4 * D, "yes")] }],
    });
    expect(await judgeStayInTouchReply(l, null, NOW)).toBeNull();
    expect(classifyStayInTouchAnswer).not.toHaveBeenCalled();
  });

  it("nothing to judge when the business wrote last", async () => {
    const l = afterClose("Yes please");
    l.conversations[0].messages.push(msg("outbound", NOW.getTime() - H, "Great, will do"));
    expect(await judgeStayInTouchReply(l, null, NOW)).toBeNull();
  });
});

describe("ending it", () => {
  const staying = (answer: string) => {
    const noteAt = NOW.getTime() - 3 * D;
    return afterClose("", {
      stayInTouchAt: new Date(NOW.getTime() - 40 * D),
      stayInTouchMessageId: "yes1",
      stayInTouchNoteAt: new Date(noteAt),
      conversations: [{ channel: "email", messages: [msg("inbound", noteAt - 30 * D, "Yes please"), msg("outbound", noteAt + H, "Hi Anika, a new one in Oakville…"), msg("inbound", noteAt + 2 * H, answer)] }],
    });
  };

  it("STOP ends it at once, without asking anyone", async () => {
    expect(await judgeStayInTouchReply(staying("STOP"), null, NOW)).toBe("no");
    expect(classifyStayInTouchAnswer).not.toHaveBeenCalled();
    expect(lead.update.mock.calls[0][0].data.stayInTouchAt).toBeNull();
  });

  it("a no in their own words, answering a note, ends it", async () => {
    classifyStayInTouchAnswer.mockResolvedValue("no");
    expect(await judgeStayInTouchReply(staying("We bought last month, you can stop these"), null, NOW)).toBe("no");
    expect(lead.update.mock.calls[0][0].data.stayInTouchAt).toBeNull();
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), "lead.stay_in_touch", expect.objectContaining({ meta: { decision: "no" } }));
  });
});

describe("writing the notes", () => {
  const staying = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
    id,
    name,
    email: `${id}@example.com`,
    dmEmail: null,
    language: null,
    languageScript: null,
    languageRegister: null,
    saidNoAt: null,
    stayInTouchAt: new Date(NOW.getTime() - 40 * D),
    stayInTouchNoteAt: null,
    conversations: [{ channel: "email", messages: [msg("inbound", NOW.getTime() - 40 * D, "Looking in Oakville around 1.2M")] }],
    ...extra,
  });

  beforeEach(() => {
    business.findUnique.mockResolvedValue({ name: "Priya Sharma Realty", industry: "Real estate", stayInTouchDays: 30 });
  });

  it("holds a note for each customer it fits, says why, and sends nothing", async () => {
    lead.findMany.mockResolvedValue([staying("a", "Anika Nair"), staying("t", "Tom Becker")]);
    writeStayInTouchNote.mockImplementation(async (input: { firstName: string }) =>
      input.firstName === "Anika"
        ? { fits: true, why: "it's in Oakville and close to $1.2M, which is what Anika wants", note: "Hi Anika, a 4-bed in Glen Abbey just listed at $1.19M." }
        : { fits: false, why: "wants a 2-bed condo in Liberty Village", note: "" }
    );
    const result = await writeStayNotes({ businessId: "biz1", userId: "u1" }, "A 4-bed in Glen Abbey just listed at $1.19M.", NOW);
    expect(result.fit).toEqual(["Anika"]);
    expect(result.notFit).toEqual([{ first: "Tom", why: "wants a 2-bed condo in Liberty Village" }]);
    const write = lead.update.mock.calls.find((c) => c[0].where.id === "a")![0];
    expect(write.data.suggestedDraftKind).toBe("stay_in_touch");
    expect(write.data.suggestedMessage).toMatch(/stop these notes/);
    expect(write.data.stayInTouchNoteAt).toEqual(NOW);
    expect(recordAudit).toHaveBeenCalledWith(
      { businessId: "biz1", userId: "u1" },
      "ai.hold",
      expect.objectContaining({ targetId: "a", meta: expect.objectContaining({ trigger: "stay_in_touch", riskLevel: "owner" }) })
    );
    expect(lead.findMany.mock.calls[0][0].where).toMatchObject({ businessId: "biz1", stayInTouchAt: { not: null }, optedOutAt: null });
    expect(business.update).toHaveBeenCalledWith({ where: { id: "biz1" }, data: { stayInTouchAskedAt: NOW } });
  });

  it("leaves anyone who had a note recently, has a message waiting, or said no", async () => {
    lead.findMany.mockResolvedValue([
      staying("recent", "Raj", { stayInTouchNoteAt: new Date(NOW.getTime() - 5 * D) }),
      staying("held", "Mei"),
      staying("no", "Jo", { saidNoAt: new Date(NOW.getTime() - D) }),
    ]);
    heldSince.mockImplementation(async (_b: string, id: string) => id === "held");
    const result = await writeStayNotes({ businessId: "biz1", userId: "u1" }, "Open house Saturday 2 to 4 in Oakville.", NOW);
    expect(result).toMatchObject({ fit: [], notDue: 1, waiting: 1 });
    expect(writeStayInTouchNote).not.toHaveBeenCalled();
  });

  it("can't write on Instagram past Meta's day, so says so instead", async () => {
    lead.findMany.mockResolvedValue([
      staying("ig", "Sara", { email: null, conversations: [{ channel: "instagram", messages: [msg("inbound", NOW.getTime() - 3 * D, "yes keep me posted")] }] }),
    ]);
    const result = await writeStayNotes({ businessId: "biz1", userId: "u1" }, "Open house Saturday 2 to 4 in Oakville.", NOW);
    expect(result.unreachable).toBe(1);
    expect(writeStayInTouchNote).not.toHaveBeenCalled();
  });

  it("stops at the daily AI ceiling, like every other AI run", async () => {
    lead.findMany.mockResolvedValue([staying("a", "Anika")]);
    tooManyRecentActions.mockResolvedValue(true);
    const result = await writeStayNotes({ businessId: "biz1", userId: "u1" }, "Open house Saturday 2 to 4 in Oakville.", NOW);
    expect(result.waiting).toBe(1);
    expect(writeStayInTouchNote).not.toHaveBeenCalled();
  });
});
