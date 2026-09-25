/**
 * FollowUp's own Instagram send, read back by the poller, must come back as
 * NOTHING: no new Message, no new Lead (audit 2026-09-24 F2, the test that
 * audit asks for).
 *
 * Before the fix both halves were broken, and production showed it on
 * 2026-09-25: the founder's business had a lead whose phone was its own
 * account (ig:17841427527466039), and both outbound Instagram messages had
 * no externalId.
 *   - sendInstagramMessage threw Meta's message_id away, so FollowUp's row
 *     had nothing for the read-back to match on;
 *   - the poller compared `from.id` against the app-scoped id only, so the
 *     account's own message (from its professional-account id) was rebuilt
 *     as an inbound DM from the business itself.
 *
 * Everything here is the real code — sendInstagramMessage, the poller,
 * processMetaEnvelope, findOrCreateLeadByInstagram, captureDirectReply,
 * findOrCreateConversation — over a small in-memory stand-in for the
 * tables they touch, with the same unique keys as the schema
 * (Message.externalId, Lead (businessId, phone)). Only fetch (Meta) and the
 * AI/notification side effects are stubbed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const state = { businesses: [] as Row[], leads: [] as Row[], conversations: [] as Row[], messages: [] as Row[] };
  let seq = 0;
  const newId = (prefix: string) => `${prefix}-${++seq}`;
  const uniqueViolation = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
  const pick = (row: Row, select?: Record<string, boolean>) =>
    select ? Object.fromEntries(Object.keys(select).map((k) => [k, row[k] ?? null])) : row;
  type Args = { where: Row; data?: Row; select?: Record<string, boolean>; create?: Row };

  const prisma = {
    business: {
      findUnique: async ({ where, select }: Args) => {
        const [key, value] = Object.entries(where)[0];
        const row = value == null ? undefined : state.businesses.find((b) => b[key] === value);
        return row ? pick(row, select) : null;
      },
      update: async ({ where, data }: Args) => Object.assign(state.businesses.find((b) => b.id === where.id)!, data),
    },
    lead: {
      findFirst: async ({ where }: Args) => state.leads.find((l) => l.businessId === where.businessId && l.phone === where.phone) ?? null,
      create: async ({ data }: Args) => {
        if (state.leads.some((l) => l.businessId === data!.businessId && l.phone === data!.phone)) throw uniqueViolation();
        const row = { id: newId("lead"), assignedToId: null, ...data };
        state.leads.push(row);
        return row;
      },
      update: async ({ where, data }: Args) => Object.assign(state.leads.find((l) => l.id === where.id)!, data),
    },
    conversation: {
      findFirst: async ({ where }: Args) => state.conversations.find((c) => c.leadId === where.leadId && c.channel === where.channel) ?? null,
      create: async ({ data }: Args) => {
        const row = { id: newId("conv"), ...data };
        state.conversations.push(row);
        return row;
      },
    },
    message: {
      create: async ({ data }: Args) => {
        if (data!.externalId && state.messages.some((m) => m.externalId === data!.externalId)) throw uniqueViolation();
        const row = { id: newId("msg"), source: null, ...data };
        state.messages.push(row);
        return row;
      },
      upsert: async ({ where, create }: Args) => {
        const existing = state.messages.find((m) => m.externalId === where.externalId);
        if (existing) return existing;
        const row = { id: newId("msg"), ...create };
        state.messages.push(row);
        return row;
      },
    },
    user: { findMany: async () => [] },
    notification: { create: async () => ({}) },
  };
  return { state, prisma };
});
vi.mock("@/lib/db", () => ({ prisma: db.prisma }));

vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn(async () => null) }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn(async () => {}) }));
vi.mock("@/lib/monitoring", () => ({ recordAuthFailure: vi.fn() }));
vi.mock("@/lib/facebook", () => ({ findOrCreateLeadByMessenger: vi.fn(), fetchLeadgenLead: vi.fn(), upsertLeadFromLeadgen: vi.fn() }));
const { acknowledgeNewLead, scoreAndDraftForLead } = vi.hoisted(() => ({
  acknowledgeNewLead: vi.fn(async () => ({ sent: false })),
  scoreAndDraftForLead: vi.fn(async () => true),
}));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead }));
vi.mock("@/lib/scoring", () => ({ scoreAndDraftForLead }));
vi.mock("@/lib/engagement", () => ({ checkRapidEngagement: vi.fn() }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/suppression", () => ({ suppress: vi.fn(), unsuppress: vi.fn() }));

import { sendInstagramMessage } from "@/lib/instagram";
import { pollInstagramForBusiness } from "@/lib/instagramPoll";

const APP_SCOPED = "28693476873589439";
const PROFESSIONAL = "17841427527466039";
const LEAD = "3141592653589793";
const TOKEN = "IGAAT-secret";
const MID = "aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDI3NTI3NDY2MDM5";

const metaTime = (msAgo: number) => new Date(Date.now() - msAgo).toISOString().replace(/\.\d{3}Z$/, "+0000");

/** Meta: the Send API, the conversation list, and one thread holding `messages`. */
function meta(messages: Record<string, unknown>[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST" && url.includes("/messages")) {
        return new Response(JSON.stringify({ recipient_id: LEAD, message_id: MID }));
      }
      if (url.includes("/conversations?")) return new Response(JSON.stringify({ data: [{ id: "t1", updated_time: metaTime(5_000) }] }));
      return new Response(JSON.stringify({ messages: { data: messages } }));
    })
  );
}

