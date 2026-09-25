"use client";

import { useEffect, useState } from "react";
import Switch from "@/components/Switch";

/**
 * Settings → Alerts: how FollowUp reaches an owner who is not in the app
 * when a customer is waiting for their OK (src/lib/ownerAlerts.ts).
 *
 * Two controls and nothing else, on purpose — the founder owns these
 * screens and asked for the smallest block that does the job. Email is a
 * per-person switch, on by default. A device is on when it has allowed
 * notifications and subscribed; "Turn off" unsubscribes it.
 *
 * Each row appears only when the server has that channel's keys. A switch
 * that reads "on" while nothing can be sent is a promise FollowUp is not
 * keeping — the same reason Outlook's row is left out when its OAuth is not
 * configured.
 */

type AlertStatus = {
  email: { available: boolean; enabled: boolean };
  push: { available: boolean; publicKey: string | null };
};

// What this browser can do, found out after mount (it depends on window).
type PushState = "checking" | "off" | "on" | "blocked" | "needs-home-screen" | "unsupported";

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

function isIOS(): boolean {
  // iPadOS reports itself as a Mac; the touch points give it away.
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

async function postSubscription(sub: PushSubscription): Promise<void> {
  const res = await fetch("/api/alerts/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't turn notifications on — try again.");
}

export default function AlertsSection() {
  const [status, setStatus] = useState<AlertStatus | null>(null);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pushState, setPushState] = useState<PushState>("checking");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    fetch("/api/alerts")
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) setStatus({ email: d.email, push: d.push });
      })
      .catch(() => {});
  }, []);

  // Browser-only facts, read once the page has hydrated.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const standaloneNow = isStandalone();
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      let next: PushState;
      if (!supported) {
        // Safari on iPhone only offers notifications to a site opened from
        // the Home Screen; in a normal tab the APIs are simply absent.
        next = isIOS() && !standaloneNow ? "needs-home-screen" : "unsupported";
      } else if (Notification.permission === "denied") {
        next = "blocked";
      } else {
        const reg = await navigator.serviceWorker.getRegistration("/").catch(() => undefined);
        const sub = await reg?.pushManager.getSubscription().catch(() => null);
        next = sub && Notification.permission === "granted" ? "on" : "off";
        // Quietly re-send what this browser holds, in case the server
        // dropped it (the push service said it was gone) or it was last
        // registered under someone else on a shared computer.
        if (sub && next === "on") postSubscription(sub).catch(() => {});
      }
      if (cancelled) return;
      setStandalone(standaloneNow);
      setPushState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleEmail() {
    if (!status) return;
    const next = !status.email.enabled;
    setStatus({ ...status, email: { ...status.email, enabled: next } });
    setEmailSaving(true);
    setEmailError(null);
    try {
      const res = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailEnabled: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't save — try again.");
    } catch (err) {
      // Revert the optimistic flip, like every other switch on this page.
      setStatus((s) => (s ? { ...s, email: { ...s.email, enabled: !next } } : s));
      setEmailError(err instanceof Error ? err.message : "Couldn't save — try again.");
    } finally {
      setEmailSaving(false);
    }
  }

  async function turnOnPush() {
    const publicKey = status?.push.publicKey;
    if (!publicKey) return;
    setPushBusy(true);
    setPushError(null);
    try {
      // First, before any other await: Safari only shows the permission
      // prompt when it is asked for directly inside the tap.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState(permission === "denied" ? "blocked" : "off");
        return;
      }
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
      setPushState("on");
    } catch (err) {
      setPushError(err instanceof Error && err.message ? err.message : "Couldn't turn notifications on — try again.");
    } finally {
      setPushBusy(false);
    }
  }

  async function turnOffPush() {
    setPushBusy(true);
    setPushError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        // Server first: if this fails the device is still subscribed and
        // still says so, rather than looking off while alerts keep coming.
        const res = await fetch("/api/alerts/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't turn notifications off — try again.");
        await sub.unsubscribe();
      }
      setPushState("off");
    } catch (err) {
      setPushError(err instanceof Error && err.message ? err.message : "Couldn't turn notifications off — try again.");
    } finally {
      setPushBusy(false);
    }
  }

  if (!status || (!status.email.available && !status.push.available)) return null;

  const showPush = status.push.available && pushState !== "checking";
  const canTurnOn = pushState === "off";

  return (
    <section id="alerts" className="scroll-mt-16">
      <h2 className="font-display text-xl">Alerts</h2>
      <div className="mt-4 box p-5">
        {status.email.available && (
          <div className="flex items-center justify-between gap-4">
            <p className="font-medium text-sm">Email me when a customer is waiting</p>
            <Switch
              checked={status.email.enabled}
              onChange={toggleEmail}
              disabled={emailSaving}
              label="Email me when a customer is waiting"
            />
          </div>
        )}
        {emailError && (
          <p className="mt-3 text-xs" style={{ color: "var(--coral)" }} role="alert">
            {emailError}
          </p>
        )}

        {showPush && (
          <div className={status.email.available ? "mt-4 border-t border-line pt-4" : ""}>
            {pushState === "on" ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm">FollowUp notifications are on for this device.</p>
                <button
                  type="button"
                  onClick={turnOffPush}
                  disabled={pushBusy}
                  className="shrink-0 rounded-lg border px-3.5 py-2 text-sm font-medium disabled:opacity-60"
                  style={{ borderColor: "var(--line)" }}
                >
                  Turn off
                </button>
              </div>
            ) : pushState === "blocked" ? (
              <p className="text-sm text-ink-soft">
                Notifications are blocked for FollowUp in this browser. Allow them in the browser&apos;s settings for
                this site, then come back here.
              </p>
            ) : pushState === "unsupported" ? (
              <p className="text-sm text-ink-soft">This browser can&apos;t show notifications from FollowUp.</p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={turnOnPush}
                  disabled={!canTurnOn || pushBusy}
                  aria-busy={pushBusy}
                  // text-left: at 390px the label wraps, and centred it read
                  // as two stray lines beside the left-aligned hint below.
                  className="rounded-lg border px-3.5 py-2 text-left text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ borderColor: "var(--line)" }}
                >
                  Turn on FollowUp notifications on this device
                </button>
                {/* The one step an iPhone owner cannot guess: Safari only
                    allows notifications for a site opened from the Home
                    Screen. Not shown once they are there. */}
                {!standalone && (
                  <p className="mt-2 text-xs text-ink-soft">On iPhone, add FollowUp to your Home Screen first.</p>
                )}
              </>
            )}
            {pushError && (
              <p className="mt-3 text-xs" style={{ color: "var(--coral)" }} role="alert">
                {pushError}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
