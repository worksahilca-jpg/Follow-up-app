/**
 * Bug b015: with two Gmail inboxes, a reply could go out from the wrong one.
 *
 * PR #399 made the sync read each connected inbox on its own, but sending,
 * "Sync now", push and the push watch still found "the business's Gmail"
 * with an unordered findFirst. On a business with two inboxes Postgres may
 * return either row, so a reply to a lead who wrote to inbox B could be sent
 * from inbox A: the customer got an answer from an address they never wrote
 * to, outside their thread.
 *
 * Driven through the real send path (sendFollowUpToLead → gmail.ts) and the
 * real sync/watch code, against:
 *  - a fake Integration table that returns rows in an arbitrary order (the
 *    newest connection first) unless the query asks for an order, and then
 *    sorts the way Postgres would;
 *  - a fake Gmail where each mailbox is keyed by its refresh token, so "sent
 *    with B's credentials" and "found in B's mailbox" are literal.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type Header = { name: string; value: string };
type GmailMsg = { id: string; threadId: string; headers: Header[] };
type Row = {
  id: string;
  status: string;
  refreshToken: string;
  accountEmail: string | null;
  loginEmail: string;
  connectedAt: Date | null;
  lastSyncedAt: Date | null;
  watchExpiration: Date | null;
};
type OrderSpec = Record<string, "asc" | "desc" | { sort: "asc" | "desc"; nulls?: "first" | "last" }>;

const state = vi.hoisted(() => ({
  rows: [] as Row[],
  // Mailbox contents, by refresh token.
  mailboxes: {} as Record<string, GmailMsg[]>,
  // A failure a mailbox answers every read with, by refresh token.
  failWith: {} as Record<string, Error>,
  sends: [] as { token: string; threadId?: string; raw: string }[],
  reads: [] as { token: string; api: string; id: string }[],
  lists: [] as { token: string; q: string }[],
  watches: [] as string[],
}));

/** Postgres-style ORDER BY over the fake rows; no orderBy means "whatever order": here, stored order. */
function ordered(rows: Row[], orderBy: OrderSpec[] | undefined): Row[] {
  if (!orderBy) return rows;
  return [...rows].sort((a, b) => {
    for (const spec of orderBy) {
      const [key, how] = Object.entries(spec)[0];
      const dir = typeof how === "string" ? how : how.sort;
      const nulls = typeof how === "string" ? "last" : (how.nulls ?? "last");
      const av = (a as Record<string, unknown>)[key] as Date | string | null;
      const bv = (b as Record<string, unknown>)[key] as Date | string | null;
      if (av === bv) continue;
      if (av === null) return nulls === "first" ? -1 : 1;
      if (bv === null) return nulls === "first" ? 1 : -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
    }
    return 0;
  });
}

type Where = {
  provider?: string;
  status?: string;
  id?: string;
  accountEmail?: { equals: string };
  user?: { businessId?: string; email?: { equals: string } };
};
function matching(where: Where): Row[] {
  return state.rows.filter(
    (r) =>
      (!where.provider || where.provider === "gmail") &&
      (!where.status || r.status === where.status) &&
      (!where.id || r.id === where.id) &&
      (!where.accountEmail || r.accountEmail?.toLowerCase() === where.accountEmail.equals.toLowerCase()) &&
      (!where.user?.businessId || where.user.businessId === "biz1") &&
      (!where.user?.email || r.loginEmail.toLowerCase() === where.user.email.equals.toLowerCase())
  );
}
const shaped = (r: Row) => ({
  ...r,
  accessToken: null,
  watchHistoryId: null,
  user: { email: r.loginEmail, name: "Sam", businessId: "biz1" },
});

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    integration: {
      findFirst: vi.fn(async ({ where, orderBy }: { where: Where; orderBy?: OrderSpec[] }) => {
        const r = ordered(matching(where), orderBy)[0];
        return r ? shaped(r) : null;
      }),
      findMany: vi.fn(async ({ where, orderBy }: { where: Where; orderBy?: OrderSpec[] }) => ordered(matching(where), orderBy).map(shaped)),
      update: vi.fn(async () => ({})),
      updateMany: vi.fn(async ({ where }: { where: Where }) => ({ count: matching(where).length })),
    },
    lead: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(async () => []) },
    conversation: { findFirst: vi.fn(), create: vi.fn() },
    sendClaim: { create: vi.fn(), updateMany: vi.fn(async () => ({ count: 0 })), deleteMany: vi.fn() },
    message: { create: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(async () => 1) },
    followUp: { create: vi.fn(), findFirst: vi.fn() },
    business: {
      findUnique: vi.fn(async () => ({ allowModelTraining: false, name: "Sam's Plumbing", industry: "trades", users: [], subscriptionStatus: "active", tier: "plus" })),
    },
    outboundSend: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

