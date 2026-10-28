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

type Result = { truncated: boolean; skippedForLimit?: number; stoppedAt?: number };

/** Runs a sync to the end, letting its waits pass instantly. */
async function sync(options: { from?: number } = {}) {
  let result: Result | null = null;
  const done = fetchSalesConversations("biz1", { ...options, onResult: (info) => (result = info) });
  await vi.runAllTimersAsync();
  await done;
  return result as unknown as Result;
}

/** The inbox lists `count` threads, t0 newest. */
const listOf = (count: number) =>
  threadsList.mockImplementation(async ({ q }: { q: string }) =>
    q.startsWith("category:updates") ? { data: { threads: [] } } : { data: { threads: Array.from({ length: count }, (_, i) => ({ id: `t${i}` })) } }
  );
/** Google reads threads before t`n`, then refuses every read. */
const limitFrom = (n: number) =>
  threadsGet.mockImplementation(async ({ id }: { id: string }) => {
    if (Number(id.slice(1)) >= n) throw perMinute();
    return thread(id);
  });
const readIds = () => [...new Set((threadsGet.mock.calls as unknown as [{ id: string }][]).map(([a]) => a.id))];

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

/**
 * Where the limit stopped a full pass (2026-10-27). From Oct 21 one busy inbox's pass was stopped at the same point
 * on every tick and started over from the newest thread, so it never finished. The pass now says where it stopped,
 * and the next one can start there (gmailSync.ts keeps the place on the inbox).
 */
describe("a full pass the limit stops part-way", () => {
  it("says where it stopped: the first thread it couldn't read", async () => {
    listOf(8);
    limitFrom(3);

    const result = await sync();

    expect(result.skippedForLimit).toBe(5);
    expect(result.stoppedAt).toBe(3);
    expect(prismaMock.message.upsert).toHaveBeenCalledTimes(3);
  });

  it("can start where the last one stopped, without reading the threads before it", async () => {
    listOf(8);

    const result = await sync({ from: 5 });

    expect(readIds()).toEqual(["t5", "t6", "t7"]);
    expect(result).toEqual({ truncated: false, skippedForLimit: 0 });
  });

  it("says where it stopped as a place in the whole list, not in the part it read", async () => {
    listOf(8);
    limitFrom(6);

    const result = await sync({ from: 4 });

    expect(result.stoppedAt).toBe(6);
  });

  it("a pass that finishes says nothing about stopping", async () => {
    listOf(4);

    const result = await sync();

    expect(result.stoppedAt).toBeUndefined();
  });
});
