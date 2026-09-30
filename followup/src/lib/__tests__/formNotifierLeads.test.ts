/**
 * Every submission from one website form merged into one customer (b011).
 *
 * Leads are matched by email. A form notifier ("website@", "wordpress@",
 * "form-submission@squarespace.info") sends every visitor's enquiry from
 * the same address, so the Gmail and Outlook syncs made the first visitor
 * a lead under that address and filed every later visitor's thread on it.
 * Now the notifier's Reply-To person is the customer; with no such person,
 * each thread gets a lead of its own. A normal sender is unchanged.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { threadsGet, threadsList, prismaMock, classifyWithSecondLook } = vi.hoisted(() => ({
  threadsGet: vi.fn(),
  threadsList: vi.fn(),
  classifyWithSecondLook: vi.fn(),
  prismaMock: {
    integration: { findFirst: vi.fn(), updateMany: vi.fn() },
    business: { findUnique: vi.fn() },
    filteredEmail: { deleteMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
    lead: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    conversation: { findUnique: vi.fn(), create: vi.fn() },
    message: { upsert: vi.fn() },
  },
}));

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: class {
        setCredentials() {}
      },
    },
    gmail: () => ({ users: { threads: { get: threadsGet, list: threadsList } } }),
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/integrations/openai", () => ({ classifyAsProspect: vi.fn(), classifyWithSecondLook }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn(async () => null) }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/engagement", () => ({ checkRapidEngagement: vi.fn(async () => undefined) }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn(async () => undefined) }));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead: vi.fn(async () => undefined) }));

import { fetchSalesConversations } from "@/lib/integrations/gmail";
import { conversationMessagesPath, fetchOutlookConversations } from "@/lib/integrations/outlook";
import { threadCustomer } from "@/lib/sharedSenders";

const NOTIFIER = "website@samsplumbing.ca";

/** The lead the notifier's first-ever enquiry made under its own address, before this fix. */
const notifierLead = leadRow("lead-notifier", "Website", NOTIFIER);

function leadRow(id: string, name: string, email: string | null) {
  return {
    id,
    businessId: "biz1",
    name,
    email,
    company: null,
    source: "Gmail",
    dealValue: 0,
    score: 0,
    scoreReason: null,
    lastContacted: new Date(Date.now() - 86_400_000),
    nextFollowUp: null,
    notes: null,
    automationTier: "HOLD",
  };
}

function gmailThread(id: string, from: string, body: string, replyTo?: string) {
  return {
    data: {
      id,
      messages: [
        {
          id: `${id}-m1`,
          internalDate: String(Date.now()),
          payload: {
            mimeType: "text/plain",
            headers: [
              { name: "From", value: from },
              ...(replyTo ? [{ name: "Reply-To", value: replyTo }] : []),
              { name: "Subject", value: "New form submission" },
              { name: "Message-ID", value: `<${id}@mail.example>` },
            ],
            body: { data: Buffer.from(body).toString("base64") },
          },
        },
      ],
    },
  };
}

let created = 0;

