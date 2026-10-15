"use client";

import { useState, useSyncExternalStore } from "react";
import { SquarePlus } from "lucide-react";
import { isStandalone } from "@/lib/pushDevice";
import { useAlertsAsking } from "./AlertsSetup";

/**
 * "Put FollowUp on your Home Screen" (A-265, founder 2026-10-15: "let it be
 * web" → "yes build it"). FollowUp stays a web app; installed from the
 * browser it gets an icon, a full screen and the buzz.
 *
 * On an iPhone the alerts card already walks through the three Safari taps
 * (A-216), because Apple only lets a Home Screen app send alerts. This card
 * is for the phones where the browser can install with one tap (Chrome on
 * Android fires `beforeinstallprompt` once it judges the app installable):
 * one row on Today, one button, "Not now" for two weeks, gone once installed.
 * It never shows beside the alerts card: one ask at a time (A-243).
 */
const NOT_NOW_KEY = "followup.installCard.notNowUntil";
const NOT_NOW_MS = 14 * 24 * 60 * 60 * 1000;

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/** Chrome fires the event before the card mounts on a fast page, so it is caught at module load and kept. */
let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function notNowActive(): boolean {
  try {
    return Number(window.localStorage.getItem(NOT_NOW_KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
}

export default function InstallCard() {
  const canInstall = useSyncExternalStore(subscribe, () => deferred !== null, () => false);
  const saidNotNow = useSyncExternalStore(subscribe, notNowActive, () => true);
  const [gone, setGone] = useState(false);
  // Already opened from the Home Screen: nothing to add.
  const installed = useSyncExternalStore(subscribe, isStandalone, () => true);
  const alertsAsking = useAlertsAsking();

  if (!canInstall || saidNotNow || gone || installed || alertsAsking) return null;

  async function add() {
    const p = deferred;
    if (!p) return;
    await p.prompt();
    const { outcome } = await p.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    if (outcome === "accepted") setGone(true);
  }
  function notNow() {
    try {
      window.localStorage.setItem(NOT_NOW_KEY, String(Date.now() + NOT_NOW_MS));
    } catch {
      // Private mode: it hides for this visit only.
    }
    setGone(true);
  }

  return (
    <section aria-label="Put FollowUp on your Home Screen" className="grid gap-3 rounded-2xl border border-line bg-card px-[18px] py-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card-2 text-ink" aria-hidden="true">
          <SquarePlus className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="text-base font-semibold leading-[1.3] text-ink">Put FollowUp on your Home Screen</p>
          <p className="mt-[3px] text-[14.5px] leading-[1.45] text-ink-soft">One tap. It opens like an app, full screen, with its own icon.</p>
        </div>
      </div>
      <div className="flex items-center gap-4 sm:pl-12">
        {/* Outlined, never black: the one black button on Today is Send. */}
        <button type="button" onClick={add} className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink px-5 text-[15px] font-semibold">
          Add
        </button>
        <button type="button" onClick={notNow} className="min-h-11 text-[14.5px] text-ink-soft hover:text-ink">
          Not now
        </button>
      </div>
    </section>
  );
}