const business = {
  id: "biz1",
  instagramUserId: APP_SCOPED,
  instagramAccountId: PROFESSIONAL as string | null,
  instagramAccessToken: TOKEN,
  instagramSyncedAt: null as Date | null,
};
const poll = () => pollInstagramForBusiness({ ...business, instagramSyncedAt: new Date(Date.now() - 5 * 60_000) });

beforeEach(() => {
  vi.clearAllMocks();
  db.state.businesses.length = 0;
  db.state.leads.length = 0;
  db.state.conversations.length = 0;
  db.state.messages.length = 0;
  db.state.businesses.push({ ...business });
  db.state.leads.push({ id: "lead-real", businessId: "biz1", phone: `ig:${LEAD}`, name: "@sahildoes", assignedToId: null });
  db.state.conversations.push({ id: "conv-real", leadId: "lead-real", channel: "instagram" });
});

describe("FollowUp's own Instagram send, read back by the poller", () => {
  it("keeps Meta's message id from the send", async () => {
    meta([]);
    const sent = await sendInstagramMessage("biz1", LEAD, "Yes, Saturday works.");
    expect(sent).toEqual({ success: true, messageId: MID });
  });

  it("creates no Message and no Lead", async () => {
    meta([
      {
        id: MID,
        created_time: metaTime(5_000),
        from: { id: PROFESSIONAL, username: "followupbase" },
        to: { data: [{ id: LEAD }] },
        message: "Yes, Saturday works.",
      },
    ]);
    const sent = await sendInstagramMessage("biz1", LEAD, "Yes, Saturday works.");
    // Recorded the way sendFollowUpToLead records it — externalId is Meta's
    // message id (that step is pinned in instagramSendExternalId.test.ts).
    db.state.messages.push({ id: "msg-ours", conversationId: "conv-real", direction: "outbound", body: "Yes, Saturday works.", externalId: sent.messageId, source: null, trigger: "manual" });

    await poll();

    expect(db.state.leads.map((l) => l.phone)).toEqual([`ig:${LEAD}`]);
    expect(db.state.messages).toHaveLength(1);
    expect(db.state.messages[0]).toEqual(expect.objectContaining({ id: "msg-ours", source: null, trigger: "manual" }));
    // Nothing was acknowledged, scored or drafted about the business's own words.
    expect(acknowledgeNewLead).not.toHaveBeenCalled();
    expect(scoreAndDraftForLead).not.toHaveBeenCalled();
  });

  it("still captures the owner's own reply from the phone, once, on the real lead", async () => {
    meta([
      { id: "mid-native", created_time: metaTime(5_000), from: { id: PROFESSIONAL }, to: { data: [{ id: LEAD }] }, message: "On my way!" },
    ]);
    await poll();
    await poll(); // a second tick re-reads the same message

    expect(db.state.leads).toHaveLength(1);
    expect(db.state.messages).toEqual([
      expect.objectContaining({ conversationId: "conv-real", direction: "outbound", source: "instagram_direct", externalId: "mid-native" }),
    ]);
  });
});
