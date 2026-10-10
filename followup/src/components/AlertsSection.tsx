"use client";

import { useEffect, useState } from "react";
import Switch from "@/components/Switch";
import { isStandalone, readPushState, turnOffPush, turnOnPush, type PushState } from "@/lib/pushDevice";

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
    readPushState().then((next) => {
      if (cancelled) return;
      setStandalone(isStandalone());
      setPushState(next);
    });
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

  async function turnOn() {
    const publicKey = status?.push.publicKey;
    if (!publicKey) return;
    setPushBusy(true);
    setPushError(null);
    try {
      setPushState((await turnOnPush(publicKey)).state);
    } catch (err) {
      setPushError(err instanceof Error && err.message ? err.message : "Couldn't turn notifications on — try again.");
    } finally {
      setPushBusy(false);
    }
  }

  async function turnOff() {
    setPushBusy(true);
    setPushError(null);
    try {
      await turnOffPush();
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
      {/* Its page's title already says "Alerts" (A-220 gave it its own row), so this label is for screen readers only. */}
      <h2 className="sr-only">Alerts</h2>
      <div className="box p-5">
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
          <p className="mt-3 text-[13px]" style={{ color: "var(--coral)" }} role="alert">
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
                  onClick={turnOff}
                  disabled={pushBusy}
                  className="shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium disabled:opacity-60"
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
                  onClick={turnOn}
                  disabled={!canTurnOn || pushBusy}
                  aria-busy={pushBusy}
                  // text-left: at 390px the label wraps, and centred it read
                  // as two stray lines beside the left-aligned hint below.
                  className="rounded-full border px-3.5 py-2 text-left text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ borderColor: "var(--line)" }}
                >
                  Turn on FollowUp notifications on this device
                </button>
                {/* The one step an iPhone owner cannot guess: Safari only
                    allows notifications for a site opened from the Home
                    Screen. Not shown once they are there. */}
                {!standalone && (
                  <p className="mt-2 text-[13px] text-ink-soft">On iPhone, add FollowUp to your Home Screen first.</p>
                )}
              </>
            )}
            {pushError && (
              <p className="mt-3 text-[13px]" style={{ color: "var(--coral)" }} role="alert">
                {pushError}
              </p>
            )}
          </div>
        )}
        {/* Quiet hours (src/lib/ownerAlerts.ts): said where the owner sets alerts, so silence at night is never a surprise. */}
        <p className="mt-4 border-t border-line pt-4 text-[13px] text-ink-soft">
          No alerts between 10 pm and 7 am. Anyone who writes at night is in your first alert of the morning.
        </p>
      </div>
    </section>
  );
}
