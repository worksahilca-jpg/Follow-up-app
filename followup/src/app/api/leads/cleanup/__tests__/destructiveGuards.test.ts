/**
 * Regression: POST /api/leads/cleanup permanently deletes leads — and
 * everything under them, bookings included — on an AI verdict, with no
 * undo.
 *
 * What it did before this suite existed:
 *  - it selected EVERY lead with source "Gmail". A won customer with a
 *    booked appointment carries that source forever, so they were judged
 *    on their first three emails like a newsletter and deleted along with
 *    their deal and their appointment.
 *  - a lead a human had rescued from the filtered list ("this was a lead")
 *    came back tagged source "Gmail" with nothing recording the override,
 *    so the next run re-judged it and could delete it again — silently
 *    reversing the owner using the same verdict they had already rejected.
 *  - the transcript was flattened from lead.conversations with no ordering
 *    on the conversations themselves, and classifyAsProspect reads only the
 *    first three messages. A lead keyed (businessId, email) routinely holds
 *    several threads, so "the first three" was an arbitrary thread's.
 *  - nothing per-lead was written down. One meta-less audit event named no
 *    one, and the list of what was deleted existed only in an HTTP response
 *    that a serverless timeout throws away.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/** Whatever Prisma was handed — asserted on, never type-checked against the real client here. */
type PrismaArgs = { where: Record<string, unknown> };

const { businessFindUnique, leadFindMany, leadCount } = vi.hoisted(() => ({
  businessFindUnique: vi.fn(),
  leadFindMany: vi.fn<(args: PrismaArgs) => Promise<unknown[]>>(),
  leadCount: vi.fn<(args: PrismaArgs) => Promise<number>>(),
}));

/** The `where` of a mocked Prisma call, or a failure that says so. */
function whereOf(calls: [PrismaArgs][] | PrismaArgs[][]): Record<string, unknown> {
  const where = calls[0]?.[0]?.where;
  if (!where) throw new Error("expected a Prisma call carrying a where clause");
  return where;
}
vi.mock("@/lib/db", () => ({
  prisma: {
    business: { findUnique: businessFindUnique },
    lead: { findMany: leadFindMany, count: leadCount },
  },
}));

const { getSessionContext, requireAdmin } = vi.hoisted(() => ({
  getSessionContext: vi.fn(),
  requireAdmin: vi.fn(async () => true),
}));
vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));

const { tooManyRecentActions } = vi.hoisted(() => ({ tooManyRecentActions: vi.fn(async () => false) }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions }));

const { classifyAsProspect } = vi.hoisted(() => ({ classifyAsProspect: vi.fn() }));
vi.mock("@/lib/integrations/openai", () => ({ classifyAsProspect }));

const { deleteLeadCascade, archiveLeadThreadsAsFiltered } = vi.hoisted(() => ({
  deleteLeadCascade: vi.fn(async () => {}),
  archiveLeadThreadsAsFiltered: vi.fn(async () => 1),
}));
vi.mock("@/lib/leads-admin", () => ({ deleteLeadCascade, archiveLeadThreadsAsFiltered }));

