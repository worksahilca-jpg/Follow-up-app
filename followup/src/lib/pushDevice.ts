/**
 * This browser and FollowUp's phone alerts: what it can do, and turning
 * alerts on or off for it. Browser-only (every function reads window or
 * navigator); call from effects and click handlers, never during render.
 *
 * Shared by Settings → Alerts (src/components/AlertsSection.tsx), setup's
 * alerts step and the alerts card on Today (src/components/app/AlertsSetup.tsx),
 * so the three can never disagree about whether this device is on.
 */

// What this browser can do, found out after mount.
export type PushState = "checking" | "off" | "on" | "blocked" | "needs-home-screen" | "unsupported";

/** VAPID keys travel as base64url; PushManager wants the raw bytes. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

export function isIOS(): boolean {
  // iPadOS reports itself as a Mac; the touch points give it away.
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * A phone or tablet, as opposed to a computer: alerts are set up on the
 * phone (A-216), so a computer hands over to it instead of offering its own.
 */
export function isPhone(): boolean {
  const ua = navigator.userAgent;
  return isIOS() || /Android|Mobi/i.test(ua) || window.matchMedia?.("(pointer: coarse)").matches === true;
}

async function postSubscription(sub: PushSubscription): Promise<void> {
  const res = await fetch("/api/alerts/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't turn alerts on. Try again.");
}

/**
 * Where this browser stands. When it is already on, what it holds is quietly
 * sent again, in case the server dropped it (the push service said it was
 * gone) or it was last registered under someone else on a shared computer.
 */
export async function readPushState(): Promise<PushState> {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) {
    // Safari on iPhone only offers notifications to a site opened from the
    // Home Screen; in a normal tab the APIs are simply absent.
    return isIOS() && !isStandalone() ? "needs-home-screen" : "unsupported";
  }
  if (Notification.permission === "denied") return "blocked";
  const reg = await navigator.serviceWorker.getRegistration("/").catch(() => undefined);
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  const on = Boolean(sub) && Notification.permission === "granted";
  if (sub && on) postSubscription(sub).catch(() => {});
  return on ? "on" : "off";
}

/** This browser's push address, when alerts are on for it. */
export async function currentEndpoint(): Promise<string | null> {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration("/").catch(() => undefined);
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  return sub?.endpoint ?? null;
}

/**
 * Ask, subscribe and register. Must be called straight from a tap: Safari
 * only shows the permission prompt when it is asked for directly inside
 * one, so the permission request comes before any other await.
 * Resolves to the new state and, when on, this device's endpoint.
 */
export async function turnOnPush(publicKey: string): Promise<{ state: PushState; endpoint: string | null }> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { state: permission === "denied" ? "blocked" : "off", endpoint: null };
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const key = keyBytes(publicKey);
  let sub = await reg.pushManager.getSubscription();
  // A subscription made under an older key can never be delivered to;
  // replace it rather than send the server something dead.
  if (sub && !sameKey(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe();
    sub = null;
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await postSubscription(sub);
  return { state: "on", endpoint: sub.endpoint };
}

/** "Turn off": the server first, so a failure leaves the device on and saying so. */
export async function turnOffPush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  const res = await fetch("/api/alerts/push", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't turn alerts off. Try again.");
  await sub.unsubscribe();
}

/** One real alert to this device: "Did your phone buzz?" (POST /api/alerts/test). */
export async function sendTestAlert(endpoint: string): Promise<void> {
  const res = await fetch("/api/alerts/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't send a test. Try again.");
}
