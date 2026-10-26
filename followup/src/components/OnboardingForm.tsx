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
import CrmConfig from "@/components/CrmConfig";
import { GROUP, ListRow } from "@/components/app/IosList";
import { GlyphTile } from "@/components/settings/connectionBits";
import { BrandTile } from "@/components/brandLogos";

/** The one full-width black button at the foot of each setup step. */
const PRIMARY =
  "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full px-6 text-base font-medium disabled:opacity-60";
const PRIMARY_STYLE = { backgroundColor: "var(--ink)", color: "var(--on-accent)" } as const;
const H1 = "title-serif ios-title1";
const LEDE = "mt-2.5 text-[15.5px] leading-relaxed text-ink-soft";

/**
 * Four steps: connect Instagram or Gmail (A-241, 2026-10-13; it was Gmail
 * alone, A-081, 2026-10-04), choose
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
 * load with no client state. A connected inbox or Instagram account means
 * step 2; a failed connect (`?gmail=error`, `?instagram=error`) stays on
 * step 1 with the provider's message.
 */

export interface OnboardingSourceState {
  gmailConnected: boolean;
  outlookConnected: boolean;
  outlookAvailable: boolean;
  inboxEmail?: string;
  inboxProvider: "gmail" | "outlook" | null;
  /** A professional Instagram account connected with a token (A-241). */
  instagramConnected: boolean;
  /** Instagram sign-in is configured for this deployment. */
  instagramAvailable: boolean;
  /** The connected CRM's name, or null (A-272). */
  crmName: string | null;
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
  // Either way in counts as connected (A-241): an owner who runs on
  // Instagram DMs has no inbox to connect and must not be sent back to step 1.
  // A CRM counts too (A-272): an owner on GoHighLevel alone has everything coming in through it.
  const [crmName, setCrmName] = useState<string | null>(sources.crmName);
  const connected = inboxConnected || sources.instagramConnected || crmName !== null;
  const connectedName = sources.gmailConnected ? "Gmail" : sources.outlookConnected ? "Outlook" : sources.instagramConnected ? "Instagram" : (crmName ?? "");
  const [step, setStep] = useState<Step>(connected ? 2 : 1);
  // Step 1's screen (A-272): the CRM question; after GoHighLevel connects, its auto-reply off (A-301); after a CRM,
  // what it doesn't get; with no CRM, the apps.
  const [first, setFirst] = useState<"crm" | "autoreply" | "suggest" | "apps">("crm");
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
  const connectError = errorFor("gmail") ?? errorFor("outlook") ?? errorFor("instagram");

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
            {step >= 2 && connected && (
              <span className="flex items-center gap-1.5 whitespace-nowrap text-[12.5px] text-ink">
                <Check className="h-3.5 w-3.5" style={{ color: "var(--sage)" }} aria-hidden="true" />
                {connectedName} connected
                <span className="hidden text-ink-faint sm:inline">·</span>
              </span>
            )}
            {/* On a phone the bars say the step once the head start is shown; the words would wrap. */}
            <span className={"whitespace-nowrap text-[12.5px] text-ink-faint" + (step >= 2 && connected ? " hidden sm:inline" : "")}>Step {step} of 4</span>
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
          {step === 1 && first === "crm" && !connectError && (
            <UseACrm
              onConnected={(name, provider) => {
                setCrmName(name);
                setFirst(provider === "gohighlevel" ? "autoreply" : "suggest");
              }}
              onNone={() => setFirst("apps")}
            />
          )}
          {step === 1 && first === "autoreply" && !connectError && <TurnOffAutoReply onDone={() => setFirst("suggest")} />}
          {step === 1 && ((first !== "crm" && first !== "autoreply") || connectError) && (
            <ChooseWhere
              crmName={first === "suggest" ? crmName : null}
              instagramAvailable={sources.instagramAvailable}
              outlookAvailable={sources.outlookAvailable}
              error={connectError}
              onDone={() => setStep(2)}
            />
          )}
          {step === 2 && <HowItShouldWork reading={autoSyncState === "syncing"} sentFrom={connectedName} onChosen={() => setStep(3)} />}
          {step === 3 && (
            <WaitingCustomers
              syncDone={autoSyncState !== "syncing"}
              readsPast={inboxConnected}
              instagram={sources.instagramConnected}
              onDone={finishOnboarding}
              finishing={finishing}
            />
          )}
          {step === 4 && <AlertsSetupStep onDone={openToday} />}
        </main>
      </div>
    </div>
  );
}