function gmailError(status: number, message: string): Error {
  return Object.assign(new Error(message), { status, code: status });
}

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: class {
        token = "";
        setCredentials(c: { refresh_token?: string }) {
          this.token = c.refresh_token ?? "";
        }
      },
    },
    gmail: ({ auth }: { auth: { token: string } }) => {
      const token = auth.token;
      const box = () => {
        if (state.failWith[token]) throw state.failWith[token];
        return state.mailboxes[token] ?? [];
      };
      return {
        users: {
          messages: {
            get: async ({ id }: { id: string }) => {
              state.reads.push({ token, api: "messages.get", id });
              const m = box().find((x) => x.id === id);
              if (!m) throw gmailError(404, "Requested entity was not found.");
              return { data: { id: m.id, threadId: m.threadId, payload: { headers: m.headers } } };
            },
            send: async ({ requestBody }: { requestBody: { raw: string; threadId?: string } }) => {
              state.sends.push({ token, threadId: requestBody.threadId, raw: Buffer.from(requestBody.raw, "base64").toString("utf8") });
              return { data: { id: `sent-${state.sends.length}` } };
            },
          },
          threads: {
            get: async ({ id }: { id: string }) => {
              state.reads.push({ token, api: "threads.get", id });
              const msgs = box().filter((x) => x.threadId === id);
              if (msgs.length === 0) throw gmailError(404, "Requested entity was not found.");
              return { data: { id, messages: msgs.map((m) => ({ id: m.id, payload: { headers: m.headers } })) } };
            },
            list: async ({ q }: { q: string }) => {
              state.lists.push({ token, q });
              return { data: { threads: [] } };
            },
          },
          watch: async () => {
            state.watches.push(token);
            return { data: { expiration: String(Date.now() + 6 * 86_400_000), historyId: "1" } };
          },
          getProfile: async () => ({ data: { emailAddress: null } }),
        },
      };
    },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/integrations/openai", () => ({ classifyAsProspect: vi.fn(), classifyWithSecondLook: vi.fn() }));
vi.mock("@/lib/senderVerdicts", () => ({ OWNER_SAID_NOT_CUSTOMER: "x", ownerSaidNotCustomer: vi.fn(async () => false), recentCorrections: vi.fn(async () => []) }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn() }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn() }));
vi.mock("@/lib/engagement", () => ({ checkRapidEngagement: vi.fn() }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn() }));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead: vi.fn() }));
vi.mock("@/lib/integrations/outlook", () => ({ getOutlookStatus: vi.fn(async () => ({ connected: false })), sendOutlookEmail: vi.fn() }));
vi.mock("@/lib/twilio", () => ({ sendSms: vi.fn(), sendWhatsApp: vi.fn() }));
vi.mock("@/lib/instagram", () => ({ sendInstagramMessage: vi.fn() }));
vi.mock("@/lib/facebook", () => ({ sendMessengerMessage: vi.fn() }));
vi.mock("@/lib/crm", () => ({ CRM_PROVIDERS: {}, isCrmProvider: vi.fn(() => false) }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/sendCaps", () => ({ checkSendCap: vi.fn(async () => ({ allowed: true, used: 0, cap: 50 })) }));
vi.mock("@/lib/suppression", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/suppression")>()),
  isSuppressed: vi.fn(async () => false),
}));
vi.mock("@/lib/scoring", () => ({ scoreAndDraftForLead: vi.fn(async () => false) }));
vi.mock("@/lib/outcomes", () => ({ detectReplies: vi.fn(async () => 0) }));
vi.mock("@/lib/gmailSyncNotices", () => ({
  gmailAccessEndingSoon: vi.fn(() => false),
  notifyGmailAccessLost: vi.fn(),
  notifyIfGmailSyncKeepsFailing: vi.fn(),
  readGmailSyncSnapshot: vi.fn(async () => null),
  warnGmailAccessEndingSoon: vi.fn(),
}));
vi.mock("@/lib/billing", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/billing")>()),
  hasActiveAccess: vi.fn(() => true),
}));

import { sendFollowUpToLead } from "@/lib/sending";
import { ensureGmailWatch, findBusinessIdByGmailAddress, resolveGmailInbox, sendEmail } from "@/lib/integrations/gmail";
import { syncGmailForBusiness, syncGmailForBusinessFromPush } from "@/lib/gmailSync";
import { GMAIL_INBOX_ORDER } from "@/lib/gmailInboxOrder";

