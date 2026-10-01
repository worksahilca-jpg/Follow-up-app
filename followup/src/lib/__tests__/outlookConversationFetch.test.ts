/**
 * An Outlook conversation's messages are fetched with a query Graph accepts.
 *
 * The fetch combined `$filter=conversationId eq …` with
 * `$orderby=receivedDateTime asc`. Graph refuses that pairing on messages
 * (InefficientFilter: an ordered property must also lead the filter), and
 * the refusal was read as "no messages", so every Outlook conversation was
 * dropped before any lead was written. The fake Graph below refuses the
 * same way, returns the messages out of order, and uses an id with the
 * characters a raw query string mangles.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { prismaMock, acknowledgeNewLead } = vi.hoisted(() => ({
  acknowledgeNewLead: vi.fn(async () => undefined),
  prismaMock: {
    integration: { findFirst: vi.fn() },
    business: { findUnique: vi.fn() },
    filteredEmail: { deleteMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
    lead: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    conversation: { findUnique: vi.fn(), create: vi.fn() },
    // No FollowUp-sent row to claim: the owner's reply below is their own.
    message: {
      upsert: vi.fn(),
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async (_args: { where: { conversationId?: string } }): Promise<{ direction: string; sentAt: Date; body: string; externalId: string | null }[]> => []),
    },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/integrations/openai", () => ({ classifyWithSecondLook: vi.fn() }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn(async () => null) }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/engagement", () => ({ checkRapidEngagement: vi.fn(async () => undefined) }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn(async () => undefined) }));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead }));

import { conversationMessagesPath, importOutlookConversation, sameMessageStored } from "@/lib/integrations/outlook";

const CONVERSATION_ID = "AAQkAGI2+abc/de==";
const opener = new Date("2026-09-27T09:00:00Z");
const reply = new Date("2026-09-27T09:30:00Z");
const followUp = new Date("2026-09-27T10:15:00Z");

function graphMessage(id: string, from: string, at: Date, text: string) {
  return {
    id,
    conversationId: CONVERSATION_ID,
    subject: "Kitchen quote",
    body: { contentType: "text", content: text },
    from: { emailAddress: { name: from === "info@samsplumbing.ca" ? "Sam" : "Jane Doe", address: from } },
    receivedDateTime: at.toISOString(),
  };
}

let requested: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  requested = [];
  prismaMock.integration.findFirst.mockResolvedValue({
    id: "int1",
    accessToken: "access",
    refreshToken: "refresh",
    tokenExpiresAt: new Date(Date.now() + 3_600_000),
    accountEmail: "info@samsplumbing.ca",
    user: { email: "sam.smith@gmail.com" },
  });
  prismaMock.business.findUnique.mockResolvedValue({ name: "Sam's Plumbing", industry: "Plumbing" });
  prismaMock.filteredEmail.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.conversation.findUnique.mockResolvedValue(null);
  prismaMock.conversation.create.mockResolvedValue({ id: "conv1", leadId: "lead1" });
  prismaMock.lead.findUnique.mockResolvedValue(null);
  prismaMock.lead.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "lead1",
    company: null,
    dealValue: 0,
    score: 0,
    scoreReason: null,
    nextFollowUp: null,
    notes: null,
    automationTier: "ASSISTED",
    ...data,
  }));
  prismaMock.message.upsert.mockResolvedValue({});

  vi.spyOn(global, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    requested.push(url);
    const query = decodeURIComponent(url.split("?")[1] ?? "");
    if (query.includes("$orderby")) {
      return new Response(
        JSON.stringify({ error: { code: "InefficientFilter", message: "The restriction or sort order is too complex for this operation." } }),
        { status: 400 }
      );
    }
    // Newest first, as Graph lists messages by default.
    return new Response(
      JSON.stringify({
        value: [
          graphMessage("m3", "jane@example.com", followUp, "Any update on the quote?"),
          graphMessage("m2", "info@samsplumbing.ca", reply, "Thanks Jane, I'll send it today."),
          graphMessage("m1", "jane@example.com", opener, "Could you quote a kitchen reno?"),
        ],
      }),
      { status: 200 }
    );
  });
});

afterEach(() => vi.restoreAllMocks());

describe("fetching one Outlook conversation", () => {
  it("never asks Graph to sort a conversationId filter, and encodes the id", () => {
    const path = conversationMessagesPath(CONVERSATION_ID);
    expect(path).not.toContain("$orderby");
    const filter = new URLSearchParams(path.split("?")[1]).get("$filter");
    expect(filter).toBe(`conversationId eq '${CONVERSATION_ID}'`);
  });

  it("doubles a quote inside the id, as OData requires", () => {
    const filter = new URLSearchParams(conversationMessagesPath("a'b").split("?")[1]).get("$filter");
    expect(filter).toBe("conversationId eq 'a''b'");
  });

  it("turns the conversation into a lead, reading the messages oldest first", async () => {
    const lead = await importOutlookConversation("biz1", CONVERSATION_ID);
    expect(requested).toHaveLength(1);
    expect(lead?.id).toBe("lead1");
    expect(prismaMock.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: "jane@example.com", lastContacted: followUp }) })
    );
    const stored = prismaMock.message.upsert.mock.calls.map((c) => c[0].create);
    expect(stored.map((m: { externalId: string }) => m.externalId)).toEqual(["m1", "m2", "m3"]);
    expect(stored.map((m: { direction: string }) => m.direction)).toEqual(["inbound", "outbound", "inbound"]);
  });
});

describe("the Outlook sync and the business's own people", () => {
  it("the owner writing from his sign-in address is not a new customer", async () => {
    prismaMock.business.findUnique.mockResolvedValue({ name: "Sam's Plumbing", industry: "Plumbing", users: [{ email: "sam.smith@gmail.com" }] });
    vi.mocked(global.fetch).mockImplementation(
      async () =>
        new Response(JSON.stringify({ value: [graphMessage("m1", "sam.smith@gmail.com", opener, "Fwd: can you quote a kitchen reno?")] }), {
          status: 200,
        })
    );
    const lead = await importOutlookConversation("biz1", CONVERSATION_ID);
    expect(lead).toBeNull();
    expect(prismaMock.lead.create).not.toHaveBeenCalled();
    expect(acknowledgeNewLead).not.toHaveBeenCalled();
  });
});

/**
 * A reply the owner started in Outlook and never sent is not a message.
 *
 * The conversation fetch reads every folder, Drafts included. An unsent
 * draft came back as a message: with the owner as sender it was stored as
 * the business answering, so the customer read as answered and FollowUp
 * stopped nudging, on exactly the lead the owner meant to get back to; with
 * no sender yet it was stored as the CUSTOMER writing the owner's
 * half-finished words.
 */
