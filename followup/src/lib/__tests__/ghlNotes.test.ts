/**
 * "Read my notes" (A-303): FollowUp reads the owner's own notes on a customer in GoHighLevel, like call notes, as
 * evidence for where they stand, and their stage follows. Never FollowUp's own notes, only new ones, a few at a time,
 * within the daily AI ceilings, and nothing is drafted or sent from a note.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const h = vi.hoisted(() => ({
  leadUpdate: vi.fn(),
  leadFind: vi.fn(),
  leadClaim: vi.fn(),
  conns: vi.fn(),
  extract: vi.fn(),
  move: vi.fn(),
  limited: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: { lead: { update: h.leadUpdate, findMany: h.leadFind, updateMany: h.leadClaim }, crmConnection: { findMany: h.conns } } }));
vi.mock("@/lib/integrations/openai", () => ({ extractQualificationFacts: h.extract }));
vi.mock("@/lib/crm/stages", async (orig) => ({ ...(await orig<typeof import("@/lib/crm/stages")>()), moveLeadForTier: h.move }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions: h.limited }));
vi.mock("@/lib/billing", () => ({ hasActiveAccess: () => true }));
vi.mock("@/lib/scoring", () => ({ AI_RUNS_PER_LEAD_PER_DAY: { windowMinutes: 1440, max: 30 }, AI_RUNS_PER_BUSINESS_PER_DAY: { windowMinutes: 1440, max: 500 } }));

import { isFollowUpNote, newOwnerNotes, readGhlNotesForAllBusinesses, readNotesForLead } from "@/lib/ghlNotes";
import { goHighLevelClient, plainNote } from "@/lib/crm/gohighlevel";
import { mergeQualification, templateFor } from "@/lib/qualification";

const NOW = new Date("2026-10-20T18:00:00Z");
const ago = (hours: number) => new Date(NOW.getTime() - hours * 3600_000);
const note = (id: string, body: string, at: Date | null) => ({ id, body, at });

function lead(over: Record<string, unknown> = {}) {
  return {
    id: "lead1",
    businessId: "biz1",
    name: "Priya Shah",
    crmProvider: "gohighlevel",
    crmId: "c1",
    crmNotesSeenAt: null,
    qualification: null,
    conversations: [],
    business: { industry: "Real estate", askPlan: null },
    ...over,
  } as unknown as Parameters<typeof readNotesForLead>[0];
}

beforeEach(() => {
  vi.resetAllMocks();
  h.limited.mockResolvedValue(false);
  h.leadUpdate.mockResolvedValue({});
  h.leadClaim.mockResolvedValue({ count: 1 });
});
afterEach(() => vi.restoreAllMocks());

describe("which notes", () => {
  it("never FollowUp's own", () => {
    expect(isFollowUpNote("FollowUp sent:\n\nHi Priya")).toBe(true);
    expect(isFollowUpNote("FollowUp: Priya looks ready to talk.")).toBe(true);
    expect(isFollowUpNote("Called Priya, she wants to wait 3 months")).toBe(false);
  });

  it("only new ones, oldest first; on the first look, the last 30 days", () => {
    const notes = [
      note("n1", "Old call: just browsing", ago(24 * 40)),
      note("n2", "FollowUp sent:\n\nHi", ago(5)),
      note("n3", "Called, pre-approved, wants to see places this weekend", ago(2)),
      note("n4", "No date on this one", null),
      note("n5", "Spoke again, will wait till spring", ago(1)),
    ];
    expect(newOwnerNotes(notes, null, NOW).map((n) => n.id)).toEqual(["n3", "n5"]);
    expect(newOwnerNotes(notes, ago(1.5), NOW).map((n) => n.id)).toEqual(["n5"]);
  });

  it("GoHighLevel's note text is read as plain words", () => {
    expect(plainNote("<p>Called Priya&nbsp;&amp; her husband</p><p>Wants&nbsp;3 beds</p>")).toBe("Called Priya & her husband\nWants 3 beds");
  });

  it("GoHighLevel lists a contact's notes, and nothing when it can't", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ notes: [{ id: "n1", body: "<p>Hot buyer</p>", dateAdded: "2026-10-20T15:00:00Z" }, { id: "", body: "x" }] }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await goHighLevelClient.listNotes!("LOC12345|tok_abcdefghij", "c1")).toEqual([{ id: "n1", body: "Hot buyer", at: new Date("2026-10-20T15:00:00Z") }]);
    expect(fetchMock.mock.calls[0][0]).toBe("https://services.leadconnectorhq.com/contacts/c1/notes");
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) });
    expect(await goHighLevelClient.listNotes!("LOC12345|tok_abcdefghij", "c1")).toEqual([]);
    vi.unstubAllGlobals();
  });
});

describe("a note counts as evidence, marked as the owner's", () => {
  it("only when the quote is really in the note", () => {
    const template = templateFor("Real estate")!;
    const q = mergeQualification(
      template,
      null,
      [
        { key: "side", known: true, value: "Buying", quote: "wants to buy", bucket: "buy" },
        { key: "timing", known: true, value: "In about 3 months", quote: "wait about 3 months", bucket: "months" },
        { key: "area", known: true, value: "Brampton", quote: "Brampton only" },
      ],
      ["Hi, I saw your post"],
      null,
      ["Called her, wants to buy but will wait about 3 months"]
    );
    expect(q.items.find((i) => i.key === "timing")).toMatchObject({ quote: "wait about 3 months", source: "note" });
    expect(q.items.find((i) => i.key === "area")).toBeUndefined();
    expect(q.tier).toBe("warm");
  });
});

describe("reading one customer's notes", () => {
  it("reads the new ones, keeps what they show, and moves them", async () => {
    vi.spyOn(goHighLevelClient, "listNotes").mockResolvedValue([note("n1", "Called her, wants to buy but will wait about 3 months", ago(1))]);
    h.extract.mockResolvedValue([
      { key: "side", known: true, value: "Buying", quote: "wants to buy", bucket: "buy" },
      { key: "timing", known: true, value: "In about 3 months", quote: "wait about 3 months", bucket: "months" },
    ]);
    expect(await readNotesForLead(lead(), "LOC|key", NOW)).toBe("read");
    expect(h.extract.mock.calls[0][3]).toEqual([note("n1", "Called her, wants to buy but will wait about 3 months", ago(1))]);
    const data = h.leadUpdate.mock.calls[0][0].data;
    expect(data.crmNotesSeenAt).toEqual(ago(1));
    expect(data.qualification.tier).toBe("warm");
    expect(h.move).toHaveBeenCalledWith(expect.objectContaining({ id: "lead1" }), "warm", "From your note: “wait about 3 months”");
  });

  it("with nothing new, only notes the look", async () => {
    vi.spyOn(goHighLevelClient, "listNotes").mockResolvedValue([note("n1", "FollowUp sent:\n\nHi", ago(1))]);
    expect(await readNotesForLead(lead(), "LOC|key", NOW)).toBe("none");
    expect(h.extract).not.toHaveBeenCalled();
    expect(h.leadUpdate).toHaveBeenCalledWith({ where: { id: "lead1" }, data: { crmNotesCheckedAt: NOW } });
    expect(h.move).not.toHaveBeenCalled();
  });

  it("past the day's AI ceiling, the notes wait unread for the next look", async () => {
    vi.spyOn(goHighLevelClient, "listNotes").mockResolvedValue([note("n1", "Called, ready now", ago(1))]);
    h.limited.mockResolvedValue(true);
    expect(await readNotesForLead(lead(), "LOC|key", NOW)).toBe("held");
    expect(h.extract).not.toHaveBeenCalled();
    expect(h.leadUpdate.mock.calls[0][0].data).not.toHaveProperty("crmNotesSeenAt");
  });

  it("a failed read is tried again next time, from the same place", async () => {
    vi.spyOn(goHighLevelClient, "listNotes").mockResolvedValue([note("n1", "Called, ready now", ago(1))]);
    h.extract.mockRejectedValue(new Error("timeout"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await readNotesForLead(lead(), "LOC|key", NOW)).toBe("held");
    expect(h.leadUpdate.mock.calls[0][0].data).not.toHaveProperty("crmNotesSeenAt");
    expect(h.move).not.toHaveBeenCalled();
  });

  it("nothing for a business that isn't real estate", async () => {
    const listNotes = vi.spyOn(goHighLevelClient, "listNotes");
    expect(await readNotesForLead(lead({ business: { industry: "Plumbing", askPlan: null } }), "LOC|key", NOW)).toBe("none");
    expect(listNotes).not.toHaveBeenCalled();
  });
});

describe("after each poll", () => {
  const conn = { businessId: "biz1", apiKey: "LOC|key", business: { subscriptionStatus: "active", industry: "Real estate" } };

  it("only businesses that read notes, a few customers each, the least recently looked at first", async () => {
    h.conns.mockResolvedValue([conn]);
    h.leadFind.mockResolvedValue([]);
    await readGhlNotesForAllBusinesses(NOW);
    expect(h.conns.mock.calls[0][0].where).toMatchObject({ provider: "gohighlevel", readNotes: true });
    const q = h.leadFind.mock.calls[0][0];
    expect(q.where).toMatchObject({ businessId: "biz1", crmProvider: "gohighlevel" });
    expect(q.take).toBe(10);
    expect(q.orderBy).toEqual({ crmNotesCheckedAt: { sort: "asc", nulls: "first" } });
  });

  it("never customers FollowUp leaves alone: said stop or no, won or lost", async () => {
    h.conns.mockResolvedValue([conn]);
    h.leadFind.mockResolvedValue([]);
    await readGhlNotesForAllBusinesses(NOW);
    expect(h.leadFind.mock.calls[0][0].where).toMatchObject({ optedOutAt: null, saidNoAt: null, stage: { notIn: ["WON", "LOST"] } });
  });

  it("a customer another poll already took is skipped, and a long poll stops starting new ones", async () => {
    const listNotes = vi.spyOn(goHighLevelClient, "listNotes").mockResolvedValue([]);
    h.conns.mockResolvedValue([conn]);
    h.leadFind.mockResolvedValue([lead({ id: "a" }), lead({ id: "b" }), lead({ id: "c" })]);
    h.leadClaim.mockResolvedValueOnce({ count: 0 }).mockResolvedValue({ count: 1 });
    let t = 0;
    const clock = () => (t += 50_000);
    const out = await readGhlNotesForAllBusinesses(NOW, clock);
    // "a" was taken by another poll; "b" read; the budget runs out before "c".
    expect(out.looked).toBe(1);
    expect(listNotes).toHaveBeenCalledTimes(1);
  });
});
