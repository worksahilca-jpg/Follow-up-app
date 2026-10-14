/**
 * Every write FollowUp makes in the owner's CRM is on record and tried again
 * when the CRM doesn't take it (A-252): "Couldn't reach Follow Up Boss. Tried
 * again at 1:15 PM: done. Nothing was lost."
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  conn: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  findMany: vi.fn(),
  deleteMany: vi.fn(),
  pushNote: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    crmConnection: { findUnique: h.conn },
    crmWrite: { create: h.create, update: h.update, updateMany: h.updateMany, findMany: h.findMany, deleteMany: h.deleteMany },
  },
}));
vi.mock("@/lib/crm", () => ({
  isCrmProvider: (v: string) => v === "followupboss" || v === "hubspot",
  CRM_PROVIDERS: {
    followupboss: { label: "Follow Up Boss", client: { pushNote: h.pushNote } },
    hubspot: { label: "HubSpot", client: { pushNote: h.pushNote } },
  },
}));

import { writeToCrm, retryCrmWrites, pruneCrmWrites, MAX_ATTEMPTS, KEEP_DAYS } from "@/lib/crm/writes";

const now = new Date("2026-10-14T18:00:00Z");
const min = (m: number) => new Date(now.getTime() + m * 60_000);
const note = { businessId: "biz1", leadId: "lead1", provider: "followupboss", crmId: "fub-7", kind: "note" as const, text: "FollowUp sent:\n\nHi Nadia" };
const connected = { provider: "followupboss", apiKey: "key", writesPausedAt: null };

beforeEach(() => {
  vi.resetAllMocks();
  h.conn.mockResolvedValue(connected);
  h.create.mockResolvedValue({ id: "w1" });
  h.update.mockResolvedValue({});
  h.updateMany.mockResolvedValue({ count: 1 });
  h.findMany.mockResolvedValue([]);
  h.deleteMany.mockResolvedValue({ count: 0 });
});

describe("writeToCrm", () => {
  it("writes the note and records it done", async () => {
    h.pushNote.mockResolvedValue({ ok: true });
    expect(await writeToCrm(note, now)).toBe("done");
    expect(h.pushNote).toHaveBeenCalledWith("key", "fub-7", note.text);
    expect(h.create.mock.calls[0][0].data).toMatchObject({ leadId: "lead1", kind: "note", status: "trying", attempts: 1, text: note.text });
    expect(h.update.mock.calls[0][0].data).toMatchObject({ status: "done", nextTryAt: null });
  });

  it("keeps a note the CRM didn't take, to try again in 5 minutes", async () => {
    h.pushNote.mockResolvedValue({ ok: false, message: "Follow Up Boss returned 503." });
    expect(await writeToCrm(note, now)).toBe("waiting");
    expect(h.update.mock.calls[0][0].data).toEqual({ status: "waiting", lastError: "Follow Up Boss returned 503.", nextTryAt: min(5) });
  });

  it("records nothing when the business isn't connected to that CRM, or paused writing there", async () => {
    for (const conn of [null, { ...connected, apiKey: null }, { ...connected, provider: "hubspot" }, { ...connected, writesPausedAt: now }]) {
      h.conn.mockResolvedValueOnce(conn);
      expect(await writeToCrm(note, now)).toBe("skipped");
    }
    expect(h.create).not.toHaveBeenCalled();
    expect(h.pushNote).not.toHaveBeenCalled();
  });

  it("never throws, whatever breaks", async () => {
    h.create.mockRejectedValue(new Error("db down"));
    await expect(writeToCrm(note, now)).resolves.toBe("skipped");
  });
});

describe("retryCrmWrites", () => {
  const due = (over: Record<string, unknown> = {}) => ({
    id: "w1", businessId: "biz1", provider: "followupboss", crmId: "fub-7", kind: "note", text: "Hi", status: "waiting", attempts: 1, nextTryAt: min(-1), ...over,
  });

  it("asks only for writes whose wait is over, including a try cut short", async () => {
    await retryCrmWrites(now);
    expect(h.findMany.mock.calls[0][0].where).toEqual({ status: { in: ["waiting", "trying"] }, nextTryAt: { lte: now } });
  });

  it("tries a waiting write again and records it done", async () => {
    h.findMany.mockResolvedValue([due()]);
    h.pushNote.mockResolvedValue({ ok: true });
    expect(await retryCrmWrites(now)).toEqual({ tried: 1, done: 1, failed: 0 });
    expect(h.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: "w1", status: "waiting" }, data: { status: "trying", attempts: 2 } });
    expect(h.update.mock.calls[0][0].data).toMatchObject({ status: "done", nextTryAt: null });
  });

  it("waits longer after each miss, then gives up", async () => {
    h.pushNote.mockResolvedValue({ ok: false, message: "timeout" });
    h.findMany.mockResolvedValue([due({ attempts: 1 })]);
    await retryCrmWrites(now);
    expect(h.update.mock.calls[0][0].data).toEqual({ status: "waiting", lastError: "timeout", nextTryAt: min(15) });

    h.update.mockClear();
    h.findMany.mockResolvedValue([due({ attempts: MAX_ATTEMPTS - 1 })]);
    expect((await retryCrmWrites(now)).failed).toBe(1);
    expect(h.update.mock.calls[0][0].data).toEqual({ status: "failed", lastError: "timeout", nextTryAt: null });
  });

  it("doesn't write twice when another run claimed it first", async () => {
    h.findMany.mockResolvedValue([due()]);
    h.updateMany.mockResolvedValue({ count: 0 });
    expect(await retryCrmWrites(now)).toEqual({ tried: 0, done: 0, failed: 0 });
    expect(h.pushNote).not.toHaveBeenCalled();
  });

  it("ends a write whose business left that CRM", async () => {
    h.findMany.mockResolvedValue([due()]);
    h.conn.mockResolvedValue({ ...connected, provider: "hubspot" });
    expect((await retryCrmWrites(now)).failed).toBe(1);
    expect(h.update.mock.calls[0][0].data).toMatchObject({ status: "failed", lastError: "No longer connected to this CRM." });
    expect(h.pushNote).not.toHaveBeenCalled();
  });

  it("holds a write while writing is paused, without using up a try", async () => {
    h.findMany.mockResolvedValue([due({ attempts: 2 })]);
    h.conn.mockResolvedValue({ ...connected, writesPausedAt: now });
    await retryCrmWrites(now);
    expect(h.update.mock.calls[0][0].data).toEqual({ status: "waiting", nextTryAt: min(60) });
    expect(h.updateMany).not.toHaveBeenCalled();
    expect(h.pushNote).not.toHaveBeenCalled();
  });
});

describe("pruneCrmWrites", () => {
  it("keeps the record 30 days", async () => {
    await pruneCrmWrites(now);
    expect(h.deleteMany).toHaveBeenCalledWith({ where: { createdAt: { lt: new Date(now.getTime() - KEEP_DAYS * 86_400_000) } } });
  });
});
