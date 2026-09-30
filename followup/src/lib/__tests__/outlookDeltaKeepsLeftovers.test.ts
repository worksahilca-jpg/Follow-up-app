/**
 * An Outlook conversation left over by one sync is read by the next.
 *
 * The sync saved Graph's delta cursor (Integration.deltaLink) BEFORE it
 * processed the conversations that cursor had just listed. Anything the run
 * then left for later was never listed again: the next tick asked Graph
 * only for what changed after the saved cursor, and a customer who had
 * written once, and was waiting for an answer, changes nothing.
 *
 * Two ways a run leaves work for later, both ordinary:
 *  - the per-run classification budget (25): connecting an inbox with more
 *    than 25 unknown conversations in the last 90 days, which is most real
 *    inboxes, kept the first 25 and dropped the rest for good;
 *  - Graph throttling (429) or a 5xx on one conversation's fetch.
 * Gmail never had this: it re-lists by time window, and a known thread
 * skips the classifier (gmailSync.ts, "whatever's left over is picked up
 * next tick"). Outlook now holds its cursor until a run finishes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type LeadRow = { id: string; businessId: string; email: string | null; name: string; lastContacted: Date | null };

const store = vi.hoisted(() => ({
  deltaLink: null as string | null,
  conversations: new Map<string, { id: string; leadId: string }>(),
  leads: [] as LeadRow[],
  throttled: new Set<string>(),
}));

const { prismaMock, classifyWithSecondLook } = vi.hoisted(() => ({
  classifyWithSecondLook: vi.fn(async () => ({ isProspect: true, reason: "asks for a quote" })),
  prismaMock: {
    integration: {
      findFirst: vi.fn(async () => ({
        id: "int1",
        accessToken: "access",
        refreshToken: "refresh",
        tokenExpiresAt: new Date(Date.now() + 3_600_000),
        accountEmail: "info@samsplumbing.ca",
        deltaLink: store.deltaLink,
        user: { email: "sam.smith@gmail.com" },
      })),
      updateMany: vi.fn(async ({ data }: { data: { deltaLink?: string | null } }) => {
        if ("deltaLink" in data) store.deltaLink = data.deltaLink ?? null;
        return { count: 1 };
      }),
    },
    business: { findUnique: vi.fn(async () => ({ name: "Sam's Plumbing", industry: "Plumbing", users: [] })) },
    filteredEmail: { deleteMany: vi.fn(async () => ({ count: 0 })), findUnique: vi.fn(async () => null), upsert: vi.fn() },
    lead: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; businessId_email?: { email: string } } }) => {
        if (where.id) return store.leads.find((l) => l.id === where.id) ?? null;
        return store.leads.find((l) => l.email === where.businessId_email?.email) ?? null;
      }),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => store.leads.find((l) => l.id === where.id)!),
      create: vi.fn(async ({ data }: { data: Omit<LeadRow, "id"> }) => {
        const lead = {
          ...data,
          id: `lead-${store.leads.length + 1}`,
          company: null,
          dealValue: 0,
          score: 0,
          scoreReason: null,
          nextFollowUp: null,
          notes: null,
          automationTier: "ASSISTED",
          source: "Outlook",
        };
        store.leads.push(lead);
        return lead;
      }),
      update: vi.fn(),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    conversation: {
      findUnique: vi.fn(async ({ where }: { where: { externalId: string } }) => {
        const c = store.conversations.get(where.externalId);
        if (!c) return null;
        const lead = store.leads.find((l) => l.id === c.leadId)!;
        return { ...c, lead: { businessId: lead.businessId } };
      }),
      create: vi.fn(async ({ data }: { data: { leadId: string; externalId: string } }) => {
        const c = { id: `conv-${data.externalId}`, leadId: data.leadId };
        store.conversations.set(data.externalId, c);
        return c;
      }),
    },
    message: { upsert: vi.fn(async () => ({})) },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/integrations/openai", () => ({ classifyWithSecondLook }));
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

import { fetchOutlookConversations } from "@/lib/integrations/outlook";

const CURSOR_AFTER_FIRST_PASS = "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=after-first";
const CURSOR_LATER = "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=later";

/** Thirty customers, one conversation each, all in the inbox's last 90 days. */
const CUSTOMERS = Array.from({ length: 30 }, (_, i) => ({ conversationId: `conv-${i + 1}`, email: `customer${i + 1}@example.com` }));

function fakeGraph() {
  vi.spyOn(global, "fetch").mockImplementation(async (input) => {
    const url = decodeURIComponent(String(input));
    if (url.includes("/delta")) {
      // A saved cursor only returns what changed since it: nothing did.
      if (url.includes("$deltatoken=")) return Response.json({ value: [], "@odata.deltaLink": CURSOR_LATER });
      return Response.json({
        value: CUSTOMERS.map((c, i) => ({ id: `m${i + 1}`, conversationId: c.conversationId })),
        "@odata.deltaLink": CURSOR_AFTER_FIRST_PASS,
      });
    }
    const conversationId = url.match(/conversationId eq '([^']+)'/)?.[1] ?? "";
    if (store.throttled.has(conversationId)) return new Response("Too many requests", { status: 429 });
    const customer = CUSTOMERS.find((c) => c.conversationId === conversationId)!;
    return Response.json({
      value: [
        {
          id: `msg-${conversationId}`,
          conversationId,
          subject: "Quote for a new water heater",
          body: { contentType: "text", content: "Hi, could you quote a new water heater? We're in Leaside." },
          from: { emailAddress: { name: "A Customer", address: customer.email } },
          receivedDateTime: new Date(Date.now() - 3_600_000).toISOString(),
        },
      ],
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("OPENAI_API_KEY", "sk-test");
  store.deltaLink = null;
  store.conversations = new Map();
  store.leads = [];
  store.throttled = new Set();
  fakeGraph();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const capturedEmails = () => store.leads.map((l) => l.email).sort();

describe("connecting an Outlook inbox with more customers than one run can judge", () => {
  it("catches every customer over the next ticks, not only the first run's 25", async () => {
    const first = await fetchOutlookConversations("biz1", { maxClassifications: 25 });
    expect(first).toHaveLength(25);

    await fetchOutlookConversations("biz1", { maxClassifications: 25 });

    expect(capturedEmails()).toEqual(CUSTOMERS.map((c) => c.email).sort());
    // The 25 already judged were not put to the model a second time.
    expect(classifyWithSecondLook).toHaveBeenCalledTimes(30);
    // And once a run finishes, the cursor moves on as before.
    expect(store.deltaLink).toBe(CURSOR_AFTER_FIRST_PASS);
  });

  it("a run that finishes everything saves the cursor straight away", async () => {
    await fetchOutlookConversations("biz1", { maxClassifications: 50 });
    expect(store.leads).toHaveLength(30);
    expect(store.deltaLink).toBe(CURSOR_AFTER_FIRST_PASS);
  });
});

describe("Graph throttles one conversation's fetch", () => {
  it("that customer is caught on the next tick", async () => {
    store.throttled.add("conv-7");
    await fetchOutlookConversations("biz1", { maxClassifications: 50 });
    expect(capturedEmails()).not.toContain("customer7@example.com");

    store.throttled.clear();
    await fetchOutlookConversations("biz1", { maxClassifications: 50 });
    expect(capturedEmails()).toContain("customer7@example.com");
    expect(store.leads).toHaveLength(30);
  });
});