/**
 * Step 1, first screen (A-272, founder 2026-10-17: "ask first do they use a CRM… then suggest the other sources so
 * they don't lose leads", "keep onboarding as short as we can"). The CRMs are the answers; one tap opens the same
 * key window Settings uses. "No CRM" goes straight to the apps.
 */
function UseACrm({ onConnected, onNone }: { onConnected: (name: string, provider: string) => void; onNone: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <h1 className={H1}>Do you use a CRM?</h1>
      <CrmConfig setup={{ onConnected }} />
      <button type="button" onClick={onNone} className="ios-subhead mt-4 inline-flex min-h-11 w-full items-center justify-center text-ink-soft hover:text-ink">
        No CRM
      </button>
    </div>
  );
}

/**
 * Step 1, right after GoHighLevel connects (A-301, founder 2026-10-19: "i dont want go highlevels automated ai
 * message bro when we can handle it like a real person"). Shown once, then "Connect these too". FollowUp can't switch
 * GoHighLevel's replies off itself (it has no permission on workflows, on purpose), so the owner does it here, and
 * keeps everything else GoHighLevel does for him.
 *
 * The menu names ("Automation", "Conversation AI") are from GoHighLevel's help pages, not a live account: confirm
 * them on the founder's trial and the first real owner's account.
 */
