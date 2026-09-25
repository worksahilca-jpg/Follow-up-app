/**
 * Telling an owner outside the app that a customer is waiting.
 *
 * The failures on both sides are real. Too quiet, and an owner up a ladder
 * finds out a customer waited all afternoon — the thing the founder asked
 * this to end. Too loud, and a fresh inbox connect sends twelve emails in
 * a minute, or the same customer buzzes the phone every sixty seconds, and
 * the owner turns alerts off for good. Each rule below is one side of that.
 *
 * The approval queue and the push transport are mocked; the rules, the
 * claim ledger, the copy and the Resend request are real.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

type Row = {
  id: string;
  userId: string;
  businessId: string;
  leadId: string | null;
  waitStartedAt: Date | null;
  kind: string;
  emailedAt: Date | null;
  pushedAt: Date | null;
  createdAt: Date;
};

const h = vi.hoisted(() => ({
  rows: [] as Row[],
  approvals: new Map<string, unknown[]>(),
  leads: [] as { id: string; businessId: string; assignedToId: string | null; createdAt: Date; suggestedDraftedFor: Date | null }[],
  users: [] as { id: string; email: string; businessId: string; role: string; alertEmailEnabled: boolean }[],
  lastReply: new Map<string, Date>(),
  firstInbound: new Map<string, Date>(),
  sendPushToUser: vi.fn(),
  pushConfigured: { value: true },
}));

vi.mock("@/lib/db", () => {
  let seq = 0;
  const matches = (r: Row, where: Record<string, unknown>) => {
    const id = where.id as string | { in?: string[] } | undefined;
    if (typeof id === "string" && r.id !== id) return false;
    if (id && typeof id === "object" && id.in && !id.in.includes(r.id)) return false;
    if (where.emailedAt === null && r.emailedAt !== null) return false;
    if (where.pushedAt === null && r.pushedAt !== null) return false;
    if (where.userId && r.userId !== where.userId) return false;
    if (where.kind && r.kind !== where.kind) return false;
    const leadIn = (where.leadId as { in?: string[] } | undefined)?.in;
    if (leadIn && !(r.leadId && leadIn.includes(r.leadId))) return false;
    const em = (where.emailedAt as { gte?: Date } | undefined)?.gte;
    if (em && !(r.emailedAt && r.emailedAt >= em)) return false;
    const cr = (where.createdAt as { gte?: Date } | undefined)?.gte;
    if (cr && !(r.createdAt >= cr)) return false;
    return true;
  };
  return {
    prisma: {
      auditEvent: {
        findMany: vi.fn(async ({ where }: { where: { action: string } }) =>
          where.action === "ai.hold" ? [...h.approvals.keys()].map((businessId) => ({ businessId })) : []
        ),
      },
      lead: {
        findMany: vi.fn(async ({ where }: { where: { id?: { in: string[] }; lastContacted?: unknown } }) => {
          if (where.lastContacted) return [];
          return h.leads.filter((l) => where.id?.in.includes(l.id));
        }),
      },
      message: {
        findFirst: vi.fn(async ({ where }: { where: { direction: string; conversation: { leadId: string } } }) => {
          const leadId = where.conversation.leadId;
          if (where.direction === "outbound") {
            const at = h.lastReply.get(leadId);
            return at ? { sentAt: at } : null;
          }
          const at = h.firstInbound.get(leadId);
          return at ? { sentAt: at } : null;
        }),
      },
      user: {
        findMany: vi.fn(async ({ where }: { where: { role?: string; businessId?: string; id?: { in: string[] } } }) => {
          if (where.role) return h.users.filter((u) => u.role === where.role && u.businessId === where.businessId).map((u) => ({ id: u.id }));
          return h.users
            .filter((u) => where.id?.in.includes(u.id))
            .map((u) => ({ ...u, business: { timezone: "America/Toronto" } }));
        }),
      },
      ownerAlert: {
        findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => h.rows.filter((r) => matches(r, where))),
        count: vi.fn(async ({ where }: { where: Record<string, unknown> }) => h.rows.filter((r) => matches(r, where)).length),
        create: vi.fn(async ({ data }: { data: Partial<Row> }) => {
          if (
            data.leadId &&
            h.rows.some((r) => r.userId === data.userId && r.leadId === data.leadId && r.waitStartedAt?.getTime() === data.waitStartedAt?.getTime())
          ) {
            throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" });
          }
          const row: Row = {
            id: `alert${++seq}`,
            userId: data.userId as string,
            businessId: data.businessId as string,
            leadId: data.leadId ?? null,
            waitStartedAt: data.waitStartedAt ?? null,
            kind: data.kind as string,
            emailedAt: null,
            pushedAt: null,
            createdAt: new Date(),
          };
          h.rows.push(row);
          return { id: row.id };
        }),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
          const row = h.rows.find((r) => r.id === where.id);
          if (row) Object.assign(row, data);
          return row;
        }),
        deleteMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
          const gone = h.rows.filter((r) => matches(r, where));
          for (const r of gone) h.rows.splice(h.rows.indexOf(r), 1);
          return { count: gone.length };
        }),
      },
    },
  };
});

vi.mock("@/lib/pendingApprovals", () => ({
  getPendingApprovals: vi.fn(async (businessId: string) => h.approvals.get(businessId) ?? []),
}));

vi.mock("@/lib/webPush", () => ({
  isPushConfigured: () => h.pushConfigured.value,
  sendPushToUser: h.sendPushToUser,
}));

import { runOwnerAlerts, judgeWait, quote, ALERT_QUOTE_LIMIT, ALERT_RECENT_MS, BACKFILL_SLACK_MS, DAILY_EMAIL_CAP } from "@/lib/ownerAlerts";
import { __resetAlertEmailLogForTests } from "@/lib/alertEmail";

const NOW = new Date("2026-09-25T15:00:00Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

const DRAFT = "Hi Jane, yes it's still available — we can do Saturday at 11.";
const RISK_REASON = "the draft quotes a price nobody in this conversation mentioned";

/** One customer who wrote five minutes ago and has a held reply to that message. */
function addCustomer(n: number, opts: { businessId?: string; assignedToId?: string | null; message?: string; name?: string } = {}) {
  const businessId = opts.businessId ?? "biz1";
  const leadId = `lead${n}`;
  const wroteAt = minutesAgo(5);
  const list = (h.approvals.get(businessId) ?? []) as unknown[];
  list.push({
    leadId,
    leadName: opts.name ?? `Jane${n} Cooper`,
    heldAt: minutesAgo(4),
    reason: RISK_REASON,
    draftMessage: DRAFT,
    leadLastMessage: opts.message ?? `Is the flat still available? (${n})`,
    leadLastMessageChannel: "whatsapp",
    leadLastMessageAt: wroteAt.toISOString(),
  });
  h.approvals.set(businessId, list);
  h.leads.push({
    id: leadId,
    businessId,
    assignedToId: opts.assignedToId === undefined ? null : opts.assignedToId,
    createdAt: minutesAgo(60 * 24),
    suggestedDraftedFor: wroteAt,
  });
  h.firstInbound.set(leadId, wroteAt);
}

