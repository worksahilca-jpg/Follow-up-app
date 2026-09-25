/**
 * The Alerts settings routes: /api/alerts (email preference) and
 * /api/alerts/push (this device on/off).
 *
 * What is being defended: a stranger cannot register or remove devices;
 * a signed-in person can only ever touch their own devices and their own
 * preference; the server only accepts a subscription that points at a real
 * browser push service (it POSTs there on every alert); and nobody can
 * hammer the endpoints.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  getSessionContext: vi.fn(),
  tooManyRecentActions: vi.fn(async () => false),
  subFindUnique: vi.fn(),
  subCreate: vi.fn(async () => ({})),
  subUpdate: vi.fn(async () => ({})),
  subDeleteMany: vi.fn(async () => ({ count: 1 })),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(async () => ({})),
}));

vi.mock("@/lib/session", () => ({ getSessionContext: h.getSessionContext }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions: h.tooManyRecentActions }));
vi.mock("@/lib/db", () => ({
  prisma: {
    pushSubscription: { findUnique: h.subFindUnique, create: h.subCreate, update: h.subUpdate, deleteMany: h.subDeleteMany },
    user: { findUnique: h.userFindUnique, update: h.userUpdate },
  },
}));

import { GET, PATCH } from "@/app/api/alerts/route";
import { POST, DELETE } from "@/app/api/alerts/push/route";

function req(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof POST>[0];
}

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/device-abc";
const KEYS = { p256dh: "B" + "x".repeat(86), auth: "y".repeat(22) };

beforeEach(() => {
  vi.clearAllMocks();
  h.getSessionContext.mockResolvedValue({ userId: "user1", businessId: "biz1", email: "owner@shop.test", authTime: 0 });
  h.tooManyRecentActions.mockResolvedValue(false);
  h.subFindUnique.mockResolvedValue(null);
  h.userFindUnique.mockResolvedValue({ alertEmailEnabled: true });
  vi.stubEnv("VAPID_PUBLIC_KEY", "BPublic");
  vi.stubEnv("VAPID_PRIVATE_KEY", "private");
  vi.stubEnv("VAPID_SUBJECT", "mailto:contact@followupbase.io");
  vi.stubEnv("RESEND_API_KEY", "re_key");
});

describe("signed out", () => {
  it("refuses every route with 401 and touches nothing", async () => {
    h.getSessionContext.mockResolvedValue(null);
    for (const res of [
      await GET(),
      await PATCH(req({ emailEnabled: false })),
      await POST(req({ endpoint: ENDPOINT, keys: KEYS })),
      await DELETE(req({ endpoint: ENDPOINT })),
    ]) {
      expect(res.status).toBe(401);
    }
    expect(h.subCreate).not.toHaveBeenCalled();
    expect(h.subDeleteMany).not.toHaveBeenCalled();
    expect(h.userUpdate).not.toHaveBeenCalled();
  });
});

describe("GET /api/alerts", () => {
  it("says which channels are set up, and hands over only the PUBLIC key", async () => {
    const data = await (await GET()).json();
    expect(data).toEqual({
      success: true,
      email: { available: true, enabled: true },
      push: { available: true, publicKey: "BPublic" },
    });
    expect(JSON.stringify(data)).not.toContain("private");
  });

  it("reports a channel without keys as unavailable", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("VAPID_SUBJECT", "");
    const data = await (await GET()).json();
    expect(data.email.available).toBe(false);
    expect(data.push).toEqual({ available: false, publicKey: null });
  });
});

describe("PATCH /api/alerts", () => {
  it("saves the signed-in person's own preference", async () => {
    const res = await PATCH(req({ emailEnabled: false }));
    expect(res.status).toBe(200);
    expect(h.userUpdate).toHaveBeenCalledWith({ where: { id: "user1" }, data: { alertEmailEnabled: false } });
  });

  it.each([{}, { emailEnabled: "no" }, { emailEnabled: false, userId: "someone-else" }, "x"])("rejects %j", async (body) => {
    const res = await PATCH(req(body));
    expect(res.status).toBe(400);
    expect(h.userUpdate).not.toHaveBeenCalled();
  });
});

describe("POST /api/alerts/push", () => {
  it("saves this device for the signed-in person", async () => {
    const res = await POST(req({ endpoint: ENDPOINT, keys: KEYS, expirationTime: null }));
    expect(res.status).toBe(200);
    expect(h.subCreate).toHaveBeenCalledWith({ data: { userId: "user1", endpoint: ENDPOINT, p256dh: KEYS.p256dh, auth: KEYS.auth } });
  });

  it.each([
    ["an endpoint that is not a push service", { endpoint: "https://169.254.169.254/latest", keys: KEYS }],
    ["plain http", { endpoint: ENDPOINT.replace("https", "http"), keys: KEYS }],
    ["no keys", { endpoint: ENDPOINT }],
    ["a key that is not base64url", { endpoint: ENDPOINT, keys: { ...KEYS, auth: "<script>alert(1)</script>" } }],
    ["an unexpected field", { endpoint: ENDPOINT, keys: KEYS, userId: "someone-else" }],
    ["an oversized endpoint", { endpoint: `${ENDPOINT}/${"a".repeat(3000)}`, keys: KEYS }],
  ])("rejects %s with 400", async (_label, body) => {
    const res = await POST(req(body));
    expect(res.status).toBe(400);
    expect(h.subCreate).not.toHaveBeenCalled();
    expect(h.subUpdate).not.toHaveBeenCalled();
  });

  it("moves a shared browser to whoever is signed in now, when the request proves it holds the browser's keys", async () => {
    h.subFindUnique.mockResolvedValue({ id: "sub1", userId: "user2", ...KEYS });
    const res = await POST(req({ endpoint: ENDPOINT, keys: KEYS }));
    expect(res.status).toBe(200);
    expect(h.subUpdate).toHaveBeenCalledWith({ where: { id: "sub1" }, data: { userId: "user1", ...KEYS } });
  });

  it("refuses to take over someone else's device with only its endpoint", async () => {
    h.subFindUnique.mockResolvedValue({ id: "sub1", userId: "user2", p256dh: "B" + "z".repeat(86), auth: "q".repeat(22) });
    const res = await POST(req({ endpoint: ENDPOINT, keys: KEYS }));
    expect(res.status).toBe(409);
    expect(h.subUpdate).not.toHaveBeenCalled();
  });

  it("is rate-limited per person", async () => {
    h.tooManyRecentActions.mockResolvedValue(true);
    const res = await POST(req({ endpoint: ENDPOINT, keys: KEYS }));
    expect(res.status).toBe(429);
    expect(h.tooManyRecentActions).toHaveBeenCalledWith("biz1", "alerts.push:user1", expect.any(Object));
    expect(h.subCreate).not.toHaveBeenCalled();
  });

  it("says so plainly when push is not set up on the server", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    const res = await POST(req({ endpoint: ENDPOINT, keys: KEYS }));
    expect(res.status).toBe(503);
    expect(h.subCreate).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/alerts/push", () => {
  it("only ever removes the signed-in person's own device", async () => {
    const res = await DELETE(req({ endpoint: ENDPOINT }));
    expect(res.status).toBe(200);
    expect(h.subDeleteMany).toHaveBeenCalledWith({ where: { endpoint: ENDPOINT, userId: "user1" } });
  });

  it("rejects a body that is not a push endpoint", async () => {
    const res = await DELETE(req({ endpoint: "https://example.com/x" }));
    expect(res.status).toBe(400);
    expect(h.subDeleteMany).not.toHaveBeenCalled();
  });

  it("is rate-limited per person", async () => {
    h.tooManyRecentActions.mockResolvedValue(true);
    expect((await DELETE(req({ endpoint: ENDPOINT }))).status).toBe(429);
    expect(h.subDeleteMany).not.toHaveBeenCalled();
  });
});
