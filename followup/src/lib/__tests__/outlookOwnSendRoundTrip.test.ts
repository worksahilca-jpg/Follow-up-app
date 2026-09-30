/**
 * A message FollowUp sent through Outlook, read back by the next sync, is
 * the same message, not a second one written by a person.
 *
 * Gmail's send returns the new message's id, which is stored on the
 * Message row, so the sync's read-back of the sent copy lands on that row.
 * Graph's /reply (and /sendMail) return nothing, so FollowUp's row for an
 * Outlook send has no id, and the next fetch of that conversation (the
 * customer writing again, or simply the owner opening their email in
 * Outlook, which Graph's delta reports as a change) stored the sent copy as
 * a new outbound row with no trigger. A row with no trigger is how an
 * owner's own reply looks (Message.trigger), so:
 *  - after FollowUp's instant "got your message", the customer read as
 *    answered: the 3-hour first-reply rule and the Today queue dropped a
 *    lead nobody had actually answered (the audit 2026-09-16 F2 bug, back
 *    for Outlook);
 *  - every Outlook send showed twice in the thread.
 *
 * The sync now claims FollowUp's own row for the read-back when it is
 * plainly the same message (same words, sent within minutes), the way
 * sending.ts already claims a Meta echo.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type Row = {
  id: string;
  conversationId: string;
  direction: string;
  body: string;
  sentAt: Date;
  externalId: string | null;
  trigger: string | null;
  source: string | null;
};

const store = vi.hoisted(() => ({ messages: [] as Row[] }));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    integration: { findFirst: vi.fn() },
    business: { findUnique: vi.fn() },
    filteredEmail: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    lead: { findUnique: vi.fn(), updateMany: vi.fn(async () => ({ count: 1 })), findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn() },
    conversation: { findUnique: vi.fn(), create: vi.fn() },
    message: {
      upsert: vi.fn(async ({ where, create }: { where: { externalId: string }; create: Omit<Row, "id" | "trigger" | "source"> }) => {
        const found = store.messages.find((m) => m.externalId === where.externalId);
        if (found) return found;
        const row = { ...create, id: `row-${store.messages.length + 1}`, trigger: null, source: null };
        store.messages.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where }: { where: { externalId: string } }) => store.messages.find((m) => m.externalId === where.externalId) ?? null),
      findMany: vi.fn(
        async ({ where }: { where: { externalId: null; direction: string; source: null; sentAt: { gte: Date; lte: Date } } }) =>
          store.messages.filter(
            (m) =>
              m.externalId === null &&
              m.direction === where.direction &&
              m.source === null &&
              m.trigger !== null &&
              m.sentAt >= where.sentAt.gte &&
              m.sentAt <= where.sentAt.lte
          )
      ),
      updateMany: vi.fn(async ({ where, data }: { where: { id: string; externalId: null }; data: { externalId: string } }) => {
        const hit = store.messages.filter((m) => m.id === where.id && m.externalId === null);
        for (const m of hit) m.externalId = data.externalId;
        return { count: hit.length };
      }),
    },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/integrations/openai", () => ({ classifyWithSecondLook: vi.fn() }));
vi.mock("@/lib/senderVerdicts", () => ({
  OWNER_SAID_NOT_CUSTOMER: "You marked this sender as not a customer.",
  ownerSaidNotCustomer: vi.fn(async () => false),
  recentCorrections: vi.fn(async () => []),
}));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn(async () => null) }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/engagement", () => ({ checkRapidEngagement: vi.fn(async () => undefined) }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn(async () => undefined) }));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead: vi.fn(async () => undefined) }));

import { importOutlookConversation } from "@/lib/integrations/outlook";

const JANE_WROTE = new Date("2026-09-30T14:00:00Z");
const ACK_SENT = new Date("2026-09-30T14:01:10Z");

/** What FollowUp recorded when the instant ack went out. */
const ACK_BODY = "Hi Jane,\n\nThanks for getting in touch about the water heater — I'll get back to you shortly with a price & a time.\n\nSam\nSam's Plumbing";

/** The sent copy as Graph returns it: HTML, entities, Outlook's style block, the comment, then the quoted original. */
const SENT_COPY_HTML =
  '<html><head><style type="text/css" style="display:none;"> P {margin-top:0;margin-bottom:0;} </style></head><body>' +
  "<div>Hi Jane,<br><br>Thanks for getting in touch about the water heater — I'll get back to you shortly with a price &amp; a time.<br><br>Sam<br>Sam's Plumbing</div>" +
  '<hr><div id="divRplyFwdMsg"><b>From:</b> Jane Doe &lt;jane@example.com&gt;<br><b>Subject:</b> Water heater</div>' +
  "<div>Hi, could I get a quote for a new water heater?</div></body></html>";

function graph(messages: object[]) {
  vi.spyOn(global, "fetch").mockImplementation(async () => Response.json({ value: messages }));
}