const fetchMock = vi.fn();
const emails = () =>
  fetchMock.mock.calls.map((c) => ({ headers: c[1].headers as Record<string, string>, ...JSON.parse(c[1].body as string) }));

beforeEach(() => {
  h.rows.length = 0;
  h.approvals.clear();
  h.leads.length = 0;
  h.lastReply.clear();
  h.firstInbound.clear();
  h.users.length = 0;
  h.users.push({ id: "owner1", email: "owner@shop.test", businessId: "biz1", role: "ADMIN", alertEmailEnabled: true });
  h.pushConfigured.value = true;
  h.sendPushToUser.mockReset();
  h.sendPushToUser.mockResolvedValue({ delivered: 1, removed: 0, failed: 0 });
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => "" });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubEnv("ALERT_FROM_EMAIL", "");
  // Production's shape: the app's own address is the apex, the public site
  // is www — and an alert link must be the www one (src/lib/siteUrl.ts).
  vi.stubEnv("NEXTAUTH_URL", "https://followupbase.io");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
  __resetAlertEmailLogForTests();
});

describe("judgeWait — is this customer waiting, and is it news?", () => {
  const base = {
    heldAt: minutesAgo(4),
    latestInboundAt: minutesAgo(5),
    lastReplyAt: minutesAgo(60),
    leadCreatedAt: minutesAgo(60 * 24),
    draftedFor: minutesAgo(5),
  };

  it("says yes for a customer who just wrote and has a reply waiting", () => {
    expect(judgeWait(base, NOW)).toEqual({ waiting: true });
  });

  it("says no once anyone has answered since they wrote", () => {
    expect(judgeWait({ ...base, lastReplyAt: minutesAgo(1) }, NOW).waiting).toBe(false);
  });

  it("says no for history pulled in by a fresh inbox connect", () => {
    // The thread's newest message is days older than the lead row.
    const v = judgeWait(
      { ...base, lastReplyAt: null, leadCreatedAt: minutesAgo(2), latestInboundAt: minutesAgo(60 * 72), draftedFor: minutesAgo(60 * 72) },
      NOW
    );
    expect(v).toEqual({ waiting: false, reason: "history from before FollowUp was watching" });
  });

  it("still counts a message synced a few minutes after it was sent", () => {
    const leadCreatedAt = minutesAgo(2);
    const latestInboundAt = new Date(leadCreatedAt.getTime() - BACKFILL_SLACK_MS + 60_000);
    expect(judgeWait({ ...base, lastReplyAt: null, leadCreatedAt, latestInboundAt, draftedFor: latestInboundAt }, NOW).waiting).toBe(true);
  });

  it("says no while the waiting draft answers an older message", () => {
    expect(judgeWait({ ...base, draftedFor: minutesAgo(30) }, NOW).waiting).toBe(false);
  });

  it("says no for a backlog the owner already knows about", () => {
    const old = new Date(NOW.getTime() - ALERT_RECENT_MS - 60_000);
    expect(judgeWait({ ...base, heldAt: old, latestInboundAt: old, draftedFor: old, lastReplyAt: null }, NOW).waiting).toBe(false);
  });
});

