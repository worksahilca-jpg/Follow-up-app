/**
 * The automatic pass over every business's back catalogue.
 *
 * Two things here are load-bearing and neither is obvious from reading the
 * route: that one tenant with a five-year inbox cannot eat the whole
 * tick's OpenAI budget (which would starve every other tenant on every
 * tick, forever), and that the tick is genuinely secret-protected — this
 * URL spends money on the platform's key and is reachable by anyone who
 * can type it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { recordAuthFailure } = vi.hoisted(() => ({ recordAuthFailure: vi.fn() }));
vi.mock("@/lib/monitoring", () => ({ recordAuthFailure }));

const { businessFindMany } = vi.hoisted(() => ({ businessFindMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { business: { findMany: businessFindMany } } }));

const { classifyQuietLeads } = vi.hoisted(() => ({ classifyQuietLeads: vi.fn() }));
vi.mock("@/lib/reactivation", () => ({ classifyQuietLeads }));

import { GET } from "@/app/api/cron/reactivation/route";

const PER_BUSINESS = 40;
const PER_TICK = 400;

function cronRequest(auth: string | null = "Bearer s3cr3t") {
  return new Request("https://followupbase.io/api/cron/reactivation", {
    headers: auth ? { authorization: auth } : {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

/** N paying businesses, each with a connected inbox. */
function businesses(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `biz-${i}`, subscriptionStatus: "active" }));
}

/** Every call spends its entire reservation — the five-year-inbox case. */
function alwaysFull() {
  classifyQuietLeads.mockImplementation(async (_id: string, { limit }: { limit: number }) => ({
    classified: limit,
    remaining: 5000,
    failed: 0,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "s3cr3t");
  businessFindMany.mockResolvedValue(businesses(1));
  classifyQuietLeads.mockResolvedValue({ classified: 3, remaining: 0, failed: 0 });
});

describe("GET /api/cron/reactivation — auth", () => {
  it("rejects a request with no cron secret and classifies nothing", async () => {
    const res = await GET(cronRequest(null));
    expect(res.status).toBe(401);
    expect(classifyQuietLeads).not.toHaveBeenCalled();
  });

  it("rejects a wrong bearer token", async () => {
    const res = await GET(cronRequest("Bearer nope"));
    expect(res.status).toBe(401);
    expect(classifyQuietLeads).not.toHaveBeenCalled();
  });

  it("fails closed when CRON_SECRET was never configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await GET(cronRequest());
    expect(res.status).toBe(401);
    expect(classifyQuietLeads).not.toHaveBeenCalled();
  });
});

describe("GET /api/cron/reactivation — who gets judged", () => {
  it("only looks at businesses with a connected inbox", async () => {
    await GET(cronRequest());
    const where = businessFindMany.mock.calls[0][0].where;
    expect(where.users.some.integrations.some).toEqual({ provider: { in: ["gmail", "outlook"] }, status: "connected" });
  });

  // Business rows carry AES-GCM encrypted third-party secrets; a
  // whole-row read here would decrypt every tenant's credentials on every
  // tick to answer a billing question.
  it("selects only the plain columns it needs", async () => {
    await GET(cronRequest());
    expect(businessFindMany.mock.calls[0][0].select).toEqual({ id: true, subscriptionStatus: true });
  });

  it("skips businesses without a live paid subscription, including Free tier", async () => {
    businessFindMany.mockResolvedValue([
      { id: "paying", subscriptionStatus: "active" },
      { id: "trialing", subscriptionStatus: "trialing" },
      { id: "lapsed", subscriptionStatus: "past_due" },
      { id: "free", subscriptionStatus: null, tier: "free" },
    ]);
    await GET(cronRequest());
    const judged = classifyQuietLeads.mock.calls.map((c) => c[0]);
    expect(judged.sort()).toEqual(["paying", "trialing"]);
  });

  it("passes a modest per-business limit, never the library default", async () => {
    await GET(cronRequest());
    expect(classifyQuietLeads).toHaveBeenCalledWith("biz-0", { limit: PER_BUSINESS });
  });
});

describe("GET /api/cron/reactivation — per-tick budget", () => {
  // The whole point of the budget: the first business returned must not be
  // able to consume the tick.
  it("stops spending once the tick's budget is gone", async () => {
    businessFindMany.mockResolvedValue(businesses(40)); // 40 x 40 = 1600 wanted, 400 allowed
    alwaysFull();

    const res = await GET(cronRequest());
    const body = await res.json();

    const spent = classifyQuietLeads.mock.calls.reduce((n, c) => n + (c[1] as { limit: number }).limit, 0);
    expect(spent).toBeLessThanOrEqual(PER_TICK);
    expect(body.classified).toBe(PER_TICK);
    expect(body.processed).toBe(PER_TICK / PER_BUSINESS);
    expect(body.skipped).toBe(40 - PER_TICK / PER_BUSINESS);
  });

  // Reserved-but-unspent budget goes back in the pot, so a tenant with
  // three quiet leads doesn't hold 40 slots and push everyone else out.
  it("hands unspent budget back so small businesses don't block the queue", async () => {
    businessFindMany.mockResolvedValue(businesses(30));
    classifyQuietLeads.mockResolvedValue({ classified: 2, remaining: 0, failed: 0 });

    const body = await (await GET(cronRequest())).json();

    expect(body.processed).toBe(30); // 30 x 2 = 60 actually spent, well inside 400
    expect(body.skipped).toBe(0);
    expect(body.classified).toBe(60);
  });

  // A failed verdict still cost an OpenAI call, so it must count against
  // the budget the same as a successful one.
  it("counts failures as spend", async () => {
    businessFindMany.mockResolvedValue(businesses(20));
    classifyQuietLeads.mockImplementation(async (_id: string, { limit }: { limit: number }) => ({
      classified: 0,
      remaining: 100,
      failed: limit,
    }));

    const body = await (await GET(cronRequest())).json();

    expect(body.failed).toBe(PER_TICK);
    expect(body.processed).toBe(PER_TICK / PER_BUSINESS);
  });
});

describe("GET /api/cron/reactivation — failure isolation", () => {
  it("one business throwing does not end the tick for the rest", async () => {
    businessFindMany.mockResolvedValue(businesses(3));
    classifyQuietLeads.mockImplementation(async (id: string) => {
      if (id === "biz-1") throw new Error("OpenAI 500");
      return { classified: 4, remaining: 0, failed: 0 };
    });
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await GET(cronRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.processed).toBe(2);
    expect(body.skipped).toBe(1);
    expect(body.classified).toBe(8);
    errorLog.mockRestore();
  });

  it("returns a message rather than a stack trace when the whole run fails", async () => {
    businessFindMany.mockRejectedValue(new Error("db down"));
    const res = await GET(cronRequest());
    expect(res.status).toBe(500);
    expect((await res.json()).success).toBe(false);
  });
});
