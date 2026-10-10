"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import LogoMark from "@/components/LogoMark";
import ImproveFollowUpToggle from "@/components/ImproveFollowUpToggle";
import { WARM_CARD } from "@/components/app/ReplyCard";
import { INDUSTRIES, INDUSTRY_SHORT } from "@/lib/industries";
import { useUndoableSend } from "@/components/useUndoableSend";
import UndoLine from "@/components/UndoLine";
import { safeBannerText } from "@/lib/bannerText";
import { AlertsSetupStep } from "@/components/app/AlertsSetup";

/** The one full-width black button at the foot of each setup step. */
const PRIMARY =
  "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full px-6 text-base font-medium disabled:opacity-60";
const PRIMARY_STYLE = { backgroundColor: "var(--ink)", color: "var(--on-accent)" } as const;
const H1 = "text-[30px] leading-[1.1] tracking-[-0.025em]";
const LEDE = "mt-2.5 text-[15.5px] leading-relaxed text-ink-soft";

/**
 * Four steps (A-081, Gmail first, founder 2026-10-04): connect Gmail, choose
 * how FollowUp should work while it reads the inbox, then the customers who
 * were already waiting, then (A-216, 2026-10-10) a buzz on the owner's phone
 * when a customer needs them, with a real test. Setup is marked finished
 * before that last step; leaving it, whatever was chosen, opens Today.
 *
 * ## What this replaces, and why
 *
 * It was five screens: a details form, an explainer, a list of every
 * source, the Automatic/Assisted choice, and the waiting customers. The
 * founder's Gmail-only decision (research:
 * `research/customers/2026-10-04-gmail-only-why-they-would-use-it.md`) made
 * the source list a single button, the landing page took over the
 * explainer, and the details form left: the business name comes from the
 * Google account at sign-in (auth.ts), and the trade is asked on Today
 * only when it is missing (setupStatus.ts, the "Add details" step), which
 * is also where the drafting falls back to a trade-neutral read
 * (isUnknownTrade). The other channels stay in Settings, not promoted.
 *
 * ## Resume is derived, not stored
 *
 * The Connect button leaves the app, and the trip back is a fresh page
 * load with no client state. A connected inbox means step 2; a failed
 * connect (`?gmail=error`) stays on step 1 with the provider's message.
 */

export interface OnboardingSourceState {
  gmailConnected: boolean;
  outlookConnected: boolean;
  outlookAvailable: boolean;
  inboxEmail?: string;
  inboxProvider: "gmail" | "outlook" | null;
}

interface OnboardingFormProps {
  sources: OnboardingSourceState;
}

// Wrapped in Suspense because the inner component reads useSearchParams()
// (for the connected/error round trips) — same pattern Settings uses.
export default function OnboardingForm(props: OnboardingFormProps) {
  return (
    <Suspense fallback={null}>
      <OnboardingFormInner {...props} />
    </Suspense>
  );
}

type Step = 1 | 2 | 3 | 4;