describe("an unsent Outlook draft in the conversation", () => {
  const draftAt = new Date("2026-09-27T11:00:00Z");

  it.each([
    ["with the owner as sender", { from: { emailAddress: { name: "Sam", address: "info@samsplumbing.ca" } } }],
    ["with no sender yet", { from: undefined }],
  ])("is not stored, %s", async (_label, sender) => {
    vi.mocked(global.fetch).mockImplementation(async () =>
      Response.json({
        value: [
          graphMessage("m1", "jane@example.com", opener, "Could you quote a kitchen reno?"),
          { ...graphMessage("draft-1", "info@samsplumbing.ca", draftAt, "Hi Jane, the quote is $"), ...sender, isDraft: true },
        ],
      })
    );
    const lead = await importOutlookConversation("biz1", CONVERSATION_ID);

    expect(lead?.id).toBe("lead1");
    const stored = prismaMock.message.upsert.mock.calls.map((c) => c[0].create);
    expect(stored.map((m: { externalId: string }) => m.externalId)).toEqual(["m1"]);
    // Nor does the draft move the customer's last contact.
    expect(prismaMock.lead.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ lastContacted: opener }) }));
  });

  it("is asked for, so it can be told apart", () => {
    expect(new URLSearchParams(conversationMessagesPath("c1").split("?")[1]).get("$select")?.split(",")).toContain("isDraft");
  });
});

describe("the same email under two Graph ids (b029)", () => {
  it("asks Graph for immutable ids on every call", async () => {
    await importOutlookConversation("biz1", CONVERSATION_ID);
    const init = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Prefer).toBe('IdType="ImmutableId"');
  });

  it("is not stored twice when a message already sits in the conversation under its old id", async () => {
    // Graph moved m1 to another folder and now calls it m1-moved; the row
    // written before the immutable-id header still says m1. The sync reads
    // the conversation's rows once (b037); claimOwnSend's own findMany
    // (no conversationId in its where) still finds nothing to claim.
    prismaMock.message.findMany.mockImplementation(async ({ where }) =>
      where.conversationId === "conv1" ? [{ direction: "inbound", sentAt: opener, body: "Could you quote a kitchen reno?", externalId: "m1" }] : []
    );
    vi.spyOn(global, "fetch").mockImplementation(async () =>
      Response.json({
        value: [
          graphMessage("m3", "jane@example.com", followUp, "Any update on the quote?"),
          graphMessage("m2", "info@samsplumbing.ca", reply, "Thanks Jane, I'll send it today."),
          graphMessage("m1-moved", "jane@example.com", opener, "Could you quote a kitchen reno?"),
        ],
      })
    );

    await importOutlookConversation("biz1", CONVERSATION_ID);

    const stored = prismaMock.message.upsert.mock.calls.map((c) => c[0].create.externalId);
    expect(stored).toEqual(["m2", "m3"]);
    // One read of the conversation for the whole pass, not one per message (b037).
    const twinReads = prismaMock.message.findMany.mock.calls.filter(([args]) => args.where.conversationId === "conv1");
    expect(twinReads).toHaveLength(1);
  });

  it("matches on the conversation, direction, moment and words, never on the id alone", () => {
    const row = { direction: "inbound", sentAt: opener, body: "Could you quote a kitchen reno?", externalId: "m1" };
    const moved = { id: "m1-moved", direction: "inbound", body: row.body, sentAt: new Date(opener) };
    expect(sameMessageStored([row], moved)).toBe(true);
    // The same row under its own id is the upsert's job, not a twin.
    expect(sameMessageStored([row], { ...moved, id: "m1" })).toBe(false);
    expect(sameMessageStored([row], { ...moved, direction: "outbound" })).toBe(false);
    expect(sameMessageStored([row], { ...moved, sentAt: reply })).toBe(false);
    expect(sameMessageStored([row], { ...moved, body: "Could you quote a bathroom reno?" })).toBe(false);
    expect(sameMessageStored([], moved)).toBe(false);
  });
});