beforeEach(() => {
  vi.clearAllMocks();
  created = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("GOOGLE_CLIENT_ID", "client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
  vi.stubEnv("GOOGLE_REDIRECT_URI", "https://followupbase.io/api/integrations/gmail/callback");
  vi.stubEnv("OPENAI_API_KEY", "sk-test");

  classifyWithSecondLook.mockResolvedValue({ isProspect: true, reason: "an enquiry" });
  prismaMock.integration.findFirst.mockResolvedValue({
    id: "int1",
    refreshToken: "refresh",
    accessToken: "access",
    tokenExpiresAt: new Date(Date.now() + 3_600_000),
    deltaLink: null,
    accountEmail: "info@samsplumbing.ca",
    watchExpiration: null,
    user: { email: "sam@samsplumbing.ca" },
  });
  prismaMock.integration.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.business.findUnique.mockResolvedValue({ name: "Sam's Plumbing", industry: "Plumbing", users: [] });
  prismaMock.filteredEmail.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.filteredEmail.findUnique.mockResolvedValue(null);
  prismaMock.conversation.findUnique.mockResolvedValue(null); // every thread is new
  prismaMock.conversation.create.mockImplementation(async ({ data }) => ({ id: `conv-${data.externalId}`, leadId: data.leadId }));
  prismaMock.message.upsert.mockResolvedValue({});
  prismaMock.lead.updateMany.mockResolvedValue({ count: 1 });
  // Before the fix, the notifier's address matched this lead on every sync.
  prismaMock.lead.findUnique.mockImplementation(async ({ where }) =>
    where.businessId_email?.email === NOTIFIER || where.id === notifierLead.id ? notifierLead : null
  );
  prismaMock.lead.findUniqueOrThrow.mockResolvedValue(notifierLead);
  prismaMock.lead.create.mockImplementation(async ({ data }) => leadRow(`lead-new-${++created}`, data.name, data.email));
});

afterEach(() => vi.restoreAllMocks());

const emailLookups = () =>
  prismaMock.lead.findUnique.mock.calls.map((c) => c[0].where.businessId_email?.email).filter(Boolean);

describe("threadCustomer", () => {
  const ours = (email: string) => email === "info@samsplumbing.ca";

  it("leaves a normal sender exactly as it was, Reply-To or not", () => {
    const from = { name: "Jane Doe", email: "jane@example.com" };
    expect(threadCustomer([{ from, replyTo: { name: "x", email: "other@example.com" } }], ours)).toEqual({ ...from, shared: false });
  });

  it("takes a form notifier's Reply-To person as the customer", () => {
    const replyTo = { name: "Priya", email: "priya@example.com" };
    expect(threadCustomer([{ from: { name: "WordPress", email: "wordpress@site.com" }, replyTo }], ours)).toEqual({
      ...replyTo,
      shared: false,
    });
  });

  it("marks a notifier with no person to reply to as shared", () => {
    const from = { name: "Squarespace", email: "form-submission@squarespace.info" };
    expect(threadCustomer([{ from }], ours)).toEqual({ ...from, shared: true });
    // A Reply-To that is the business itself, or another notifier, is no person.
    expect(threadCustomer([{ from, replyTo: { name: "Sam", email: "info@samsplumbing.ca" } }], ours)?.shared).toBe(true);
    expect(threadCustomer([{ from, replyTo: { name: "Site", email: "wordpress@site.com" } }], ours)?.shared).toBe(true);
  });
});

describe("Gmail: one website form, several people", () => {
  it("two different people through the same notifier become two leads", async () => {
    threadsList.mockResolvedValue({ data: { threads: [{ id: "t1" }, { id: "t2" }] } });
    threadsGet.mockImplementation(async ({ id }) =>
      id === "t1"
        ? gmailThread("t1", `Website <${NOTIFIER}>`, "Name: Ana\nMessage: Leaking water heater")
        : gmailThread("t2", `Website <${NOTIFIER}>`, "Name: Bob\nMessage: Quote for a new toilet")
    );

    const leads = await fetchSalesConversations("biz1");

    expect(prismaMock.lead.create).toHaveBeenCalledTimes(2);
    expect(new Set(leads.map((l) => l.id))).toEqual(new Set(["lead-new-1", "lead-new-2"]));
    expect(leads.map((l) => l.id)).not.toContain(notifierLead.id);
    // Never matched, or treated as a known customer, by the notifier's address.
    expect(emailLookups()).not.toContain(NOTIFIER);
    expect(classifyWithSecondLook).toHaveBeenCalledTimes(2);
    for (const [{ data }] of prismaMock.lead.create.mock.calls) {
      // No email: a reply to the notifier reaches the form, not the person.
      expect(data.email).toBeNull();
      // The thread is created with its lead, the only thing tying them.
      expect(data.conversations.create).toMatchObject({ channel: "email", emailProvider: "gmail" });
    }
    expect(prismaMock.lead.create.mock.calls.map(([{ data }]) => data.conversations.create.externalId).sort()).toEqual(["t1", "t2"]);
  });

  it("a resync of a notifier's thread stays on that thread's own lead", async () => {
    threadsList.mockResolvedValue({ data: { threads: [{ id: "t1" }] } });
    threadsGet.mockResolvedValue(gmailThread("t1", `Website <${NOTIFIER}>`, "Name: Ana"));
    const ana = leadRow("lead-ana", "Website", null);
    prismaMock.conversation.findUnique.mockResolvedValue({ id: "conv-t1", leadId: "lead-ana", lead: { businessId: "biz1" } });
    prismaMock.lead.findUnique.mockImplementation(async ({ where }) => (where.id === "lead-ana" ? ana : null));
    prismaMock.lead.findUniqueOrThrow.mockResolvedValue(ana);

    const leads = await fetchSalesConversations("biz1");

    expect(prismaMock.lead.create).not.toHaveBeenCalled();
    expect(leads.map((l) => l.id)).toEqual(["lead-ana"]);
    expect(prismaMock.lead.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "lead-ana" } }));
  });

  it("uses the notifier's Reply-To person", async () => {
    threadsList.mockResolvedValue({ data: { threads: [{ id: "t1" }] } });
    threadsGet.mockResolvedValue(
      gmailThread("t1", "WordPress <wordpress@samsplumbing.ca>", "Message: Leaking water heater", "Priya Shah <Priya@Example.com>")
    );

    await fetchSalesConversations("biz1");

    expect(emailLookups()).toContain("priya@example.com");
    expect(prismaMock.lead.create).toHaveBeenCalledTimes(1);
    const { data } = prismaMock.lead.create.mock.calls[0][0];
    expect(data).toMatchObject({ name: "Priya Shah", email: "priya@example.com" });
    expect(data.conversations).toBeUndefined();
  });

  it("leaves a normal sender unchanged, Reply-To and all", async () => {
    threadsList.mockResolvedValue({ data: { threads: [{ id: "t1" }] } });
    threadsGet.mockResolvedValue(gmailThread("t1", "Jane Doe <jane@example.com>", "Hi, can you quote?", "assistant@example.com"));

    await fetchSalesConversations("biz1");

    expect(emailLookups()).toEqual(["jane@example.com", "jane@example.com"]);
    const { data } = prismaMock.lead.create.mock.calls[0][0];
    expect(data).toMatchObject({ name: "Jane Doe", email: "jane@example.com" });
    expect(data.conversations).toBeUndefined();
    expect(prismaMock.conversation.create).toHaveBeenCalledWith({
      data: { leadId: "lead-new-1", channel: "email", externalId: "t1", emailProvider: "gmail" },
    });
  });
});

