"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, Bell, Check, Loader2, Mail, Moon, Share, SquarePlus } from "lucide-react";
import { encode } from "uqr";
import { ALERTS_SETUP_PATH } from "@/lib/alertsSetup";
import { currentEndpoint, isPhone, readPushState, sendTestAlert, turnOnPush, type PushState } from "@/lib/pushDevice";

/**
 * "Get a buzz when someone needs you" (A-215 #1, built as drawn in A-216).
 *
 * The owner wasn't being reached: replies waited for an OK nobody came to
 * give, and only one phone had ever turned alerts on, from a small line
 * inside Settings. So the phone alert is set up where the owner can't miss
 * it, with a real test:
 * - setup's last step (`AlertsSetupStep`, in src/components/OnboardingForm.tsx);
 * - one card on Today for everyone who set up before (`AlertsCard`).
 *
 * The same states drive both:
 * - a phone that can take alerts: one tap, then a test ("Did your phone buzz?");
 * - an iPhone in Safari: three taps to put FollowUp on the Home Screen first,
 *   because Apple only lets Home Screen web apps send alerts;
 * - a computer: alerts belong on the phone, so it hands over, with a code to
 *   scan or the link by email, and moves on by itself once the phone is done;
 * - blocked or unsupported: say so plainly, never a button that can't work.
 */

type Status = {
  pushAvailable: boolean;
  publicKey: string | null;
  emailAvailable: boolean;
  devices: number;
  lastDeliveredAt: string | null;
};

type Kind = "loading" | "unavailable" | "phone" | "computer";