// Inbox A: the owner's, connected first. Inbox B: the shop's shared
// address, connected later by a second admin. Stored newest-first, so any
// lookup that doesn't ask for an order lands on B.
const A: Row = {
  id: "intA", status: "connected", refreshToken: "rt-A", accountEmail: "sam@samsplumbing.ca", loginEmail: "sam@samsplumbing.ca",
  connectedAt: new Date("2026-01-10T00:00:00Z"), lastSyncedAt: new Date("2026-09-30T10:00:00Z"), watchExpiration: null,
};
const B: Row = {
  id: "intB", status: "connected", refreshToken: "rt-B", accountEmail: "info@samsplumbing.ca", loginEmail: "jo@samsplumbing.ca",
  connectedAt: new Date("2026-06-01T00:00:00Z"), lastSyncedAt: new Date("2026-09-30T11:00:00Z"), watchExpiration: null,
};

const JANE_IN_B: GmailMsg = {
  id: "msg-B-1",
  threadId: "thread-B",
  headers: [
    { name: "Message-ID", value: "<jane-kitchen@mail.example>" },
    { name: "Subject", value: "Kitchen reno quote?" },
    { name: "Delivered-To", value: "info@samsplumbing.ca" },
    { name: "To", value: "Sam's Plumbing <info@samsplumbing.ca>" },
  ],
};
const OTHER_IN_A: GmailMsg = {
  id: "msg-A-1",
  threadId: "thread-A",
  headers: [
    { name: "Message-ID", value: "<bob-bath@mail.example>" },
    { name: "Subject", value: "Bathroom leak" },
    { name: "Delivered-To", value: "sam@samsplumbing.ca" },
  ],
};

/** The lead's newest inbound email, as emailReplyTarget reads it. */
function leadsNewestEmail(found: { externalId: string; conversation: { externalId: string | null } } | null) {
  prismaMock.message.findFirst.mockImplementation(async (args: { where?: { conversation?: { channel?: string } } }) =>
    args?.where?.conversation?.channel === "email" ? found : null
  );
}
const from = (raw: string) => raw.match(/^From: (.*)$/m)?.[1];
const header = (raw: string, name: string) => raw.match(new RegExp(`^${name}: (.*)$`, "m"))?.[1];

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("GOOGLE_CLIENT_ID", "client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
  vi.stubEnv("GOOGLE_REDIRECT_URI", "https://followupbase.io/api/integrations/gmail/callback");
  state.rows = [{ ...B }, { ...A }];
  state.mailboxes = { "rt-A": [OTHER_IN_A], "rt-B": [JANE_IN_B] };
  state.failWith = {};
  state.sends = [];
  state.reads = [];
  state.lists = [];
  state.watches = [];
  prismaMock.lead.findUnique.mockResolvedValue({
    id: "lead1", businessId: "biz1", name: "Jane Doe", email: "jane@example.com", phone: null,
    optedOutAt: null, crmProvider: null, crmId: null, suggestedMessage: null,
  });
  prismaMock.lead.update.mockResolvedValue({});
  prismaMock.conversation.findFirst.mockResolvedValue({ id: "conv1", emailProvider: "gmail" });
  prismaMock.message.create.mockResolvedValue({});
  prismaMock.message.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.followUp.create.mockResolvedValue({});
  prismaMock.followUp.findFirst.mockResolvedValue(null);
  prismaMock.outboundSend.findFirst.mockResolvedValue(null);
  leadsNewestEmail({ externalId: JANE_IN_B.id, conversation: { externalId: JANE_IN_B.threadId } });
});

// Both orders an unordered read could return the two rows in: the old
// lookup was right in one of them and wrong in the other.
const EITHER_ORDER: [string, () => Row[]][] = [
  ["A stored first", () => [{ ...A }, { ...B }]],
  ["B stored first", () => [{ ...B }, { ...A }]],
];