function OnboardingFormInner({ sources }: OnboardingFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const inboxConnected = sources.gmailConnected || sources.outlookConnected;
  const [step, setStep] = useState<Step>(inboxConnected ? 2 : 1);
  const [finishing, setFinishing] = useState(false);

  // Fires once, right when a connected inbox first renders — pulls the
  // first batch of leads in immediately rather than leaving Today empty
  // until someone finds "Sync now" in Settings later. Silent on failure
  // (most commonly: no active subscription yet, which every brand-new
  // signup lacks) — a setup screen is the wrong place to surprise someone
  // with a billing wall. Step 2 says it is reading; step 3 waits for it.
  const [autoSyncState, setAutoSyncState] = useState<"idle" | "syncing" | "done">("idle");
  const autoSyncStarted = useRef(false);

  useEffect(() => {
    if (!inboxConnected || !sources.inboxProvider || autoSyncStarted.current) return;
    autoSyncStarted.current = true;
    setAutoSyncState("syncing");
    fetch(`/api/integrations/${sources.inboxProvider}/sync`, { method: "POST" })
      .catch(() => {
        // Silent — see above.
      })
      .finally(() => setAutoSyncState("done"));
  }, [inboxConnected, sources.inboxProvider]);

  /** Whatever the provider said on the way back. */
  const errorFor = (key: string) =>
    searchParams.get(key) === "error" ? safeBannerText(searchParams.get("message"), `Couldn't connect ${key}.`) : null;
  const inboxError = errorFor("gmail") ?? errorFor("outlook");

  /**
   * Finish. The website form is not offered here any more (Gmail first),
   * so its step on Today is marked "I don't use this" on the way out, as
   * an untouched source always was: Settings carries every source
   * permanently, and asking again on Today would be the nag the founder
   * ruled out (2026-09-21). Best-effort: if it fails, the owner still
   * finishes and the worst case is a step on Today they can dismiss.
   */
  async function finishOnboarding() {
    setFinishing(true);

    await fetch("/api/business/setup-step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "widget", dismissed: true }),
    }).catch(() => undefined);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finish: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't finish — try again.");
      // Setup is finished here, before the alerts step, so an iPhone
      // opened from the Home Screen in the middle of that step lands on
      // Today rather than back in setup. Then the alerts step (A-216);
      // still no questions before FollowUp has shown it is useful (R-027).
      setStep(4);
      setFinishing(false);
    } catch {
      // Rare (a DB hiccup) — let them press again rather than stranding
      // them on a dead click.
      setFinishing(false);
    }
  }

  // Leaving setup for Today, from the alerts step: whatever was chosen there.
  const openToday = useCallback(() => {
    router.push("/dashboard");
    router.refresh();
  }, [router]);

  return (
    // As the Gmail-first board draws setup (prototypes/2026-10-04-gmail-first.html,
    // #setup): the mark on the left, "Step N of 4" on the right, four bars,
    // a left-aligned title and one black button at the foot.
    <div className="min-h-[100dvh] bg-paper">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col px-5">
        <header className="flex h-[60px] shrink-0 items-center justify-between">
          <span className="flex items-center gap-2">
            <LogoMark height={22} />
            <span className="text-base font-semibold">FollowUp</span>
          </span>
          <span className="flex items-center gap-2.5">
            {/* A head start (A-088, Nunes & Drèze): name the step already done, not only the ones left. */}
            {step >= 2 && inboxConnected && (
              <span className="flex items-center gap-1.5 whitespace-nowrap text-[12.5px] text-ink">
                <Check className="h-3.5 w-3.5" style={{ color: "var(--sage)" }} aria-hidden="true" />
                {sources.gmailConnected ? "Gmail" : "Outlook"} connected
                <span className="hidden text-ink-faint sm:inline">·</span>
              </span>
            )}
            {/* On a phone the bars say the step once the head start is shown; the words would wrap. */}
            <span className={"whitespace-nowrap text-[12.5px] text-ink-faint" + (step >= 2 && inboxConnected ? " hidden sm:inline" : "")}>Step {step} of 4</span>
            {/* Ink, not the accent: the screen's one accent moment is its button (A-006). */}
            <span className="flex gap-1" aria-hidden="true">
              {([1, 2, 3, 4] as const).map((n) => (
                <span
                  key={n}
                  className="h-[3px] w-[18px] rounded-full"
                  style={{ backgroundColor: step >= n ? "var(--ink)" : "var(--line)" }}
                />
              ))}
            </span>
          </span>
        </header>

        <main className="flex flex-1 flex-col pt-5">
          {step === 1 && <ConnectGmail outlookAvailable={sources.outlookAvailable} error={inboxError} />}
          {step === 2 && <HowItShouldWork reading={autoSyncState === "syncing"} onChosen={() => setStep(3)} />}
          {step === 3 && <WaitingCustomers syncDone={autoSyncState !== "syncing"} onDone={finishOnboarding} finishing={finishing} />}
          {step === 4 && <AlertsSetupStep onDone={openToday} />}
        </main>
      </div>
    </div>
  );
}

/**
 * Step 1 — connect Gmail. What it reads and what it never does, in four
 * lines, because this screen asks for the inbox at the moment it has to be
 * exactly true (the old explainer's rule). Outlook is the quiet way in.
 * No AI language anywhere on this screen, deliberately (S-13).
 */