export function useAlertsSetup() {
  const [status, setStatus] = useState<Status | null | "failed">(null);
  const [device, setDevice] = useState<PushState>("checking");
  const [phone, setPhone] = useState<boolean | null>(null);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState<"on" | "test" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The test that proves it: "sent" right after turning on, "again" after "No buzz?".
  const [tested, setTested] = useState<"sent" | "again" | null>(null);
  const [emailedTo, setEmailedTo] = useState<string | null>(null);

  const load = useCallback(async (): Promise<Status | null> => {
    const d = await fetch("/api/alerts")
      .then((r) => r.json())
      .catch(() => null);
    if (!d?.success) return null;
    return {
      pushAvailable: Boolean(d.push?.available && d.push?.publicKey),
      publicKey: d.push?.publicKey ?? null,
      emailAvailable: Boolean(d.email?.available),
      devices: Number(d.push?.devices ?? 0),
      lastDeliveredAt: d.push?.lastDeliveredAt ?? null,
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [s, state, ep] = await Promise.all([load(), readPushState(), currentEndpoint()]);
      if (cancelled) return;
      setStatus(s ?? "failed");
      setDevice(state);
      setEndpoint(ep);
      setPhone(isPhone());
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const kind: Kind =
    status === null || phone === null || device === "checking"
      ? "loading"
      : status === "failed" || !status.pushAvailable
        ? "unavailable"
        : phone
          ? "phone"
          : "computer";

  /** From the tap itself: the permission prompt has to come straight from it (see turnOnPush). */
  async function turnOn() {
    if (status === null || status === "failed" || !status.publicKey) return;
    setBusy("on");
    setError(null);
    try {
      const r = await turnOnPush(status.publicKey);
      setDevice(r.state);
      if (r.state !== "on" || !r.endpoint) return;
      setEndpoint(r.endpoint);
      try {
        await sendTestAlert(r.endpoint);
        setTested("sent");
      } catch {
        // On, but the test didn't go: the test screen offers it again.
        setTested("sent");
        setError("Alerts are on, but the test didn't go out. Send another.");
      }
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Couldn't turn alerts on. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function testAgain() {
    const ep = endpoint ?? (await currentEndpoint());
    if (!ep) return;
    setBusy("test");
    setError(null);
    try {
      await sendTestAlert(ep);
      setTested("again");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Couldn't send a test. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function emailLink() {
    setBusy("email");
    setError(null);
    try {
      const res = await fetch("/api/alerts/phone-link", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't send the email. Try again.");
      setEmailedTo(typeof data.to === "string" ? data.to : "your inbox");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Couldn't send the email. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const devices = status && status !== "failed" ? status.devices : 0;
  const emailAvailable = Boolean(status && status !== "failed" && status.emailAvailable);
  return { kind, device, devices, emailAvailable, busy, error, tested, emailedTo, turnOn, testAgain, emailLink, load };
}

/**
 * On a computer: waits for the phone to finish. Turning alerts on there
 * sends a test, so a new device, or a delivery after this screen opened,
 * means it worked. Checks every few seconds while the page is in view.
 */
export function usePhoneFinished(watch: boolean, load: () => Promise<Status | null>): boolean {
  const [done, setDone] = useState(false);
  const start = useRef<{ at: number; devices: number } | null>(null);
  useEffect(() => {
    if (!watch || done) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState === "visible") {
        const s = await load();
        if (s && !stopped) {
          if (!start.current) start.current = { at: Date.now(), devices: s.devices };
          const fresh = s.lastDeliveredAt ? Date.parse(s.lastDeliveredAt) > start.current.at : false;
          if (s.devices > start.current.devices || fresh) {
            setDone(true);
            return;
          }
        }
      }
      timer = setTimeout(tick, 4000);
    };
    tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [watch, done, load]);
  return done;
}

/** What an alert looks like, in the light notification look every message card uses (A-199). */
export function AlertExample({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[20px] border border-line bg-card px-3.5 py-3" style={{ boxShadow: "0 8px 28px rgba(10,10,10,.07)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- the app icon, the same file the alert itself shows (public/sw.js) */}
      <img src="/brand/png/followup-app-icon-256.png" width={38} height={38} alt="" className="shrink-0 rounded-[9px]" />
      <div className="min-w-0 flex-1">
        <div className="flex justify-between text-[13px] text-ink-faint">
          <span>FollowUp</span>
          <span>now</span>
        </div>
        <div className="mt-px text-[15.5px] font-semibold text-ink">{title}</div>
        <div className="mt-px text-[14.5px] leading-[1.38] text-ink-soft">{body}</div>
      </div>
    </div>
  );
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-lg border border-line bg-card px-2 font-medium">
      {icon}
      {children}
    </span>
  );
}

/** The three taps that put FollowUp on an iPhone's Home Screen. Numbered, because the order is the instruction. */
export function IphoneSteps({ compact = false }: { compact?: boolean }) {
  const steps: React.ReactNode[] = [
    <>
      Tap <Chip icon={<Share className="h-[15px] w-[15px]" aria-hidden="true" />}>Share</Chip> at the bottom of Safari. On some iPhones it’s under <b>⋯</b> first.
    </>,
    <>
      Tap <Chip icon={<SquarePlus className="h-[15px] w-[15px]" aria-hidden="true" />}>Add to Home Screen</Chip>, then <b>Add</b>.
    </>,
    <>
      Open FollowUp from your Home Screen. If it asks, sign in again. Then tap <b>Turn on alerts</b>.
    </>,
  ];
  return (
    <ol className={"overflow-hidden rounded-2xl border border-line bg-card" + (compact ? "" : " mt-5")}>
      {steps.map((s, i) => (
        <li key={i} className={"flex items-start gap-3.5 px-4 py-3.5" + (i ? " border-t border-line" : "")}>
          <span
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[13px] font-semibold"
            style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
            aria-hidden="true"
          >
            {i + 1}
          </span>
          <span className={(compact ? "text-[14.5px]" : "text-[15.5px]") + " leading-[1.45] text-ink"}>
            <span className="sr-only">Step {i + 1}: </span>
            {s}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** The code a phone's camera opens: Today on this site, with the alerts card open. */
// Browser-only values read during render, with nothing to subscribe to (the AppWindow pattern).
const noSubscribe = () => () => {};

export function PhoneCode({ size = 150 }: { size?: number }) {
  // This site's own address, so the code works on a preview deployment too.
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => null);
  const modules = useMemo(() => (origin ? encode(origin + ALERTS_SETUP_PATH, { ecc: "M", border: 2 }) : null), [origin]);
  if (!modules) return <div style={{ width: size, height: size }} aria-hidden="true" />;
  const n = modules.size;
  const cells: string[] = [];
  modules.data.forEach((row, y) => row.forEach((on, x) => on && cells.push(`M${x} ${y}h1v1h-1z`)));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} role="img" aria-label="Code to scan with your phone's camera" shapeRendering="crispEdges" className="shrink-0 rounded-lg">
      {/* Always dark on white, in either theme: a camera reads the code by its contrast. */}
      <rect width={n} height={n} fill="#ffffff" />
      <path d={cells.join("")} fill="#0a0a0a" />
    </svg>
  );
}

function Facts() {
  const rows: Array<[React.ReactNode, string]> = [
    [<Bell key="b" className="h-[18px] w-[18px]" aria-hidden="true" />, "One alert per customer, not one per message."],
    [<Moon key="m" className="h-[18px] w-[18px]" aria-hidden="true" />, "Quiet from 10 pm to 7 am."],
    [<Mail key="e" className="h-[18px] w-[18px]" aria-hidden="true" />, "An email too, in case you miss it."],
  ];
  return (
    <ul className="mt-[18px] grid gap-3">
      {rows.map(([icon, text]) => (
        <li key={text} className="flex items-start gap-3 text-[15px] leading-[1.4] text-ink">
          <span className="mt-px text-ink-soft">{icon}</span>
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

const H1 = "title-serif text-[30px] leading-[1.1]";
const LEDE = "mt-2.5 text-[15.5px] leading-relaxed text-ink-soft";
const PRIMARY = "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full px-6 text-base font-medium disabled:opacity-60";
const PRIMARY_STYLE = { backgroundColor: "var(--ink)", color: "var(--on-accent)" } as const;
const QUIET =
  "inline-flex min-h-11 w-full items-center justify-center text-[15px] text-ink-soft underline underline-offset-[3px] transition-colors hover:text-ink disabled:opacity-60";
const EXAMPLE_LABEL = "mt-5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ink-faint";

function ErrorLine({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="mt-3 text-sm" style={{ color: "var(--coral)" }}>
      {text}
    </p>
  );
}

/**
 * Setup's last step. `onDone` leaves for Today, whatever was chosen; it is
 * also called straight away when this server has no alert keys, so nobody
 * is shown a step that can't work.
 */
export function AlertsSetupStep({ onDone }: { onDone: () => void }) {
  const a = useAlertsSetup();
  const phoneDone = usePhoneFinished(a.kind === "computer", a.load);

  useEffect(() => {
    if (a.kind === "unavailable") onDone();
  }, [a.kind, onDone]);

  if (a.kind === "loading" || a.kind === "unavailable") {
    return (
      <div className="flex flex-1 items-center justify-center" aria-busy="true">
        <Loader2 className="h-5 w-5 animate-spin text-ink-faint" aria-label="Loading" />
      </div>
    );
  }

  if (a.kind === "computer") {
    return (
      <div className="flex flex-1 flex-col">
        <h1 className={H1}>Get a buzz on your phone when someone needs you</h1>
        {phoneDone ? (
          <>
            <p className="mt-5 flex items-center gap-2.5 text-[15.5px] text-ink">
              <Check className="h-[18px] w-[18px]" style={{ color: "var(--sage)" }} strokeWidth={2.4} aria-hidden="true" />
              Alerts are on for your phone.
            </p>
            <div className="mt-auto pb-7 pt-6">
              <button onClick={onDone} className={PRIMARY} style={PRIMARY_STYLE}>
                Open Today <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : (
          <>
            <p className={LEDE}>Alerts go to your phone, so they’re turned on there. Point your phone’s camera at this code.</p>
            <div className="mt-5 flex flex-wrap items-center gap-5 rounded-2xl border border-line bg-card p-[18px]">
              <PhoneCode />
              <ol className="grid min-w-[180px] flex-1 list-decimal gap-2.5 pl-[18px] text-[15px] leading-[1.4] text-ink">
                <li>Open your phone’s camera.</li>
                <li>Point it at the code.</li>
                <li>
                  Tap the link, then <b>Turn on alerts</b>.
                </li>
              </ol>
            </div>
            <p className="mt-4 flex items-center gap-2.5 text-[15px] text-ink-soft" aria-live="polite">
              <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin" aria-hidden="true" />
              Waiting for your phone. This page moves on by itself.
            </p>
            {a.emailAvailable &&
              (a.emailedTo ? (
                <p className="mt-2 text-[15px] text-ink" aria-live="polite">
                  Sent to {a.emailedTo}. Open it on your phone.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={a.emailLink}
                  disabled={a.busy === "email"}
                  className="mt-1.5 self-start text-[15px] text-ink-soft underline underline-offset-[3px] hover:text-ink disabled:opacity-60"
                >
                  {a.busy === "email" ? "Sending…" : "Email me the link instead"}
                </button>
              ))}
            <ErrorLine text={a.error} />
            <div className="mt-auto pb-7 pt-6">
              <button type="button" onClick={onDone} className={QUIET}>
                Not now
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // A phone.
  if (a.device === "needs-home-screen") {
    return (
      <div className="flex flex-1 flex-col">
        <h1 className={H1}>Get a buzz when someone needs you</h1>
        <p className={LEDE}>On iPhone, FollowUp needs to be on your Home Screen first. Three taps.</p>
        <IphoneSteps />
        <p className="mt-3.5 text-sm leading-normal text-ink-soft">Apple only lets apps on the Home Screen send alerts. It’s the same FollowUp, with its own icon.</p>
        <div className="mt-auto pb-7 pt-6">
          <button type="button" onClick={onDone} className={QUIET}>
            {a.emailAvailable ? "Just email me for now" : "Not now"}
          </button>
        </div>
      </div>
    );
  }

  if (a.device === "on") {
    return (
      <div className="flex flex-1 flex-col">
        <h1 className={H1}>{a.tested ? "Did your phone buzz?" : "Alerts are on for this phone"}</h1>
        <p className={LEDE}>{a.tested ? "We just sent you a test. It looks like this." : "When a customer needs you, your phone tells you."}</p>
        <p className={EXAMPLE_LABEL}>{a.tested ? "The test" : "What you’d see · example"}</p>
        <div className="mt-2">
          {a.tested ? (
            <AlertExample title="Alerts are on" body="This is how you’ll hear when a customer needs you." />
          ) : (
            <AlertExample title="Ivy is waiting" body="Hi, I saw the 2-bed on King St. Is parking included with the unit?" />
          )}
        </div>
        {a.tested === "again" && (
          <p className="mt-4 text-[15px] leading-normal text-ink-soft" aria-live="polite">
            Sent again. If nothing comes, check that Focus or Do Not Disturb is off.
          </p>
        )}
        <ErrorLine text={a.error} />
        <div className="mt-auto pb-7 pt-6">
          <button onClick={onDone} className={PRIMARY} style={PRIMARY_STYLE}>
            {a.tested ? "Yes, it buzzed" : "Open Today"} <ArrowRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={a.testAgain} disabled={a.busy === "test"} className={QUIET}>
            {a.busy === "test" ? "Sending…" : a.tested ? "No buzz? Send another test" : "Send a test"}
          </button>
        </div>
      </div>
    );
  }

  if (a.device === "blocked" || a.device === "unsupported") {
    return (
      <div className="flex flex-1 flex-col">
        <h1 className={H1}>Get a buzz when someone needs you</h1>
        <p className={LEDE}>
          {a.device === "blocked"
            ? "Alerts are blocked for FollowUp on this phone. To turn them on, allow notifications for FollowUp in your phone’s settings, then open Settings › Alerts here."
            : "This browser can’t show alerts. Open FollowUp in Safari or Chrome to turn them on."}
          {a.emailAvailable ? " Until then, we’ll email you." : ""}
        </p>
        <div className="mt-auto pb-7 pt-6">
          <button onClick={onDone} className={PRIMARY} style={PRIMARY_STYLE}>
            Open Today <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <h1 className={H1}>Get a buzz when someone needs you</h1>
      <p className={LEDE}>When a customer is waiting for you, your phone tells you. Tap it, check the reply, and send.</p>
      <p className={EXAMPLE_LABEL}>What you’d see · example</p>
      <div className="mt-2">
        <AlertExample title="Ivy is waiting" body="Hi, I saw the 2-bed on King St. Is parking included with the unit?" />
      </div>
      <Facts />
      <ErrorLine text={a.error} />
      <div className="mt-auto pb-7 pt-6">
        <button onClick={a.turnOn} disabled={a.busy === "on"} className={PRIMARY} style={PRIMARY_STYLE}>
          {a.busy === "on" ? "Turning on…" : "Turn on alerts"}
        </button>
        <button type="button" onClick={onDone} className={QUIET}>
          Not now
        </button>
      </div>
    </div>
  );
}

// "Not now" on Today's card, per device: alerts are per device, so a no on
// the computer must not hide the card on the phone. It comes back once,
// two weeks later (founder's call to change; recorded in A-216).
const NOT_NOW_KEY = "followup.alertsCard.notNowUntil";
const NOT_NOW_MS = 14 * 24 * 60 * 60 * 1000;

function notNowActive(): boolean {
  try {
    const until = Number(window.localStorage.getItem(NOT_NOW_KEY) ?? 0);
    return until > Date.now();
  } catch {
    return false;
  }
}

/**
 * Today's card for owners who set up before alerts were part of setup.
 * `open` comes from the link the computer hands over (?alerts=on): it shows
 * the card even after a "Not now".
 */
export function AlertsCard({ open = false }: { open?: boolean }) {
  const a = useAlertsSetup();
  const phoneDone = usePhoneFinished(a.kind === "computer" && a.devices === 0, a.load);
  // Hidden on the server and until the browser has said otherwise.
  const saidNotNow = useSyncExternalStore(noSubscribe, notNowActive, () => true);
  const [dismissed, setDismissed] = useState(false);
  const [handOver, setHandOver] = useState(false);

  function notNow() {
    try {
      window.localStorage.setItem(NOT_NOW_KEY, String(Date.now() + NOT_NOW_MS));
    } catch {
      // Private mode: it hides for this visit only.
    }
    setDismissed(true);
  }

  if (dismissed || (saidNotNow && !open) || a.kind === "loading" || a.kind === "unavailable") return null;

  // Just turned on here: say it worked, and offer the test again.
  const justOn = a.kind === "phone" && a.device === "on" && a.tested !== null;
  if (a.kind === "phone" && !justOn && a.device !== "off" && a.device !== "needs-home-screen") return null;
  // A computer shows the card only while no phone has alerts yet.
  if (a.kind === "computer" && a.devices > 0 && !phoneDone) return null;

  const done = justOn || phoneDone;
  return (
    <section aria-label="Alerts" className="mt-5 grid gap-2.5 rounded-2xl border border-line bg-card px-[18px] py-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card-2 text-ink" aria-hidden="true">
          {done ? <Check className="h-[18px] w-[18px]" style={{ color: "var(--sage)" }} strokeWidth={2.4} /> : <Bell className="h-[18px] w-[18px]" />}
        </span>
        <div className="min-w-0">
          <p className="text-base font-semibold leading-[1.3] text-ink">
            {done
              ? phoneDone
                ? "Alerts are on for your phone"
                : "Alerts are on. Did it buzz?"
              : a.kind === "computer"
                ? "Get a buzz on your phone when someone needs you"
                : "Get a buzz when someone needs you"}
          </p>
          <p className="mt-[3px] text-[14.5px] leading-[1.45] text-ink-soft" aria-live="polite">
            {done
              ? phoneDone
                ? "Next time a customer needs you, your phone tells you."
                : a.tested === "again"
                  ? "Sent again. If nothing comes, check that Focus or Do Not Disturb is off."
                  : "We just sent a test to this phone."
              : a.kind === "phone" && a.device === "needs-home-screen"
                ? "On iPhone, FollowUp needs to be on your Home Screen first. Three taps:"
                : "Next time a customer writes, your phone tells you, and you can answer in a minute."}
          </p>
        </div>
      </div>

      {/* Full width on a phone: indented, the chips wrapped mid-word at 390px. */}
      {a.kind === "phone" && a.device === "needs-home-screen" && (
        <div className="sm:pl-12">
          <IphoneSteps compact />
        </div>
      )}

      {a.kind === "computer" && handOver && !done && (
        <div className="flex flex-wrap items-center gap-4 pl-12">
          <PhoneCode size={132} />
          <div className="grid min-w-[180px] flex-1 gap-1.5 text-[14.5px] leading-[1.45] text-ink">
            <p>Point your phone’s camera at the code, tap the link, then Turn on alerts.</p>
            <p className="flex items-center gap-2 text-ink-soft">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
              Waiting for your phone.
            </p>
            {a.emailAvailable &&
              (a.emailedTo ? (
                <p>Sent to {a.emailedTo}. Open it on your phone.</p>
              ) : (
                <button type="button" onClick={a.emailLink} disabled={a.busy === "email"} className="justify-self-start text-ink-soft underline underline-offset-[3px] hover:text-ink disabled:opacity-60">
                  {a.busy === "email" ? "Sending…" : "Email me the link instead"}
                </button>
              ))}
          </div>
        </div>
      )}

      {a.error && (
        <p role="alert" className="pl-12 text-[13.5px]" style={{ color: "var(--coral)" }}>
          {a.error}
        </p>
      )}

      {/* Outlined, never black: Send is the one black button on Today (A-006). */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-12">
        {done ? (
          justOn && (
            <button type="button" onClick={a.testAgain} disabled={a.busy === "test"} className="min-h-10 text-[14.5px] text-ink-soft underline underline-offset-[3px] hover:text-ink disabled:opacity-60">
              {a.busy === "test" ? "Sending…" : "No buzz? Send another test"}
            </button>
          )
        ) : (
          <>
            {a.kind === "phone" && a.device === "off" && (
              <button type="button" onClick={a.turnOn} disabled={a.busy === "on"} className="min-h-10 rounded-full border border-ink bg-card px-4 text-[14.5px] font-medium text-ink disabled:opacity-60">
                {a.busy === "on" ? "Turning on…" : "Turn on alerts"}
              </button>
            )}
            {a.kind === "computer" && !handOver && (
              <button type="button" onClick={() => setHandOver(true)} className="min-h-10 rounded-full border border-ink bg-card px-4 text-[14.5px] font-medium text-ink">
                Set up on my phone
              </button>
            )}
            <button type="button" onClick={notNow} className="min-h-10 text-[14.5px] text-ink-soft hover:text-ink">
              Not now
            </button>
          </>
        )}
      </div>
    </section>
  );
}