describe("two inboxes: a reply goes out from the inbox the lead wrote to", () => {
  it.each(EITHER_ORDER)("replies to a lead from inbox B with B's credentials, in B's thread, from B's address (%s)", async (_, rows) => {
    state.rows = rows();
    const result = await sendFollowUpToLead("lead1", "Happy to quote — Tuesday at 3?", { trigger: "manual" });

    expect(result.success).toBe(true);
    expect(state.sends).toHaveLength(1);
    const [sent] = state.sends;
    expect(sent.token).toBe("rt-B");
    expect(sent.threadId).toBe("thread-B");
    expect(from(sent.raw)).toBe("info@samsplumbing.ca");
    expect(header(sent.raw, "In-Reply-To")).toBe("<jane-kitchen@mail.example>");
    expect(header(sent.raw, "Subject")).toBe("Re: Kitchen reno quote?");
  });

  it.each(EITHER_ORDER)("does the same for an automated follow-up (%s)", async (_, rows) => {
    state.rows = rows();
    await sendFollowUpToLead("lead1", "Just checking in on the quote.", { trigger: "silence", automated: true, channel: "email" });
    expect(state.sends.map((s) => [s.token, s.threadId])).toEqual([["rt-B", "thread-B"]]);
  });

  it("still picks B when B is the OLDER connection (not just the one an unordered read returns)", async () => {
    state.rows = [
      { ...A, connectedAt: new Date("2026-08-01T00:00:00Z") },
      { ...B, connectedAt: new Date("2026-02-01T00:00:00Z") },
    ];
    await sendFollowUpToLead("lead1", "Tuesday works.", { trigger: "manual" });
    expect(state.sends.map((s) => [s.token, s.threadId])).toEqual([["rt-B", "thread-B"]]);
  });

  it.each(EITHER_ORDER)("sends a caller's own thread (the instant ack, the retry queue) from the inbox that holds it (%s)", async (_, rows) => {
    state.rows = rows();
    await sendFollowUpToLead("lead1", "Thanks — got it.", {
      trigger: "instant_ack", automated: true, channel: "email", subject: "Re: Kitchen reno quote?",
      emailThreadId: "thread-B", emailInReplyTo: "<jane-kitchen@mail.example>",
    });
    expect(state.sends).toHaveLength(1);
    expect(state.sends[0].token).toBe("rt-B");
    expect(state.sends[0].threadId).toBe("thread-B");
    expect(from(state.sends[0].raw)).toBe("info@samsplumbing.ca");
  });

  it.each(EITHER_ORDER)("sends from B even when B won't give the reply headers back (a fresh email, from the right inbox) (%s)", async (_, rows) => {
    state.rows = rows();
    // B holds the message (the probe finds it), but it has no Message-ID
    // header to thread under.
    state.mailboxes["rt-B"] = [{ ...JANE_IN_B, headers: JANE_IN_B.headers.filter((h) => h.name !== "Message-ID") }];
    const result = await sendFollowUpToLead("lead1", "Hi Jane, following up.", { trigger: "manual", subject: "Your enquiry" });
    expect(result.success).toBe(true);
    expect(state.sends).toHaveLength(1);
    expect(state.sends[0].token).toBe("rt-B");
    expect(state.sends[0].threadId).toBeUndefined();
  });

  it("when both mailboxes have the id, the one it was addressed to wins", async () => {
    // A holds a copy too (same ids), not addressed to A's own address.
    state.mailboxes["rt-A"] = [{ ...JANE_IN_B, headers: JANE_IN_B.headers.filter((h) => h.name !== "Delivered-To") }];
    expect(await resolveGmailInbox("biz1", { threadId: "thread-B", messageId: "msg-B-1" })).toBe("intB");
  });

  it("never guesses when an inbox can't be asked: the send fails instead of going out from A", async () => {
    state.failWith["rt-B"] = gmailError(503, "Backend Error");
    const result = await sendFollowUpToLead("lead1", "Tuesday works.", { trigger: "manual" });
    expect(result.success).toBe(false);
    expect(result.failure).toBe("transient");
    expect(state.sends).toEqual([]);
  });
});

describe("one inbox: behaviour unchanged", () => {
  beforeEach(() => {
    state.rows = [{ ...A }];
    state.mailboxes = { "rt-A": [OTHER_IN_A, { ...JANE_IN_B, threadId: "thread-B" }] };
  });

  it("replies from the only inbox, threaded, with no extra Gmail read to find it", async () => {
    const result = await sendFollowUpToLead("lead1", "Happy to quote — Tuesday at 3?", { trigger: "manual" });
    expect(result.success).toBe(true);
    expect(state.sends).toHaveLength(1);
    expect(state.sends[0].token).toBe("rt-A");
    expect(state.sends[0].threadId).toBe("thread-B");
    expect(header(state.sends[0].raw, "In-Reply-To")).toBe("<jane-kitchen@mail.example>");
    // Exactly the one header read the send always made — no probe.
    expect(state.reads).toEqual([{ token: "rt-A", api: "messages.get", id: "msg-B-1" }]);
  });

  it("the instant ack's own thread goes out from the only inbox with no Gmail read at all", async () => {
    await sendFollowUpToLead("lead1", "Thanks — got it.", {
      trigger: "instant_ack", automated: true, channel: "email", subject: "Re: Hello", emailThreadId: "ackThread", emailInReplyTo: "<ack@x>",
    });
    expect(state.reads).toEqual([]);
    expect(state.sends.map((s) => [s.token, s.threadId])).toEqual([["rt-A", "ackThread"]]);
  });

  it("a lead with no email thread still gets a fresh email from the only inbox", async () => {
    leadsNewestEmail(null);
    await sendFollowUpToLead("lead1", "Hi Jane, following up.", { trigger: "manual", subject: "Your enquiry" });
    expect(state.sends).toHaveLength(1);
    expect(state.sends[0].token).toBe("rt-A");
    expect(state.sends[0].threadId).toBeUndefined();
    expect(header(state.sends[0].raw, "Subject")).toBe("Your enquiry");
  });
});