describe("with no keys set", () => {
  it("does nothing at all — no database, no email, no push", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    h.pushConfigured.value = false;
    addCustomer(1);
    const { prisma } = await import("@/lib/db");
    const result = await runOwnerAlerts(NOW);
    expect(result.skipped).toBeTruthy();
    expect(prisma.auditEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.ownerAlert.create).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(h.sendPushToUser).not.toHaveBeenCalled();
  });

  it("still pushes when only the email key is missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    addCustomer(1);
    await runOwnerAlerts(NOW);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(h.sendPushToUser).toHaveBeenCalledTimes(1);
  });
});

describe("once per waiting customer", () => {
  it("emails and pushes the owner once, then stays quiet on the next tick", async () => {
    addCustomer(1);
    await runOwnerAlerts(NOW);
    expect(emails()).toHaveLength(1);
    expect(h.sendPushToUser).toHaveBeenCalledTimes(1);

    // Nothing changed: the same wait, a minute later.
    await runOwnerAlerts(new Date(NOW.getTime() + 60_000));
    expect(emails()).toHaveLength(1);
    expect(h.sendPushToUser).toHaveBeenCalledTimes(1);
  });

  it("does not alert again when the customer writes more before the owner acts", async () => {
    addCustomer(1);
    await runOwnerAlerts(NOW);
    // A second message: the queue's newest message moves, the wait's first
    // message does not.
    const a = h.approvals.get("biz1")![0] as { leadLastMessageAt: string; leadLastMessage: string };
    a.leadLastMessageAt = minutesAgo(1).toISOString();
    a.leadLastMessage = "Hello?";
    h.leads[0].suggestedDraftedFor = minutesAgo(1);
    await runOwnerAlerts(NOW);
    expect(emails()).toHaveLength(1);
  });

  it("alerts again when the customer writes after the owner acted", async () => {
    addCustomer(1);
    await runOwnerAlerts(NOW);
    // The owner answered; the customer wrote back. A new wait.
    h.lastReply.set("lead1", minutesAgo(3));
    h.firstInbound.set("lead1", minutesAgo(2));
    const a = h.approvals.get("biz1")![0] as { leadLastMessageAt: string };
    a.leadLastMessageAt = minutesAgo(2).toISOString();
    h.leads[0].suggestedDraftedFor = minutesAgo(2);
    await runOwnerAlerts(NOW);
    expect(emails()).toHaveLength(2);
  });

  it("goes to every admin when the lead is unassigned, and only its assignee when it is not", async () => {
    h.users.push({ id: "owner2", email: "partner@shop.test", businessId: "biz1", role: "ADMIN", alertEmailEnabled: true });
    h.users.push({ id: "rep1", email: "rep@shop.test", businessId: "biz1", role: "SALES", alertEmailEnabled: true });
    addCustomer(1);
    addCustomer(2, { assignedToId: "rep1" });
    await runOwnerAlerts(NOW);
    const to = emails().map((e) => `${e.to[0]}:${e.subject}`).sort();
    expect(to).toEqual([
      "owner@shop.test:Jane1 is waiting for your reply",
      "partner@shop.test:Jane1 is waiting for your reply",
      "rep@shop.test:Jane2 is waiting for your reply",
    ]);
  });

  it("never tells someone about another business's customer", async () => {
    // An assignee id that points outside the lead's business.
    h.users.push({ id: "stranger", email: "x@other.test", businessId: "biz2", role: "ADMIN", alertEmailEnabled: true });
    addCustomer(1, { assignedToId: "stranger" });
    await runOwnerAlerts(NOW);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(h.sendPushToUser).not.toHaveBeenCalled();
  });
});

