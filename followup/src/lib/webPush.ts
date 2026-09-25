import { sendNotification, WebPushError } from "web-push";
import { prisma } from "@/lib/db";

/**
 * FollowUp notifications on the owner's phone or computer (Web Push).
 *
 * The browser hands us a subscription — an endpoint URL at its vendor's push
 * service plus two keys — and we POST an encrypted payload there, signed
 * with FollowUp's VAPID key pair so the push service knows it is us.
 *
 * Keys come from VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT and
 * are never generated at runtime: a key pair made on the fly would change
 * on every deploy and silently orphan every subscription made under the
 * old one. Without all three, push is a silent no-op that logs once — the
 * founder generates them once (docs/alerts-setup.md).
 */

let loggedMissingKeys = false;

type VapidDetails = { subject: string; publicKey: string; privateKey: string };

function vapidDetails(): VapidDetails | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;
  return { subject, publicKey, privateKey };
}

export function isPushConfigured(): boolean {
  return vapidDetails() !== null;
}

/** The half the browser needs to subscribe. Public by design — it is in every subscription. */
export function vapidPublicKey(): string | null {
  return vapidDetails()?.publicKey ?? null;
}

/**
 * Where a subscription is allowed to point.
 *
 * web-push POSTs to whatever endpoint the browser gave us, from our server.
 * Accepting any URL would let a signed-in user register
 * "https://169.254.169.254/…" or an internal service and have FollowUp's
 * server call it every time an alert fires — the same server-side request
 * forgery src/lib/ssrf.ts exists to stop for webhooks. A real subscription
 * only ever points at one of the browser vendors' push services, so the
 * list of those IS the rule: Chrome/Android (FCM), Firefox (Mozilla),
 * Safari and iPhone (Apple), Edge (Windows).
 */
const PUSH_SERVICE_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "push.services.mozilla.com",
  "push.apple.com",
  "notify.windows.com",
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_SERVICE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

export type PushPayload = {
  title: string;
  body: string;
  /** Same-origin path the notification opens, e.g. /leads/abc. Checked again in public/sw.js. */
  url: string;
  /**
   * Replaces an earlier notification with the same tag instead of stacking
   * beside it — one line per waiting customer on the lock screen, however
   * the alert got there.
   */
  tag: string;
};

/**
 * `failed` counts devices that are still subscribed but did not take this
 * push (a 5xx, a timeout) — worth trying again, unlike `removed`.
 */
export type PushResult = { delivered: number; removed: number; failed: number };

/**
 * Send one payload to every device a person has turned notifications on for.
 *
 * A 404 or 410 from the push service means that browser has unsubscribed
 * (uninstalled, cleared site data, revoked permission). The row is deleted
 * so we stop knocking — the services treat repeated sends to a dead
 * endpoint as abuse. Anything else is logged and the row kept: a 5xx or a
 * timeout says nothing about whether the device still wants these.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<PushResult> {
  const vapid = vapidDetails();
  if (!vapid) {
    if (!loggedMissingKeys) {
      loggedMissingKeys = true;
      console.warn("FollowUp notifications are off: VAPID keys are not set (see docs/alerts-setup.md).");
    }
    return { delivered: 0, removed: 0, failed: 0 };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  let delivered = 0;
  let removed = 0;
  let failed = 0;
  const body = JSON.stringify(payload);
  for (const sub of subscriptions) {
    // Re-checked at send time, not only when the row was saved: a row
    // written before this rule existed, or by hand, must not be the way in.
    if (!isAllowedPushEndpoint(sub.endpoint)) {
      await prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
      removed += 1;
      continue;
    }
    try {
      await sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body, {
        vapidDetails: vapid,
        // Twelve hours: a phone that is off overnight still hears about a
        // customer from the evening, but nobody is woken on Thursday about
        // a customer from Monday.
        TTL: 12 * 60 * 60,
        urgency: "high",
        // The encoding every current browser supports, and the only one
        // Safari on iPhone accepts.
        contentEncoding: "aes128gcm",
        timeout: 10_000,
      });
      delivered += 1;
      await prisma.pushSubscription
        .update({ where: { id: sub.id }, data: { lastUsedAt: new Date() } })
        .catch(() => {});
    } catch (err) {
      const status = err instanceof WebPushError ? err.statusCode : undefined;
      if (status === 404 || status === 410) {
        await prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
        removed += 1;
      } else {
        failed += 1;
        console.error(`Push to a device of user ${userId} failed${status ? ` (${status})` : ""}:`, err instanceof Error ? err.message : err);
      }
    }
  }
  return { delivered, removed, failed };
}

/** Test seam: the "log once" flag is per process. */
export function __resetPushLogForTests(): void {
  loggedMissingKeys = false;
}