function TurnOffAutoReply({ onDone }: { onDone: () => void }) {
  const steps = [
    { main: "Workflows that reply to new messages", sub: "In GoHighLevel: Automation. Turn them off." },
    { main: "Conversation AI", sub: "If you use it, turn it off for messages." },
  ];
  return (
    <div className="flex flex-1 flex-col">
      <p className="ios-subhead flex items-center gap-1.5" style={{ color: "var(--sage)" }}>
        <Check className="h-4 w-4" aria-hidden="true" />
        GoHighLevel connected
      </p>
      <h1 className={H1 + " mt-2"}>
        Turn off GoHighLevel&apos;s <span className="whitespace-nowrap">auto-reply</span>
      </h1>
      <p className="ios-subhead mt-1.5 text-ink-soft">So customers get one real answer from you, not a bot.</p>

      <ol className={GROUP + " mt-5"}>
        {steps.map((s, i) => (
          <li key={s.main} className="flex items-start gap-3 pl-4">
            <span
              aria-hidden="true"
              className="mt-[13px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card-2 text-[13px] font-semibold text-ink"
            >
              {i + 1}
            </span>
            <span className={"flex-1 py-3 pr-4" + (i ? " border-t border-line-2" : "")}>
              <span className="ios-body block text-ink">{s.main}</span>
              <span className="ios-subhead mt-0.5 block text-ink-soft">{s.sub}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="ios-footnote mx-4 mt-2 text-ink-faint">Keep reminders and your other workflows. FollowUp only takes over the reply.</p>

      <div className="mt-auto pb-7 pt-6">
        <button type="button" onClick={onDone} className={PRIMARY} style={PRIMARY_STYLE}>
          Done
        </button>
        <button type="button" onClick={onDone} className="ios-subhead mt-1 inline-flex min-h-11 w-full items-center justify-center text-ink-soft hover:text-ink">
          Later
        </button>
      </div>
    </div>
  );
}

/**
 * Step 1, the apps (A-272, A-273). After a CRM: FollowUp suggests the apps the CRM doesn't bring in, "Connect these
 * too", and Done moves on; nothing is forced. With no CRM: "Connect your apps", and the row is the choice. Words as
 * plain as R-121; iOS rows (A-273). The promises from A-241 stay, shorter, because they are what the owner is
 * agreeing to as they hand over access, and they hold for every way in.
 */
function ChooseWhere({
  crmName,
  instagramAvailable,
  outlookAvailable,
  error,
  onDone,
}: {
  crmName: string | null;
  instagramAvailable: boolean;
  outlookAvailable: boolean;
  error: string | null;
  onDone: () => void;
}) {
  const lines: Array<{ ok: boolean; text: string }> = [
    { ok: true, text: "Reads messages from customers" },
    { ok: true, text: "Skips friends and family" },
    { ok: false, text: "Sends nothing without your OK" },
  ];
  const ways = [
    ...(instagramAvailable
      ? [{ glyph: "instagram" as const, title: "Instagram", value: "DMs", href: "/api/instagram/oauth/start?next=onboarding" }]
      : []),
    { glyph: "email" as const, title: "Gmail", value: "Email", href: "/api/integrations/gmail/connect?next=onboarding" },
  ];
  return (
    <div className="flex flex-1 flex-col">
      {crmName && (
        <p className="ios-subhead flex items-center gap-1.5" style={{ color: "var(--sage)" }}>
          <Check className="h-4 w-4" aria-hidden="true" />
          {crmName} connected
        </p>
      )}
      <h1 className={H1 + (crmName ? " mt-2" : "")}>{crmName ? "Connect these too" : "Connect your apps"}</h1>
      <p className="ios-subhead mt-1.5 text-ink-soft">
        {crmName ? `${crmName} doesn't get these. Connect them so you don't miss a lead.` : "Pick what you use."}
      </p>

      <div className={GROUP + " mt-5"}>
        {ways.map((w, i) => (
          <ListRow key={w.title} icon={<GlyphTile glyph={w.glyph} />} label={w.title} value={w.value} href={w.href} first={i === 0} />
        ))}
      </div>
      {outlookAvailable && (
        <a
          href="/api/integrations/outlook/connect?next=onboarding"
          className="ios-subhead mt-1 inline-flex min-h-11 w-full items-center justify-center text-ink-soft hover:text-ink"
        >
          I use Outlook
        </a>
      )}

      {error && (
        <p role="alert" className="ios-subhead mt-3" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}

      {!crmName && (
        <ul className={GROUP + (outlookAvailable ? " mt-2.5" : " mt-5")}>
          {lines.map((l, i) => (
            <li key={l.text} className="flex items-center gap-3 pl-4">
              <span aria-hidden="true" className="w-4 shrink-0 text-center" style={{ color: l.ok ? "var(--sage)" : "var(--ink-faint)" }}>
                {l.ok ? "✓" : "✕"}
              </span>
              <span className={"ios-subhead flex min-h-[44px] flex-1 items-center pr-4" + (i ? " border-t border-line-2" : "")}>{l.text}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pb-7 pt-6">
        {crmName ? (
          <button type="button" onClick={onDone} className={PRIMARY} style={PRIMARY_STYLE}>
            Done
          </button>
        ) : (
          <p className="ios-footnote text-center text-ink-faint">Disconnect any time.</p>
        )}
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
function HowItShouldWork({ reading, sentFrom, onChosen }: { reading: boolean; sentFrom: string; onChosen: () => void }) {
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
      body: "Every reply waits for you. Nothing goes out until you send it.",
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
                  <span className="ml-auto text-[13px] font-medium uppercase tracking-[0.02em] text-ink-soft">{o.badge}</span>
                )}
              </span>
              <span className="mt-2.5 block pl-[34px] text-[15px] leading-relaxed text-ink-soft">{o.body}</span>
              {/* One example of what Automatic sends, marked as an example (OnbChoose). */}
              {o.id === "automatic" && on && (
                <span className="mt-3.5 ml-[34px] block rounded-[14px] px-3.5 py-3" style={WARM_CARD}>
                  <span className="block text-[13px] font-medium uppercase tracking-[0.02em] text-ink-soft">Sent on its own · example</span>
                  <span className="mt-1 block text-sm leading-snug">Thanks! Happy to quote that. Could you send a photo of your current tap?</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-[18px] flex items-start gap-2 text-sm leading-relaxed text-ink-soft">
        <Check className="mt-0.5 h-[15px] w-[15px] shrink-0 text-ink" strokeWidth={2.2} aria-hidden="true" />
        <span>Either way, it stops the moment they reply, and every message goes from your own {sentFrom}.</span>
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
/**
 * One optional line on the screen the owner already waits on (A-328, founder 2026-10-26: "we can ask them in onboarding
 * too"): the business's website, and its Instagram posts when Instagram is connected. What FollowUp finds waits in the
 * "Tell FollowUp" meeting's draft for the owner's check; the meeting then asks only what's missing. No new step and no
 * questions here (R-027).
 */
function SetupWebsite({ instagram, onHold }: { instagram: boolean; onHold: (hold: boolean) => void }) {
  const [link, setLink] = useState("");
  const [reading, setReading] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Long enough to read the line after Add before the screen moves on.
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    onHold(reading || justAdded || link.trim() !== "");
  }, [reading, justAdded, link, onHold]);

  useEffect(() => {
    if (!justAdded) return;
    const t = setTimeout(() => setJustAdded(false), 4000);
    return () => clearTimeout(t);
  }, [justAdded]);

  async function add() {
    const url = link.trim();
    if (!url || reading) return;
    setReading(true);
    setError(null);
    try {
      const res = await fetch("/api/business/tell/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read", url, instagram, setup: true }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: unknown; line?: unknown };
      if (!res.ok || !data.success) {
        setError(typeof data.message === "string" ? data.message : "That didn't go through. Try again, or leave it.");
      } else {
        setAdded(typeof data.line === "string" ? data.line : "Added.");
        setJustAdded(true);
        setLink("");
      }
    } catch {
      setError("That didn't go through. Check your connection, or leave it.");
    }
    setReading(false);
  }

  if (added) {
    return (
      <div className="mt-9 flex items-start gap-2">
        <Check className="mt-1 h-4 w-4 shrink-0" style={{ color: "var(--sage)" }} aria-hidden="true" />
        <p className="text-[14.5px] leading-snug text-ink-soft" role="status">
          {added}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-9">
      <p className="text-[15.5px] font-medium">While you wait: does your business have a website?</p>
      <p className="mt-1 text-[14.5px] leading-snug text-ink-soft">
        FollowUp reads it to learn what you do, so it asks you less later. You check what it found before it&apos;s ever used.
      </p>
      <form
        className="mt-3 flex items-center gap-2 rounded-full border bg-card py-1.5 pl-4 pr-1.5"
        style={{ borderColor: "var(--line-strong)" }}
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <label htmlFor="setup-website" className="sr-only">
          Your website link
        </label>
        <input
          id="setup-website"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          maxLength={200}
          placeholder="yourwebsite.ca"
          autoComplete="off"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="min-h-10 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-faint"
        />
        <button
          type="submit"
          disabled={reading || !link.trim()}
          className="min-h-10 shrink-0 rounded-full border bg-card px-[18px] text-[15px] font-medium disabled:opacity-50"
          style={{ borderColor: "var(--line-strong)" }}
        >
          {reading ? "Reading…" : "Add"}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 px-1 text-[14px]" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
      {instagram && (
        <p className="mt-2.5 flex items-center gap-2 px-1 text-[13.5px] text-ink-soft">
          <BrandTile brand="instagram" />
          Your Instagram posts are read too, since it&apos;s connected.
        </p>
      )}
    </div>
  );
}

function WaitingCustomers({
  syncDone,
  readsPast,
  instagram,
  onDone,
  finishing,
}: {
  syncDone: boolean;
  /** An inbox reads back 90 days; Instagram starts from the moment it connects (instagramPoll.ts). */
  readsPast: boolean;
  /** Instagram is connected: its posts are read with the website (A-328). */
  instagram: boolean;
  onDone: () => void;
  finishing: boolean;
}) {
  const [state, setState] = useState<"loading" | "ready">("loading");
  // The website line (A-328) holds this screen while its box has a link in it or it's reading: never lost by moving on.
  const [holdForSite, setHoldForSite] = useState(false);
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

  if (state === "loading" || holdForSite) {
    const held = state === "ready";
    return (
      <div className="flex flex-1 flex-col">
        <h1 className={H1}>{held ? "Your list is ready." : syncDone ? "Finding who’s waiting on a reply…" : "Still reading your inbox…"}</h1>
        <p className={LEDE + " flex items-center gap-2"}>
          {!held && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {held
            ? "It opens once your website is added, or when you clear the box."
            : !syncDone
              ? "A big inbox takes a minute. Nothing is sent."
              : readsPast
                ? "Reading the last 90 days. Nothing is sent."
                : "Nothing is sent."}
        </p>
        <SetupWebsite instagram={instagram} onHold={setHoldForSite} />
        <div className="mt-auto pb-7 pt-6">
          <p className="ios-footnote text-center text-ink-faint">No website? Leave it. This screen moves on by itself.</p>
        </div>
      </div>
    );
  }

  const safe = summary?.safe ?? 0;
  const needsYou = summary?.needsYou ?? 0;

  if (safe === 0) {
    return (
      <div className="flex flex-1 flex-col">
        <h1 className={H1}>{needsYou > 0 ? "A few people need you." : readsPast ? "No one is waiting." : "Ready for new messages."}</h1>
        <p className={LEDE}>
          {needsYou > 0
            ? `${needsYou} ${needsYou === 1 ? "customer asks" : "customers ask"} about a price, a date or something that needs your eye. ${needsYou === 1 ? "It waits" : "They wait"} for you in Today, with the reply written.`
            : readsPast
              ? "Anyone who writes from now on gets an answer. You'll see everything in Today."
              : // Instagram reads from the moment it connects, never old DMs
                // (instagramPoll.ts), so "no one is waiting" would be a guess.
                "FollowUp reads DMs from now on, not old ones. Anyone who writes gets an answer. You'll see everything in Today."}
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
        <p className="px-4 pb-2.5 pt-3.5 text-[13px] font-medium uppercase tracking-[0.02em] text-ink-faint">
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