describe("a delivery that really failed is tried again (daily-path sweep 2026-09-25 #2)", () => {
  it("releases the claim when the email service refuses and no phone took it, then alerts on the next run", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    addCustomer(1);
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, text: async () => "unavailable" });
    h.sendPushToUser.mockResolvedValueOnce({ delivered: 0, removed: 0, failed: 1 });
    await runOwnerAlerts(NOW);
    expect(h.rows.filter((r) => r.kind === "customer")).toHaveLength(0);

    await runOwnerAlerts(NOW);
    const rows = h.rows.filter((r) => r.kind === "customer");
    expect(rows).toHaveLength(1);
    expect(rows[0].emailedAt).not.toBeNull();
  });

  it("releases every customer a failed summary covered", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (let n = 1; n <= 5; n++) addCustomer(n);
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, text: async () => "unavailable" });
    h.sendPushToUser.mockResolvedValueOnce({ delivered: 0, removed: 0, failed: 1 });
    await runOwnerAlerts(NOW);
    expect(h.rows).toHaveLength(0);
    await runOwnerAlerts(NOW);
    expect(h.rows.filter((r) => r.kind === "summary")).toHaveLength(1);
  });

  it("keeps the claim when one channel landed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    addCustomer(1);
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, text: async () => "unavailable" });
    await runOwnerAlerts(NOW);
    const rows = h.rows.filter((r) => r.kind === "customer");
    expect(rows).toHaveLength(1);
    expect(rows[0].pushedAt).not.toBeNull();
  });

  it("keeps the claim when nothing was even tried (email off, no phone) — no retry loop", async () => {
    h.users[0].alertEmailEnabled = false;
    addCustomer(1);
    h.sendPushToUser.mockResolvedValue({ delivered: 0, removed: 0, failed: 0 });
    await runOwnerAlerts(NOW);
    await runOwnerAlerts(NOW);
    expect(h.rows.filter((r) => r.kind === "customer")).toHaveLength(1);
  });
});

