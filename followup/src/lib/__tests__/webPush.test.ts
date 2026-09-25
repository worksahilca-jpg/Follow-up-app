/**
 * The phone half of owner alerts (src/lib/webPush.ts).
 *
 * Three things matter beyond "it sends": a device the push service says is
 * gone must be forgotten (the services treat repeated sends to a dead
 * endpoint as abuse); a device that merely had a bad minute must NOT be
 * forgotten; and FollowUp's server must only ever call a browser vendor's
 * push service, never a URL a user typed in.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => {
  class FakeWebPushError extends Error {
    statusCode: number;
    constructor(statusCode: number) {
      super(`push service said ${statusCode}`);
      this.statusCode = statusCode;
    }
  }
  return {
    sendNotification: vi.fn(),
    WebPushError: FakeWebPushError,
    subs: [] as { id: string; endpoint: string; p256dh: string; auth: string }[],
    deleted: [] as string[],
    touched: [] as string[],
  };
});

vi.mock("web-push", () => ({ sendNotification: h.sendNotification, WebPushError: h.WebPushError }));

vi.mock("@/lib/db", () => ({
  prisma: {
    pushSubscription: {
      findMany: vi.fn(async () => h.subs),
      deleteMany: vi.fn(async ({ where }: { where: { id: string } }) => {
        h.deleted.push(where.id);
        return { count: 1 };
      }),
      update: vi.fn(async ({ where }: { where: { id: string } }) => {
        h.touched.push(where.id);
        return {};
      }),
    },
  },
}));

import { sendPushToUser, isAllowedPushEndpoint, isPushConfigured, __resetPushLogForTests } from "@/lib/webPush";
import { prisma } from "@/lib/db";

const payload = { title: "Jane is waiting", body: "Is it still available?", url: "/leads/l1", tag: "lead-l1" };
const sub = (id: string, host = "fcm.googleapis.com") => ({ id, endpoint: `https://${host}/fcm/send/${id}`, p256dh: "p".repeat(87), auth: "a".repeat(22) });

beforeEach(() => {
  h.subs.length = 0;
  h.deleted.length = 0;
  h.touched.length = 0;
  h.sendNotification.mockReset();
  h.sendNotification.mockResolvedValue({ statusCode: 201 });
  vi.stubEnv("VAPID_PUBLIC_KEY", "BPublicKeyForTests");
  vi.stubEnv("VAPID_PRIVATE_KEY", "privateKeyForTests");
  vi.stubEnv("VAPID_SUBJECT", "mailto:contact@followupbase.io");
  __resetPushLogForTests();
});

describe("without VAPID keys", () => {
  it("is a silent no-op that never reads the database", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    h.subs.push(sub("s1"));
    expect(isPushConfigured()).toBe(false);
    expect(await sendPushToUser("u1", payload)).toEqual({ delivered: 0, removed: 0 });
    await sendPushToUser("u1", payload);
    expect(prisma.pushSubscription.findMany).not.toHaveBeenCalled();
    expect(h.sendNotification).not.toHaveBeenCalled();
    // Logged once, not on every tick.
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("delivery", () => {
  it("sends to every device the person has, signed with the configured keys", async () => {
    h.subs.push(sub("s1"), sub("s2", "web.push.apple.com"));
    const r = await sendPushToUser("u1", payload);
    expect(r).toEqual({ delivered: 2, removed: 0 });
    const [target, body, options] = h.sendNotification.mock.calls[0];
    expect(target).toEqual({ endpoint: h.subs[0].endpoint, keys: { p256dh: h.subs[0].p256dh, auth: h.subs[0].auth } });
    expect(JSON.parse(body)).toEqual(payload);
    expect(options.vapidDetails).toEqual({
      subject: "mailto:contact@followupbase.io",
      publicKey: "BPublicKeyForTests",
      privateKey: "privateKeyForTests",
    });
    expect(h.touched).toEqual(["s1", "s2"]);
  });

  it.each([404, 410])("forgets a device the push service reports as gone (%i)", async (status) => {
    h.subs.push(sub("gone"), sub("alive"));
    h.sendNotification.mockRejectedValueOnce(new h.WebPushError(status));
    const r = await sendPushToUser("u1", payload);
    expect(h.deleted).toEqual(["gone"]);
    expect(r).toEqual({ delivered: 1, removed: 1 });
  });

  it("keeps a device through a temporary failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    h.subs.push(sub("s1"));
    h.sendNotification.mockRejectedValueOnce(new h.WebPushError(503));
    const r = await sendPushToUser("u1", payload);
    expect(h.deleted).toEqual([]);
    expect(r).toEqual({ delivered: 0, removed: 0 });
  });

  it("never calls an endpoint that is not a browser push service, and drops the row", async () => {
    h.subs.push({ ...sub("evil"), endpoint: "https://169.254.169.254/latest/meta-data" });
    const r = await sendPushToUser("u1", payload);
    expect(h.sendNotification).not.toHaveBeenCalled();
    expect(h.deleted).toEqual(["evil"]);
    expect(r.removed).toBe(1);
  });
});

describe("isAllowedPushEndpoint", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://web.push.apple.com/QK4abc",
    "https://wns2-bl2p.notify.windows.com/w/?token=abc",
  ])("accepts %s", (url) => expect(isAllowedPushEndpoint(url)).toBe(true));

  it.each([
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://fcm.googleapis.com.evil.test/x",
    "https://evilfcm.googleapis.com.test/x",
    "https://localhost/x",
    "https://10.0.0.5/x",
    "https://fcm.googleapis.com:8443/x",
    "https://user:pw@fcm.googleapis.com/x",
    "not a url",
  ])("refuses %s", (url) => expect(isAllowedPushEndpoint(url)).toBe(false));
});