describe("the fallback, when the inbox can't be known, is the oldest connection — every time", () => {
  it("a reply whose thread is gone from every inbox goes out from the oldest, whatever order the rows come back in", async () => {
    state.mailboxes = { "rt-A": [], "rt-B": [] };
    for (const rows of [[{ ...B }, { ...A }], [{ ...A }, { ...B }]]) {
      state.rows = rows;
      state.sends = [];
      await sendFollowUpToLead("lead1", "Hi Jane, following up.", { trigger: "manual", subject: "Your enquiry" });
      expect(state.sends.map((s) => s.token)).toEqual(["rt-A"]);
      expect(state.sends[0].threadId).toBeUndefined();
    }
  });

  it("mail that isn't a reply (the weekly email, a team invite) goes from the oldest connection", async () => {
    for (const rows of [[{ ...B }, { ...A }], [{ ...A }, { ...B }]]) {
      state.rows = rows;
      state.sends = [];
      await sendEmail("biz1", { to: "sam@samsplumbing.ca", subject: "Your week", body: "…" });
      expect(state.sends.map((s) => s.token)).toEqual(["rt-A"]);
    }
  });

  it("a connection from before connectedAt was recorded counts as the oldest", async () => {
    state.rows = [{ ...A }, { ...B, connectedAt: null }];
    await sendEmail("biz1", { to: "sam@samsplumbing.ca", subject: "Your week", body: "…" });
    expect(state.sends.map((s) => s.token)).toEqual(["rt-B"]);
  });
});

describe("Sync now, push and the push watch read the same inbox every time", () => {
  it("Sync now reads the oldest connection", async () => {
    await syncGmailForBusiness("biz1");
    // Two searches (the inbox, and lead sites under Updates — b017), both in A.
    expect(state.lists.map((l) => l.token)).toEqual(["rt-A", "rt-A"]);
  });

  it("a push sync reads the oldest connection, from that inbox's own sync clock", async () => {
    await syncGmailForBusinessFromPush("biz1");
    expect(state.lists).toHaveLength(2);
    expect(state.lists.map((l) => l.token)).toEqual(["rt-A", "rt-A"]);
    // A's lastSyncedAt minus the 15-minute overlap — not B's, which an
    // unordered read of the same rows would have returned.
    const sinceA = Math.floor((A.lastSyncedAt!.getTime() - 15 * 60_000) / 1000);
    for (const l of state.lists) expect(l.q).toContain(`after:${sinceA}`);
  });

  it("the push watch is set on the oldest connection", async () => {
    vi.stubEnv("GMAIL_PUSH_TOPIC", "projects/p/topics/gmail");
    expect(await ensureGmailWatch("biz1")).toEqual({ active: true });
    expect(state.watches).toEqual(["rt-A"]);
  });

  it("a push notification is matched on the connected address before a login email", async () => {
    // B's admin signs in as jo@, and a third row's login email is info@ —
    // B connected info@ as its inbox, so B's business is the answer.
    state.rows = [
      { ...A, id: "intC", loginEmail: "info@samsplumbing.ca", accountEmail: "other@samsplumbing.ca", connectedAt: new Date("2025-01-01T00:00:00Z") },
      { ...B },
    ];
    expect(await findBusinessIdByGmailAddress("INFO@samsplumbing.ca")).toBe("biz1");
    const firstRead = prismaMock.integration.findFirst.mock.calls[0][0] as { where: Where; orderBy?: unknown };
    expect(firstRead.where.accountEmail).toEqual({ equals: "info@samsplumbing.ca", mode: "insensitive" });
    expect(firstRead.where.user).toBeUndefined();
    expect(firstRead.orderBy).toEqual(GMAIL_INBOX_ORDER);
  });
});