describe("the burst", () => {
  it("collapses many new waiting customers into one email and one push", async () => {
    for (let i = 1; i <= 12; i++) addCustomer(i);
    await runOwnerAlerts(NOW);
    expect(emails()).toHaveLength(1);
    expect(emails()[0].subject).toBe("12 customers are waiting for your OK");
    expect(h.sendPushToUser).toHaveBeenCalledTimes(1);
    expect(h.sendPushToUser.mock.calls[0][1]).toMatchObject({ title: "12 customers are waiting", url: "/dashboard" });

    // And none of the twelve is named on its own afterwards.
    await runOwnerAlerts(new Date(NOW.getTime() + 60_000));
    expect(emails()).toHaveLength(1);
  });

  it("still names three one by one", async () => {
    for (let i = 1; i <= 3; i++) addCustomer(i);
    await runOwnerAlerts(NOW);
    expect(emails().map((e) => e.subject)).toEqual([
      "Jane1 is waiting for your reply",
      "Jane2 is waiting for your reply",
      "Jane3 is waiting for your reply",
    ]);
  });
});

describe("the daily email cap", () => {
  it(`stops at ${DAILY_EMAIL_CAP} a day with one "more are waiting" note, while push keeps going`, async () => {
    // Twenty-five customers, arriving two at a time so no tick is a burst.
    for (let i = 1; i <= 25; i += 2) {
      addCustomer(i);
      if (i + 1 <= 25) addCustomer(i + 1);
      await runOwnerAlerts(NOW);
    }
    const subjects = emails().map((e) => e.subject);
    expect(subjects.filter((s) => s.endsWith("is waiting for your reply"))).toHaveLength(DAILY_EMAIL_CAP);
    expect(subjects.filter((s) => s === "More customers are waiting for your reply")).toHaveLength(1);
    expect(subjects).toHaveLength(DAILY_EMAIL_CAP + 1);
    expect(h.sendPushToUser).toHaveBeenCalledTimes(25);
  });
});

describe("preferences", () => {
  it("sends no email to someone who turned emails off, and still pushes", async () => {
    h.users[0].alertEmailEnabled = false;
    addCustomer(1);
    await runOwnerAlerts(NOW);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(h.sendPushToUser).toHaveBeenCalledTimes(1);
  });
});

describe("what the owner reads", () => {
  it("names the customer, quotes them briefly, links to their card — and never carries the draft or why it was held", async () => {
    const long = "I'd like to book a viewing for the two-bedroom on Elm Street. ".repeat(6);
    addCustomer(1, { message: long, name: "Jane Cooper" });
    await runOwnerAlerts(NOW);
    const [mail] = emails();
    expect(mail.subject).toBe("Jane is waiting for your reply");
    expect(mail.from).toBe("FollowUp <alerts@followupbase.io>");
    expect(mail.headers.Authorization).toBe("Bearer re_test_key");
    expect(mail.text).toContain("Jane Cooper wrote on WhatsApp:");
    expect(mail.text).toContain("FollowUp's reply is ready — open it to send.");
    expect(mail.text).toContain("https://www.followupbase.io/leads/lead1");
    const quoted = mail.text.split("\n").find((l: string) => l.startsWith('"'))!;
    expect(quoted.length - 2).toBeLessThanOrEqual(ALERT_QUOTE_LIMIT);
    for (const body of [mail.text, mail.html]) {
      expect(body).not.toContain(DRAFT);
      expect(body).not.toContain(RISK_REASON);
    }

    const push = h.sendPushToUser.mock.calls[0][1];
    expect(push).toMatchObject({ title: "Jane is waiting", url: "/leads/lead1", tag: "lead-lead1" });
    expect(push.body.length).toBeLessThanOrEqual(ALERT_QUOTE_LIMIT);
    expect(JSON.stringify(push)).not.toContain(RISK_REASON);
  });

  it("says 'A customer' rather than a placeholder name", async () => {
    addCustomer(1, { name: "Instagram DM" });
    await runOwnerAlerts(NOW);
    expect(emails()[0].subject).toBe("A customer is waiting for your reply");
  });

  it("escapes what the customer wrote in the HTML email", async () => {
    addCustomer(1, { message: '<img src=x onerror="alert(1)">' });
    await runOwnerAlerts(NOW);
    expect(emails()[0].html).not.toContain("<img");
  });

  it("quote() never exceeds the limit and flattens line breaks", () => {
    const q = quote("line one\n\nline two ".repeat(40));
    expect(q.length).toBeLessThanOrEqual(ALERT_QUOTE_LIMIT);
    expect(q).not.toContain("\n");
  });
});
