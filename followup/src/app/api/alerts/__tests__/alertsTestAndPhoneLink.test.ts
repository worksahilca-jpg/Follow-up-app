/**
 * The two routes behind setup's alerts step (A-216): the test alert
 * ("Did your phone buzz?") and "Email me the link".
 *
 * What is being defended: a test only ever reaches the signed-in person's
 * own device, never anyone else's; the link only ever goes to their own
 * sign-in address (nothing in the request picks the recipient); neither
 * can be hammered; a stranger gets nothing.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  getSessionContext: vi.fn(),
  tooManyRecentActions: vi.fn(async () => false),
  subFindFirst: vi.fn(),
  userFindUnique: vi.fn(),
  sendPushToUser: vi.fn(),
  sendAlertEmail: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSessionContext: h.getSessionContext }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions: h.tooManyRecentActions }));
vi.mock("@/lib/db", () => ({
  prisma: { pushSubscription: { findFirst: h.subFindFirst }, user: { findUnique: h.userFindUnique } },
}));
vi.mock("@/lib/webPush", async (orig) => ({ ...(await orig<typeof import("@/lib/webPush")>()), sendPushToUser: h.sendPushToUser }));
vi.mock("@/lib/alertEmail", async (orig) => ({ ...(await orig<typeof import("@/lib/alertEmail")>()), sendAlertEmail: h.sendAlertEmail }));

import { POST as TEST } from "@/app/api/alerts/test/route";
import { POST as LINK } from "@/app/api/alerts/phone-link/route";

function req(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof TEST>[0];
}

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/device-abc";

beforeEach(() => {
  vi.clearAllMocks();
  h.getSessionContext.mockResolvedValue({ userId: "user1", businessId: "biz1", email: "owner@shop.test", authTime: 0 });
  h.tooManyRecentActions.mockResolvedValue(false);
  h.subFindFirst.mockResolvedValue({ id: "sub1" });
  h.userFindUnique.mockResolvedValue({ email: "owner@shop.test" });
  h.sendPushToUser.mockResolvedValue({ delivered: 1, removed: 0, failed: 0 });
  h.sendAlertEmail.mockResolvedValue({ sent: true });
  vi.stubEnv("VAPID_PUBLIC_KEY", "BPublic");
  vi.stubEnv("VAPID_PRIVATE_KEY", "private");
  vi.stubEnv("VAPID_SUBJECT", "mailto:contact@followupbase.io");
  vi.stubEnv("RESEND_API_KEY", "re_key");
  vi.stubEnv("NEXTAUTH_URL", "https://followupbase.io");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.followupbase.io");
});

describe("signed out", () => {
  it("refuses both with 401 and sends nothing", async () => {
    h.getSessionContext.mockResolvedValue(null);
    expect((await TEST(req({ endpoint: ENDPOINT }))).status).toBe(401);
    expect((await LINK()).status).toBe(401);
    expect(h.sendPushToUser).not.toHaveBeenCalled();
    expect(h.sendAlertEmail).not.toHaveBeenCalled();
  });
});

describe("POST /api/alerts/test", () => {
  it("sends one alert to that device only, and only if it is the person's own", async () => {
    const res = await TEST(req({ endpoint: ENDPOINT }));
    expect(res.status).toBe(200);
    expect(h.subFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { endpoint: ENDPOINT, userId: "user1" } }));
    expect(h.sendPushToUser).toHaveBeenCalledTimes(1);
    const [userId, payload, opts] = h.sendPushToUser.mock.calls[0]!;
    expect(userId).toBe("user1");
    expect(opts).toEqual({ endpoint: ENDPOINT });
    expect(payload).toMatchObject({ title: "Alerts are on", url: "/dashboard" });
  });

  it("does nothing for a device that isn't theirs (or isn't registered)", async () => {
    h.subFindFirst.mockResolvedValue(null);
    const res = await TEST(req({ endpoint: ENDPOINT }));
    expect(res.status).toBe(404);
    expect(h.sendPushToUser).not.toHaveBeenCalled();
  });

  it("refuses an address that isn't a browser push service", async () => {
    const res = await TEST(req({ endpoint: "https://evil.example/collect" }));
    expect(res.status).toBe(400);
    expect(h.subFindFirst).not.toHaveBeenCalled();
    expect(h.sendPushToUser).not.toHaveBeenCalled();
  });

  it("says so when the device didn't take it", async () => {
    h.sendPushToUser.mockResolvedValue({ delivered: 0, removed: 0, failed: 1 });
    const res = await TEST(req({ endpoint: ENDPOINT }));
    expect(res.status).toBe(502);
    expect((await res.json()).success).toBe(false);
  });

  it("is rate-limited per person", async () => {
    h.tooManyRecentActions.mockResolvedValue(true);
    expect((await TEST(req({ endpoint: ENDPOINT }))).status).toBe(429);
    expect(h.tooManyRecentActions).toHaveBeenCalledWith("biz1", "alerts.test:user1", expect.any(Object));
    expect(h.sendPushToUser).not.toHaveBeenCalled();
  });

  it("answers 503 when alerts have no keys", async () => {
    vi.stubEnv("VAPID_SUBJECT", "");
    expect((await TEST(req({ endpoint: ENDPOINT }))).status).toBe(503);
  });
});

describe("POST /api/alerts/phone-link", () => {
  it("emails the link to the person's own sign-in address", async () => {
    const res = await LINK();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, to: "owner@shop.test" });
    expect(h.sendAlertEmail).toHaveBeenCalledTimes(1);
    const email = h.sendAlertEmail.mock.calls[0]![0];
    expect(email.to).toBe("owner@shop.test");
    expect(email.text).toContain("https://www.followupbase.io/dashboard?alerts=on");
    expect(email.html).toContain("https://www.followupbase.io/dashboard?alerts=on");
  });

  it("is rate-limited per person", async () => {
    h.tooManyRecentActions.mockResolvedValue(true);
    expect((await LINK()).status).toBe(429);
    expect(h.tooManyRecentActions).toHaveBeenCalledWith("biz1", "alerts.phone-link:user1", expect.any(Object));
    expect(h.sendAlertEmail).not.toHaveBeenCalled();
  });

  it("says so when the email didn't go", async () => {
    h.sendAlertEmail.mockResolvedValue({ sent: false, reason: "resend 500" });
    expect((await LINK()).status).toBe(502);
  });

  it("answers 503 when email isn't set up", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect((await LINK()).status).toBe(503);
    expect(h.sendAlertEmail).not.toHaveBeenCalled();
  });
});