describe("Outlook: one website form, several people", () => {
  type Msg = { from: string; name: string; replyTo?: { name: string; address: string }[]; body: string };
  function graph(conversations: Record<string, Msg>) {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = decodeURIComponent(String(input));
      if (url.includes("/delta")) {
        return new Response(
          JSON.stringify({
            value: Object.keys(conversations).map((id) => ({ id: `${id}-m1`, conversationId: id })),
            "@odata.deltaLink": "https://graph.microsoft.com/v1.0/delta-next",
          }),
          { status: 200 }
        );
      }
      const id = Object.keys(conversations).find((c) => url.includes(`'${c}'`))!;
      const m = conversations[id];
      return new Response(
        JSON.stringify({
          value: [
            {
              id: `${id}-m1`,
              conversationId: id,
              subject: "New form submission",
              body: { contentType: "text", content: m.body },
              from: { emailAddress: { name: m.name, address: m.from } },
              ...(m.replyTo ? { replyTo: m.replyTo.map((r) => ({ emailAddress: r })) } : {}),
              receivedDateTime: new Date().toISOString(),
            },
          ],
        }),
        { status: 200 }
      );
    });
  }

  it("asks Graph for each message's Reply-To", () => {
    expect(new URLSearchParams(conversationMessagesPath("c1").split("?")[1]).get("$select")?.split(",")).toContain("replyTo");
  });

  it("two different people through the same notifier become two leads", async () => {
    graph({
      c1: { from: NOTIFIER, name: "Website", body: "Name: Ana" },
      c2: { from: NOTIFIER, name: "Website", body: "Name: Bob" },
    });

    const leads = await fetchOutlookConversations("biz1");

    expect(prismaMock.lead.create).toHaveBeenCalledTimes(2);
    expect(new Set(leads.map((l) => l.id))).toEqual(new Set(["lead-new-1", "lead-new-2"]));
    expect(emailLookups()).not.toContain(NOTIFIER);
    for (const [{ data }] of prismaMock.lead.create.mock.calls) {
      expect(data.email).toBeNull();
      expect(data.conversations.create).toMatchObject({ channel: "email", emailProvider: "outlook" });
    }
  });

  it("uses the notifier's Reply-To person", async () => {
    graph({
      c1: {
        from: "form-submission@squarespace.info",
        name: "Squarespace",
        replyTo: [{ name: "Priya Shah", address: "Priya@Example.com" }],
        body: "Message: Leaking water heater",
      },
    });

    await fetchOutlookConversations("biz1");

    const { data } = prismaMock.lead.create.mock.calls[0][0];
    expect(data).toMatchObject({ name: "Priya Shah", email: "priya@example.com" });
    expect(data.conversations).toBeUndefined();
  });

  it("leaves a normal sender unchanged", async () => {
    graph({ c1: { from: "Mark@Example.com", name: "Mark Chen", body: "Hi, can you quote?" } });

    await fetchOutlookConversations("biz1");

    expect(emailLookups()).toEqual(["mark@example.com", "mark@example.com"]);
    const { data } = prismaMock.lead.create.mock.calls[0][0];
    expect(data).toMatchObject({ name: "Mark Chen", email: "mark@example.com" });
    expect(data.conversations).toBeUndefined();
  });
});