const janeMessage = {
  id: "AAMk-jane-1",
  conversationId: "conv-1",
  subject: "Water heater",
  body: { contentType: "text", content: "Hi, could I get a quote for a new water heater?" },
  from: { emailAddress: { name: "Jane Doe", address: "jane@example.com" } },
  receivedDateTime: JANE_WROTE.toISOString(),
};
const sentCopy = {
  id: "AAMk-sent-ack",
  conversationId: "conv-1",
  subject: "RE: Water heater",
  body: { contentType: "html", content: SENT_COPY_HTML },
  from: { emailAddress: { name: "Sam's Plumbing", address: "info@samsplumbing.ca" } },
  receivedDateTime: new Date(ACK_SENT.getTime() - 3_000).toISOString(),
  sentDateTime: new Date(ACK_SENT.getTime() - 4_000).toISOString(),
};

const lead = {
  id: "lead1",
  businessId: "biz1",
  name: "Jane Doe",
  email: "jane@example.com",
  company: null,
  source: "Outlook",
  dealValue: 0,
  score: 0,
  scoreReason: null,
  lastContacted: JANE_WROTE,
  nextFollowUp: null,
  notes: null,
  automationTier: "ASSISTED",
};

beforeEach(() => {
  vi.clearAllMocks();
  store.messages = [
    { id: "row-jane", conversationId: "c1", direction: "inbound", body: janeMessage.body.content, sentAt: JANE_WROTE, externalId: "AAMk-jane-1", trigger: null, source: null },
    // FollowUp's own record of the ack: no Graph id, because /reply returns none.
    { id: "row-ack", conversationId: "c1", direction: "outbound", body: ACK_BODY, sentAt: ACK_SENT, externalId: null, trigger: "instant_ack", source: null },
  ];
  prismaMock.integration.findFirst.mockResolvedValue({
    id: "int1",
    accessToken: "access",
    refreshToken: "refresh",
    tokenExpiresAt: new Date(Date.now() + 3_600_000),
    accountEmail: "info@samsplumbing.ca",
    user: { email: "sam.smith@gmail.com" },
  });
  prismaMock.business.findUnique.mockResolvedValue({ name: "Sam's Plumbing", industry: "Plumbing", users: [] });
  prismaMock.conversation.findUnique.mockResolvedValue({ id: "c1", leadId: "lead1", lead: { businessId: "biz1" } });
  prismaMock.lead.findUnique.mockResolvedValue({ id: "lead1", lastContacted: JANE_WROTE });
  prismaMock.lead.findUniqueOrThrow.mockResolvedValue(lead);
});

afterEach(() => vi.restoreAllMocks());

const outbound = () => store.messages.filter((m) => m.direction === "outbound");

describe("the Outlook sync reading back FollowUp's own send", () => {
  it("lands on FollowUp's row: no second copy, and the ack still reads as the ack", async () => {
    graph([janeMessage, sentCopy]);
    await importOutlookConversation("biz1", "conv-1");

    expect(outbound()).toHaveLength(1);
    expect(outbound()[0]).toMatchObject({ id: "row-ack", externalId: "AAMk-sent-ack", trigger: "instant_ack" });
    // Nothing now looks like a person answered Jane.
    expect(outbound().filter((m) => m.trigger === null)).toEqual([]);
  });

  it("a second read-back is a no-op", async () => {
    graph([janeMessage, sentCopy]);
    await importOutlookConversation("biz1", "conv-1");
    await importOutlookConversation("biz1", "conv-1");
    expect(outbound()).toHaveLength(1);
  });

  it("the owner's own reply from Outlook, in other words, is still stored as theirs", async () => {
    const ownerReply = {
      ...sentCopy,
      id: "AAMk-owner-reply",
      body: { contentType: "text", content: "Jane, $1,850 installed. I can do Thursday morning." },
      receivedDateTime: new Date(ACK_SENT.getTime() + 60_000).toISOString(),
    };
    graph([janeMessage, sentCopy, ownerReply]);
    await importOutlookConversation("biz1", "conv-1");

    expect(outbound()).toHaveLength(2);
    expect(outbound().find((m) => m.externalId === "AAMk-owner-reply")).toMatchObject({ trigger: null });
    expect(outbound().find((m) => m.id === "row-ack")).toMatchObject({ externalId: "AAMk-sent-ack" });
  });

  it("the same words sent long after FollowUp's message are not claimed by it", async () => {
    graph([janeMessage, { ...sentCopy, receivedDateTime: new Date(ACK_SENT.getTime() + 3 * 3_600_000).toISOString() }]);
    await importOutlookConversation("biz1", "conv-1");

    expect(outbound()).toHaveLength(2);
    expect(outbound().find((m) => m.id === "row-ack")!.externalId).toBeNull();
  });
});
