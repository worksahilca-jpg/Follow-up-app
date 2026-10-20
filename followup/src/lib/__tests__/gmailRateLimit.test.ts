/**
 * Gmail's per-minute limit (2026-10-18): one sync logged 28 threads as failed, every one "Quota exceeded for quota
 * metric 'Total Query Cost' and limit 'Units per minute per user'". Each was skipped, the pass was stamped done, and
 * those emails waited a day for the next full pass. Now each read waits the limit out a little, and once it still
 * can't, the rest of the run is left unread on purpose and reported (gmailSync.ts then keeps its clock where it was).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { threadsGet, threadsList, prismaMock } = vi.hoisted(() => ({
  threadsGet: vi.fn(),
  threadsList: vi.fn(),
  prismaMock: {
    integration: { findFirst: vi.fn() },
    business: { findUnique: vi.fn() },
    filteredEmail: { deleteMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
    lead: { findUnique: vi.fn(), findFirst: vi.fn(async () => null), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    conversation: { findUnique: vi.fn(), create: vi.fn() },
    message: { upsert: vi.fn(), findFirst: vi.fn(async () => null) },
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
vi.mock("@/lib/integrations/openai", () => ({ classifyAsProspect: vi.fn(), classifyWithSecondLook: vi.fn() }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn(async () => null) }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/engagement", () => ({ checkRapidEngagement: vi.fn(async () => undefined) }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn(async () => undefined) }));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead: vi.fn(async () => undefined) }));

import { fetchSalesConversations } from "@/lib/integrations/gmail";

/** What Gmail answered on 2026-10-18. */
const perMinute = () =>
  Object.assign(new Error("Quota exceeded for quota metric 'Total Query Cost' and limit 'Units per minute per user' of service 'gmail.googleapis.com'"), {
    code: 403,
    status: 403,
  });
const perDay = () => Object.assign(new Error("Daily Limit Exceeded"), { code: 403, errors: [{ reason: "dailyLimitExceeded" }] });

const janeWrote = new Date(Date.now() - 60 * 60_000);
const thread = (id: string) => ({
  data: {
    id,
    messages: [
      {
        id: `${id}-m1`,
        labelIds: ["INBOX"],
        internalDate: String(janeWrote.getTime()),
        payload: {
          mimeType: "text/plain",
          headers: [
            { name: "From", value: "Jane Doe <jane@example.com>" },
            { name: "Subject", value: "Kitchen quote" },
            { name: "Message-ID", value: `<${id}@mail>` },
          ],
          body: { data: Buffer.from("Could you quote a kitchen reno?").toString("base64") },
        },
      },
    ],
  },
});

/** Runs a sync to the end, letting its waits pass instantly. */
async function sync() {
  let result: { truncated: boolean; skippedForLimit?: number } | null = null;
  const done = fetchSalesConversations("biz1", { onResult: (info) => (result = info) });
  await vi.runAllTimersAsync();
  await done;
  return result as unknown as { truncated: boolean; skippedForLimit?: number };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["setTimeout"] });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("GOOGLE_CLIENT_ID", "client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
  vi.stubEnv("GOOGLE_REDIRECT_URI", "https://followupbase.io/api/integrations/gmail/callback");
  vi.stubEnv("OPENAI_API_KEY", "");

  threadsList.mockImplementation(async ({ q }: { q: string }) =>
    q.startsWith("category:updates") ? { data: { threads: [] } } : { data: { threads: [{ id: "t1" }] } }
  );
  threadsGet.mockImplementation(async ({ id }: { id: string }) => thread(id));
  prismaMock.integration.findFirst.mockResolvedValue({
    id: "int1",
    refreshToken: "refresh",
    accountEmail: "info@samsplumbing.ca",
    watchExpiration: null,
    user: { email: "sam.smith@gmail.com" },
  });
  prismaMock.business.findUnique.mockResolvedValue({ name: "Sam's Plumbing", industry: "Plumbing", users: [] });
  prismaMock.filteredEmail.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.conversation.findUnique.mockResolvedValue(null);
  prismaMock.conversation.create.mockResolvedValue({ id: "conv1", leadId: "lead1" });
  prismaMock.message.upsert.mockResolvedValue({});
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
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Gmail's per-minute limit during a sync", () => {
  it("waits it out and reads the thread", async () => {
    threadsGet.mockRejectedValueOnce(perMinute());

    const result = await sync();

    expect(threadsGet).toHaveBeenCalledTimes(2);
    expect(prismaMock.message.upsert).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ truncated: false, skippedForLimit: 0 });
  });

  it("when it outlasts the waits, leaves the rest unread and says how many, instead of skipping them silently", async () => {
    threadsList.mockImplementation(async ({ q }: { q: string }) =>
      q.startsWith("category:updates") ? { data: { threads: [] } } : { data: { threads: Array.from({ length: 8 }, (_, i) => ({ id: `t${i}` })) } }
    );
    threadsGet.mockRejectedValue(perMinute());

    const result = await sync();

    // Five read at once, each tried three times; the other three never asked for.
    expect(threadsGet).toHaveBeenCalledTimes(15);
    expect(result.skippedForLimit).toBe(8);
    expect(prismaMock.message.upsert).not.toHaveBeenCalled();
  });

  it("a daily limit is not waited on, and counts as an ordinary failed thread", async () => {
    threadsGet.mockRejectedValue(perDay());

    const result = await sync();

    expect(threadsGet).toHaveBeenCalledTimes(1);
    expect(result.skippedForLimit).toBe(0);
  });

  it("the thread list waits the limit out too", async () => {
    threadsList.mockRejectedValueOnce(perMinute());

    await sync();

    expect(threadsList).toHaveBeenCalledTimes(3);
    expect(prismaMock.message.upsert).toHaveBeenCalledTimes(1);
  });
});