const { recordAudit } = vi.hoisted(() => ({ recordAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/audit", () => ({ recordAudit }));

import { POST } from "@/app/api/leads/cleanup/route";

/** A minimal Gmail-sourced lead shaped like the route's include. */
function lead(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead1",
    name: "Dana Reyes",
    email: "dana@example.com",
    conversations: [
      {
        channel: "email",
        externalId: "thread-1",
        emailProvider: "gmail",
        messages: [
          { id: "m1", direction: "inbound", body: "Hi, are you hiring?", sentAt: new Date("2026-01-01T09:00:00Z"), opened: false },
        ],
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "test-key-placeholder");
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "user1", email: "owner@acme.com" });
  requireAdmin.mockResolvedValue(true);
  tooManyRecentActions.mockResolvedValue(false);
  businessFindUnique.mockResolvedValue({ subscriptionStatus: "active", name: "Acme", industry: "roofing" });
  leadFindMany.mockResolvedValue([]);
  leadCount.mockResolvedValue(0);
  classifyAsProspect.mockResolvedValue({ isProspect: false, reason: "Recruiter outreach, not a customer." });
  archiveLeadThreadsAsFiltered.mockResolvedValue(1);
  deleteLeadCascade.mockResolvedValue(undefined);
});

describe("POST /api/leads/cleanup — who it is allowed to delete", () => {
  it("never puts a won, booked, replied-to or human-rescued lead in front of the classifier", async () => {
    await POST();

    const where = whereOf(leadFindMany.mock.calls);

    // The owner's own pipeline outranks the model: only leads still sitting
    // where the importer left them are eligible.
    expect(where.stage).toBe("NEW");
    // Money they recorded, and an appointment in someone's calendar.
    expect(where.deals).toEqual({ none: {} });
    expect(where.bookings).toEqual({ none: {} });
    // A human already overruled this classifier for this lead.
    expect(where.classificationOverriddenAt).toBeNull();
    // Somebody replied in the thread.
    expect(where.AND).toContainEqual({
      conversations: { none: { messages: { some: { direction: "outbound" } } } },
    });
    // Still tenant-scoped and still Gmail-only.
    expect(where.businessId).toBe("biz1");
    expect(where.source).toBe("Gmail");
  });

  it("counts `remaining` over the same guarded set, not every Gmail lead", async () => {
    await POST();

    // Counting all Gmail leads would report every won customer and every
    // lead with a booking as work still to do — a number that can never
    // reach zero, because this route will never touch them again.
    expect(whereOf(leadCount.mock.calls)).toEqual(whereOf(leadFindMany.mock.calls));
    expect(whereOf(leadCount.mock.calls).bookings).toEqual({ none: {} });
  });
});

describe("POST /api/leads/cleanup — what the classifier is shown", () => {
  it("judges the lead on its globally-oldest messages, not on an arbitrary thread's", async () => {
    // Two threads for one contact, returned by Postgres in the order it
    // felt like. The genuinely oldest messages are in the SECOND one.
    leadFindMany.mockResolvedValue([
      lead({
        conversations: [
          {
            channel: "email",
            externalId: "thread-new",
            emailProvider: "gmail",
            messages: [
              { id: "b1", direction: "inbound", body: "newsletter", sentAt: new Date("2026-03-01T10:00:00Z"), opened: false },
              { id: "b2", direction: "inbound", body: "newsletter again", sentAt: new Date("2026-03-02T10:00:00Z"), opened: false },
              { id: "b3", direction: "inbound", body: "newsletter once more", sentAt: new Date("2026-03-03T10:00:00Z"), opened: false },
            ],
          },
          {
            channel: "email",
            externalId: "thread-old",
            emailProvider: "gmail",
            messages: [
              { id: "a1", direction: "inbound", body: "quote for a new roof?", sentAt: new Date("2026-01-01T10:00:00Z"), opened: false },
              { id: "a2", direction: "inbound", body: "we are ready to book", sentAt: new Date("2026-01-02T10:00:00Z"), opened: false },
            ],
          },
        ],
      }),
    ]);
    classifyAsProspect.mockResolvedValue({ isProspect: true, reason: "Asked for a quote." });

    await POST();

    const transcript = (classifyAsProspect.mock.calls[0]?.[0] ?? []) as { id: string }[];
    // classifyAsProspect reads the first three. They must be the three
    // oldest messages this lead has, deterministically, whatever order the
    // conversations came back in.
    expect(transcript.slice(0, 3).map((m) => m.id)).toEqual(["a1", "a2", "b1"]);
  });
});

describe("POST /api/leads/cleanup — recording a deletion", () => {
  it("archives the thread and writes an awaited audit row before the lead is gone", async () => {
    leadFindMany.mockResolvedValue([lead()]);

    const res = await POST();
    const body = await res.json();

    expect(body.removedCount).toBe(1);

    // Restorable: the same FilteredEmail record the sync writes, so the
    // deletion shows up in Settings with a one-click "this was a lead".
    expect(archiveLeadThreadsAsFiltered).toHaveBeenCalledWith(
      "biz1",
      expect.objectContaining({ id: "lead1" }),
      "Recruiter outreach, not a customer."
    );
    // Archived BEFORE the rows are destroyed, never after.
    expect(archiveLeadThreadsAsFiltered.mock.invocationCallOrder[0]).toBeLessThan(
      deleteLeadCascade.mock.invocationCallOrder[0]
    );

    // The delete states its own tenant rather than trusting a bare id.
    expect(deleteLeadCascade).toHaveBeenCalledWith("lead1", "biz1");

    // A record that outlives the HTTP response: id, name and the reason.
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: "biz1" }),
      "lead.cleanup_deleted",
      expect.objectContaining({
        targetType: "lead",
        targetId: "lead1",
        meta: expect.objectContaining({ name: "Dana Reyes", reason: "Recruiter outreach, not a customer." }),
      })
    );
  });

  it("does not report a lead as removed when the deletion itself failed", async () => {
    leadFindMany.mockResolvedValue([lead()]);
    deleteLeadCascade.mockRejectedValue(new Error("transaction aborted"));

    const res = await POST();
    const body = await res.json();

    expect(body.removedCount).toBe(0);
    expect(body.kept[0].reason).toContain("transaction aborted");
    // And says what actually failed. Reporting a failed DELETE as a
    // "Classification error" sends whoever reads this response looking at
    // OpenAI for a database problem.
    expect(body.kept[0].reason).toContain("Removal failed");
  });

  it("keeps a lead the classifier approves, and writes no deletion record for it", async () => {
    leadFindMany.mockResolvedValue([lead()]);
    classifyAsProspect.mockResolvedValue({ isProspect: true, reason: "Asked about pricing." });

    const res = await POST();
    const body = await res.json();

    expect(body.removedCount).toBe(0);
    expect(deleteLeadCascade).not.toHaveBeenCalled();
    expect(archiveLeadThreadsAsFiltered).not.toHaveBeenCalled();
  });
});