function ConnectGmail({ outlookAvailable, error }: { outlookAvailable: boolean; error: string | null }) {
  const lines: Array<{ ok: boolean; text: string }> = [
    { ok: true, text: "Reads emails from customers, and your replies to them" },
    { ok: true, text: "Puts booked calls on your calendar" },
    { ok: false, text: "Never sends anything without your OK, unless you turn that on" },
    { ok: false, text: "Never reads newsletters, receipts or personal mail" },
  ];
  return (
    <div className="flex flex-1 flex-col">
      <h1 className={H1}>Connect your Gmail</h1>
      <p className={LEDE}>FollowUp reads the emails from customers, writes the replies in your words, and sends from your own address.</p>

      <ul className="mt-[18px] overflow-hidden rounded-[14px] border border-line bg-card">
        {lines.map((l, i) => (
          <li key={l.text} className={"flex gap-3 px-4 py-3 text-[14.5px] leading-snug" + (i ? " border-t border-line-2" : "")}>
            <span aria-hidden="true" className="w-4 shrink-0" style={{ color: l.ok ? "var(--sage)" : "var(--ink-faint)" }}>
              {l.ok ? "✓" : "✕"}
            </span>
            <span>{l.text}</span>
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="mt-3 text-sm" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}

      <div className="mt-auto pb-7 pt-6">
        <a href="/api/integrations/gmail/connect?next=onboarding" className={PRIMARY} style={PRIMARY_STYLE}>
          Connect Gmail
          <ArrowRight className="h-4 w-4" />
        </a>
        {outlookAvailable && (
          <a
            href="/api/integrations/outlook/connect?next=onboarding"
            className="mt-1 inline-flex min-h-11 w-full items-center justify-center text-[15px] text-ink-soft underline underline-offset-[3px] transition-colors hover:text-ink"
          >
            I use Outlook
          </a>
        )}
        <p className="mt-2 text-center text-[13px] leading-relaxed text-ink-faint">You can disconnect any time in Settings. Access ends the moment you do.</p>
      </div>
    </div>
  );
}
/**
 * Step 4 — how FollowUp should work (founder, 2026-09-26: "in onboarding,
 * it will be asking the user whether they want the follow-up to follow up
 * automatically or they want the assisted ones").
 *
 * Automatic grants the same permission as Settings → Automation
 * (`autoSendPermission: true` on /api/automation/settings), which stamps
 * autoSendAllowedAt: everything already waiting stays waiting, and only
 * conversations from now on go out by themselves. Assisted changes nothing
 * — every account already holds by default — so choosing it writes nothing
 * and can never fail.
 *
 * Automatic is marked recommended: an owner with more customers than time
 * is who FollowUp is for, and a queue they must approve by hand is the
 * thing they couldn't keep up with in the first place. But Assisted is the
 * default, on every plan (founder, 2026-09-27: "Assisted should be the
 * default but we will be asking them on onboarding what they prefer and
 * they can change it anytime"), so it starts chosen: sending on its own is
 * asked for, never assumed (2026-09-22). Pressing the only button on the
 * screen can no longer switch automatic sending on unread.
 */
function HowItShouldWork({ reading, onChosen }: { reading: boolean; onChosen: () => void }) {
  const [mode, setMode] = useState<"automatic" | "assisted" | null>("assisted");
  const [trade, setTrade] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose() {
    setError(null);
    if (!mode || !trade) return;
    // What they do (founder, 2026-10-04): it decides who counts as a
    // customer and which playbook the replies follow. Best effort: a
    // failed save never blocks setup, and Settings asks again if it's missing.
    await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ industry: trade }),
    }).catch(() => {});
    if (mode === "assisted") {
      onChosen();
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/automation/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoSendPermission: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't turn Automatic on. Try again, or choose Assisted for now.");
      onChosen();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't turn Automatic on. Try again, or choose Assisted for now.");
      setSaving(false);
    }
  }

  const options = [
    {
      id: "automatic" as const,
      title: "Automatic",
      badge: "Recommended",
      body: "It answers and follows up on its own. Prices, dates and tricky moments come to you.",
    },
    {
      id: "assisted" as const,
      title: "Assisted",
      badge: null,
      body: "Every reply waits for you. If a price question sits 30 minutes, the customer gets a short “let me check”; the answer still waits for you.",
    },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <h1 className={H1}>How should FollowUp work?</h1>
      <p className={LEDE + (reading ? " flex items-center gap-2" : "")}>
        {reading && <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />}
        {reading ? "It's reading your inbox now. Two quick choices; change them any time." : "Two quick choices; change them any time in Settings."}
      </p>

      {/* What they do: one tap, asked while the inbox is read. */}
      <div className="mt-[22px]">
        <p id="trade-label" className="text-[15px] font-medium">What do you do?</p>
        <div role="radiogroup" aria-labelledby="trade-label" className="mt-2.5 flex flex-wrap gap-2">
          {INDUSTRIES.map((i) => {
            const on = trade === i;
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setTrade(i)}
                className="min-h-10 rounded-full border px-3.5 text-[14.5px] transition-colors"
                style={{
                  borderColor: on ? "var(--ink)" : "var(--line)",
                  background: on ? "var(--ink)" : "var(--card)",
                  color: on ? "var(--paper)" : "var(--ink)",
                  fontWeight: on ? 500 : 400,
                }}
              >
                {INDUSTRY_SHORT[i]}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-6 text-[15px] font-medium">How should it reply?</p>
      <div role="radiogroup" aria-label="How FollowUp works" className="mt-2.5 flex flex-col gap-3">
        {options.map((o) => {
          const on = mode === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setMode(o.id)}
              className="w-full rounded-[20px] border border-line bg-card p-[18px] text-left transition-colors"
              // The ring is a border plus a 1px inset shadow rather than a
              // 2px border, so choosing a card never shifts its contents.
              style={on ? { borderColor: "var(--ink)", boxShadow: "inset 0 0 0 1px var(--ink)" } : undefined}
            >
              <span className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full"
                  style={{ border: `${on ? 2 : 1.5}px solid ${on ? "var(--ink)" : "var(--line)"}` }}
                >
                  {on && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--ink)" }} />}
                </span>
                <span className="text-lg" style={{ fontWeight: on ? 600 : 500 }}>{o.title}</span>
                {o.badge && (
                  <span className="ml-auto font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-ink-soft">{o.badge}</span>
                )}
              </span>
              <span className="mt-2.5 block pl-[34px] text-[15px] leading-relaxed text-ink-soft">{o.body}</span>
              {/* One example of what Automatic sends, marked as an example (OnbChoose). */}
              {o.id === "automatic" && on && (
                <span className="mt-3.5 ml-[34px] block rounded-[14px] px-3.5 py-3" style={WARM_CARD}>
                  <span className="block font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ink-soft">Sent on its own · example</span>
                  <span className="mt-1 block text-sm leading-snug">Thanks! Happy to quote that. Could you send a photo of your current tap?</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-[18px] flex items-start gap-2 text-sm leading-relaxed text-ink-soft">
        <Check className="mt-0.5 h-[15px] w-[15px] shrink-0 text-ink" strokeWidth={2.2} aria-hidden="true" />
        <span>Either way, it stops the moment they reply, and every message goes from your own Gmail.</span>
      </p>

      {/* Asked once, here, where the owner has just connected an inbox —
          not buried in Settings they may never open. Off by default; the
          switch is the consent (docs/security-roadmap.md). */}
      <div className="mt-4 rounded-[18px] border border-line bg-card px-4 py-3">
        <ImproveFollowUpToggle compact />
      </div>

      {error && (
        <p role="alert" className="text-sm mt-3" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}

      <div className="mt-auto pb-7 pt-6">
      {(!mode || !trade) && (
        <p className="mb-2.5 text-center text-[13.5px] text-ink-faint">{!trade ? "Choose what you do to continue." : "Choose one to continue."}</p>
      )}
      <button onClick={choose} disabled={saving || !mode || !trade} className={PRIMARY + " disabled:opacity-50"} style={PRIMARY_STYLE}>
        {/* A-053's curiosity action: the next screen is the list of who never got a reply. */}
        {saving ? "Saving…" : "Find who needs a reply"}
        {!saving && <ArrowRight className="h-4 w-4" />}
      </button>
      </div>
    </div>
  );
}

type WaitingSummary = {
  safe: number;
  needsYou: number;
  preview: Array<{ leadId: string; leadName: string; theirMessage: string | null; draftMessage: string }>;
};

/**
 * Step 5 — the customers who were already waiting (founder, 2026-09-26:
 * "new ones automatic, old ones ask with one tap").
 *
 * Nothing here is sent on its own, on either choice: FollowUp writes a
 * reply for each and the owner sends the routine ones with one tap. The
 * list and the button both come from the approval queue, with the same
 * definition of "routine" (isSafeToSendInBulk). A price or a date among
 * them is never in the batch; it waits in Today with its reply written.
 *
 * Every person the button will write to is on screen: each opens to show
 * its reply and can be skipped, and the button sends exactly the people
 * shown and not skipped (`only`), after the same 10-second undo Today
 * gives (PRODUCT_DIRECTION: "the owner can also open and skip any of
 * them"; strategy audit 2026-09-27). Anyone past the list waits in Today
 * and is never sent unseen.
 *
 * The replies are written on arrival here (one run of the automation for
 * this business), rather than on the next hourly tick — the founder's
 * "first replies are written right after connecting" decision. On a quiet
 * account, or if writing them fails, the screen says so and moves on:
 * nobody should be stuck at the end of setup.
 */
function WaitingCustomers({ syncDone, onDone, finishing }: { syncDone: boolean; onDone: () => void; finishing: boolean }) {
  const [state, setState] = useState<"loading" | "ready">("loading");
  const [summary, setSummary] = useState<WaitingSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const started = useRef(false);

  const chosen = (summary?.preview ?? []).map((p) => p.leadId).filter((id) => !skipped.has(id));
  const send = useUndoableSend({
    url: "/api/approvals/send-safe",
    body: JSON.stringify({ only: chosen }),
    onResponse: async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(typeof data.message === "string" ? data.message : "Couldn't send them. They're waiting in Today.");
        return;
      }
      // Nothing went out at all (commonly: the inbox they came from isn't
      // connected any more). Say so here rather than moving on as though
      // they had been sent; a partial send moves on, and Today shows the rest.
      const refused: Array<{ reason: string }> = Array.isArray(data.skipped) ? data.skipped : [];
      if (data.sent === 0 && refused.length > 0) {
        setError(`None of them went out: ${refused[0].reason} They're waiting in Today.`);
        return;
      }
      onDone();
    },
    onNetworkError: () => setError("Couldn't reach FollowUp. They're waiting in Today."),
  });

  useEffect(() => {
    // A big inbox is still being read when the owner arrives here (the
    // sync started on step 2). Wait for it, so the list below is the whole
    // picture rather than the first few; the screen says so meanwhile.
    if (!syncDone || started.current) return;
    started.current = true;
    (async () => {
      // Best effort: a failed or slow run leaves whatever is already
      // queued, which the summary below reports truthfully.
      await fetch("/api/automation/run", { method: "POST" }).catch(() => undefined);
      try {
        const res = await fetch("/api/approvals/summary");
        const data = await res.json();
        if (res.ok && data.success) {
        const preview: WaitingSummary["preview"] = data.preview ?? [];
        setSummary({ safe: data.safe, needsYou: data.needsYou, preview });
        setOpenId(preview[0]?.leadId ?? null);
      }
      } catch {
        // Falls through to the empty state.
      }
      setState("ready");
    })();
  }, [syncDone]);

  if (state === "loading") {
    return (
      <div className="flex flex-1 flex-col">
        <h1 className={H1}>{syncDone ? "Finding who’s waiting on a reply…" : "Still reading your inbox…"}</h1>
        <p className={LEDE + " flex items-center gap-2"}>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {syncDone ? "Reading the last 90 days. Nothing is sent." : "A big inbox takes a minute. Nothing is sent."}
        </p>
      </div>
    );
  }

  const safe = summary?.safe ?? 0;
  const needsYou = summary?.needsYou ?? 0;

  if (safe === 0) {
    return (
      <div className="flex flex-1 flex-col">
        <h1 className={H1}>{needsYou > 0 ? "A few people need you." : "No one is waiting."}</h1>
        <p className={LEDE}>
          {needsYou > 0
            ? `${needsYou} ${needsYou === 1 ? "customer asks" : "customers ask"} about a price, a date or something that needs your eye. ${needsYou === 1 ? "It waits" : "They wait"} for you in Today, with the reply written.`
            : "Anyone who writes from now on gets an answer. You'll see everything in Today."}
        </p>
        <div className="mt-auto pb-7 pt-6">
          <button onClick={onDone} disabled={finishing} className={PRIMARY} style={PRIMARY_STYLE}>
            {/* One more step after this one (alerts, A-216), so not "Go to Today". */}
            {finishing ? "One moment…" : "Continue"}
          </button>
        </div>
      </div>
    );
  }

  // As OnbOldCustomers: everyone who never got a reply, each with its
  // written reply a tap away (the first open), and a Skip on each. The
  // price questions are named once; they are never in this batch.
  const total = safe + needsYou;
  const preview = summary?.preview ?? [];
  const hidden = safe - preview.length;
  const count = chosen.length;

  return (
    <div className="flex flex-1 flex-col">
      <h1 className={H1}>
        {total} {total === 1 ? "person" : "people"} never got a reply.
      </h1>
      <p className={LEDE}>From the last 90 days. A reply is written for each. Nothing has been sent. Open any to read it, or skip it.</p>

      <div className="mt-[18px] overflow-hidden rounded-[20px] border border-line bg-card">
        <p className="px-4 pb-2.5 pt-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-ink-faint">
          Ready to send · {count}
        </p>
        {preview.map((p, i) => {
          const isSkipped = skipped.has(p.leadId);
          const isOpen = openId === p.leadId && !isSkipped;
          return (
            <div key={p.leadId} className={(i ? "border-t border-line-2 " : "") + "px-4 py-3"}>
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : p.leadId)}
                  disabled={isSkipped || send.pending}
                  aria-expanded={isOpen}
                  className="min-w-0 flex-1 text-left disabled:cursor-default"
                >
                  <span className={"block text-[15px] font-medium " + (isSkipped ? "text-ink-faint line-through" : "")}>{p.leadName}</span>
                  {p.theirMessage && <span className="mt-0.5 block line-clamp-1 text-[13.5px] text-ink-soft">“{p.theirMessage}”</span>}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSkipped((prev) => {
                      const next = new Set(prev);
                      if (next.has(p.leadId)) next.delete(p.leadId);
                      else next.add(p.leadId);
                      return next;
                    })
                  }
                  disabled={send.pending}
                  className="min-h-11 shrink-0 px-1 text-[14px] text-ink-soft underline underline-offset-2 hover:text-ink disabled:opacity-50"
                >
                  {isSkipped ? "Undo skip" : "Skip"}
                </button>
              </div>
              {isOpen && (
                <p className="mt-2 whitespace-pre-wrap rounded-[14px] px-3.5 py-3 text-sm leading-snug" style={WARM_CARD}>
                  {p.draftMessage}
                </p>
              )}
              {isSkipped && <p className="mt-0.5 text-[13px] text-ink-faint">Not sent. It waits in Today.</p>}
            </div>
          );
        })}
        {hidden > 0 && (
          <p className="border-t border-line-2 px-4 py-3 text-sm text-ink-soft">
            {hidden} more {hidden === 1 ? "waits" : "wait"} in Today. {hidden === 1 ? "It isn't" : "They aren't"} in this send.
          </p>
        )}
      </div>

      {needsYou > 0 && (
        <p className="mt-2.5 flex items-start gap-2.5 rounded-2xl border border-line bg-card px-3.5 py-3 text-sm leading-relaxed">
          <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: "var(--coral)" }} />
          <span>
            <span className="font-medium">
              {needsYou} {needsYou === 1 ? "needs" : "need"} you.
            </span>
            <span className="text-ink-soft"> A price, a date or something tricky. {needsYou === 1 ? "It waits" : "They wait"} in Today, reply written.</span>
          </span>
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}

      <div className="mt-auto pb-6 pt-6">
        {send.pending ? (
          // The same 10 seconds Today gives (A-048): the button becomes the
          // way to take the press back, and the line drains.
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[15px]">
                Sending to {count} in {send.secs}s
              </p>
              <button type="button" onClick={send.undo} className="h-11 rounded-full border border-line bg-card px-5 text-[15px] font-medium">
                Undo
              </button>
            </div>
            {send.endsAt !== null && (
              <div className="mt-2.5">
                <UndoLine endsAt={send.endsAt} />
              </div>
            )}
          </div>
        ) : (
          <>
            {send.cancelled && <p className="mb-2 text-center text-[13.5px] text-ink-soft">Stopped. Nothing was sent.</p>}
            <button
              onClick={() => {
                setError(null);
                send.start();
              }}
              disabled={send.busy || finishing || count === 0}
              className={PRIMARY + " disabled:opacity-50"}
              style={PRIMARY_STYLE}
            >
              {send.busy ? "Sending…" : count === 0 ? "Nothing to send" : `Send ${count === 1 ? "it" : `all ${count}`}`}
            </button>
            <button
              onClick={onDone}
              disabled={send.busy || finishing}
              className="mt-1 inline-flex min-h-11 w-full items-center justify-center text-[15px] text-ink-soft transition-colors hover:text-ink"
            >
              Not now, keep them in Today
            </button>
          </>
        )}
      </div>
    </div>
  );
}
