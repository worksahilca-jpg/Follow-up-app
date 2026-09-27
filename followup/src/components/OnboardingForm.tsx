"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { INDUSTRIES } from "@/lib/industries";
import { useRouter, useSearchParams } from "next/navigation";
// MessageCircle for Instagram and MessageSquare for Facebook are the
// icons InstagramConfig and FacebookConfig already use — this lucide
// version carries no brand marks, and a channel wearing a different
// icon on each screen is the drift the design brain exists to stop.
import { ArrowRight, Check, Globe, Loader2, Mail, MessageCircle, MessageSquare, Smartphone } from "lucide-react";
import LogoMark from "@/components/LogoMark";
import ImproveFollowUpToggle from "@/components/ImproveFollowUpToggle";
import OnboardingSources, { WebsiteFormPanel, type OnboardingSource } from "@/components/OnboardingSources";
import { useWhatsAppSignup } from "@/lib/useWhatsAppSignup";
import { WARM_CARD } from "@/components/app/ReplyCard";

/** The one full-width black button at the foot of each setup step (OnbConnect, OnbChoose, OnbOldCustomers). */
const PRIMARY =
  "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full px-6 text-base font-medium disabled:opacity-60";
const PRIMARY_STYLE = { backgroundColor: "var(--ink)", color: "var(--on-accent)" } as const;
const H1 = "text-[30px] leading-[1.1] tracking-[-0.025em]";
const LEDE = "mt-2.5 text-[15.5px] leading-relaxed text-ink-soft";

/**
 * Five steps: who you are, how this works, where your leads come from,
 * how FollowUp should work (Automatic or Assisted), and the customers who
 * were already waiting.
 *
 * ## What this replaces, and why
 *
 * It was two steps: a details form, then "Connect Gmail" with an "I'll do
 * this later" underneath. Gmail was the only source onboarding had ever
 * heard of — so a business running on Instagram DMs had nothing to say yes
 * to, skipped, and was then told on Today, forever, to connect an inbox it
 * does not have.
 *
 * The founder's read, 2026-09-21, when asked whether that inbox step should
 * be made skippable: *"why to skip i mean they should have a proper
 * onboarding process where first we will let them know how this works and
 * thats totaly skipable then we will help them to connect the sources
 * easyly and skipable too if they dont want that source to be added"* —
 * which is the right diagnosis. The nag was the symptom; onboarding
 * deciding on the owner's behalf which channel mattered was the cause.
 *
 * ## Resume is derived, not stored
 *
 * Every connect button leaves the app entirely, and the trip back is a
 * fresh page load with no client state. Rather than add a column to
 * remember the step, the server works it out from facts it already holds:
 * no industry means step 1; a connected or attempted source means step 3;
 * otherwise step 2. `?gmail=error` and friends count as "attempted",
 * which is what stops a failed connect dropping someone back onto the
 * explainer with no sign of what went wrong.
 */

export interface OnboardingSourceState {
  gmailConnected: boolean;
  outlookConnected: boolean;
  outlookAvailable: boolean;
  inboxEmail?: string;
  inboxProvider: "gmail" | "outlook" | null;
  instagramConnected: boolean;
  instagramAvailable: boolean;
  facebookConnected: boolean;
  facebookAvailable: boolean;
  metaChannelsAvailable: boolean;
}

interface OnboardingFormProps {
  initialName: string;
  initialIndustry?: string | null;
  initialTeamSize?: number | null;
  step1Done: boolean;
  /** True when the owner has already reached (and acted on) the sources step. */
  resumeAtSources: boolean;
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

type Step = 1 | 2 | 3 | 4 | 5;

function OnboardingFormInner({
  initialName,
  initialIndustry,
  initialTeamSize,
  step1Done,
  resumeAtSources,
  sources,
}: OnboardingFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>(!step1Done ? 1 : resumeAtSources ? 3 : 2);
  // Five screens, four steps as the owner counts them (the canvas's "Step N of 4").
  const shownStep = step <= 2 ? 1 : step - 1;
  const [name, setName] = useState(initialName);
  const [industry, setIndustry] = useState(initialIndustry || "");
  const [teamSize, setTeamSize] = useState(initialTeamSize ?? 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const inboxConnected = sources.gmailConnected || sources.outlookConnected;

  // WhatsApp is the one source that connects without leaving the page —
  // Meta drives it from a popup rather than a redirect — so its state is
  // read live here rather than passed down from the server render.
  const whatsapp = useWhatsAppSignup();

  // Fires once, right when a connected inbox first renders — pulls the
  // first batch of leads in immediately rather than leaving the dashboard
  // empty until someone finds "Sync now" in Settings later. Silent on
  // failure (most commonly: no active subscription yet, which every
  // brand-new signup lacks) — an onboarding screen is the wrong place to
  // surprise someone with a billing wall.
  const [autoSyncState, setAutoSyncState] = useState<"idle" | "syncing" | "done">("idle");
  const [autoSyncSummary, setAutoSyncSummary] = useState<string | null>(null);
  const autoSyncStarted = useRef(false);

  useEffect(() => {
    if (!inboxConnected || !sources.inboxProvider || autoSyncStarted.current) return;
    autoSyncStarted.current = true;
    setAutoSyncState("syncing");
    fetch(`/api/integrations/${sources.inboxProvider}/sync`, { method: "POST" })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok && data.success) {
          setAutoSyncSummary(
            data.count === 0
              ? "No sales conversations found yet — that's normal for a quiet inbox."
              : `Found ${data.count} lead${data.count === 1 ? "" : "s"} already${data.scored > 0 ? `, ${data.scored} scored` : ""}.`
          );
        }
      })
      .catch(() => {
        // Silent — see above.
      })
      .finally(() => setAutoSyncState("done"));
  }, [inboxConnected, sources.inboxProvider]);

  // The website form has no connected state to read back from a server —
  // it is a snippet someone pastes into their own site, and we only find
  // out when a lead arrives. Opening the panel is the closest honest
  // signal that they intend to use it, so it is what decides whether the
  // widget step is dismissed on the way out.
  const websiteFormTouched = useRef(false);

  /** Whatever the provider said on the way back, per source. */
  const errorFor = (key: string) =>
    searchParams.get(key) === "error" ? (searchParams.get("message") ?? `Couldn't connect ${key}.`) : null;
  const inboxError = errorFor("gmail") ?? errorFor("outlook");

  async function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give your business a name to continue.");
      return;
    }
    if (!industry) {
      setError("Select an industry to continue.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, industry, teamSize }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't save — try again.");
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  }

  /**
   * Finish, and record which sources the owner passed over.
   *
   * The second half is the point. An untouched source here is not "not
   * yet" — the founder was explicit that it means "I don't use this" and
   * that asking again would be wrong, since Settings carries every source
   * permanently. So anything the setup strip on Today would otherwise nag
   * about is marked as not applicable on the way out.
   *
   * Only two of the strip's steps are sources at all (`gmail` and
   * `widget`); the rest — billing, business details — are not skippable by
   * design and are not touched here. The dismissals are best-effort: if one
   * fails, the owner still finishes onboarding and the worst case is the
   * old behaviour, a step on Today they can dismiss themselves.
   */
  async function finishOnboarding() {
    setFinishing(true);

    const skipped: string[] = [];
    if (!inboxConnected) skipped.push("gmail");
    if (!websiteFormTouched.current) skipped.push("widget");

    await Promise.all(
      skipped.map((id) =>
        fetch("/api/business/setup-step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, dismissed: true }),
        }).catch(() => undefined)
      )
    );

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finish: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't finish — try again.");
      router.push("/dashboard");
      router.refresh();
    } catch {
      // Rare (a DB hiccup) — let them press again rather than stranding
      // them on a dead click.
      setFinishing(false);
    }
  }

  const sourceList: OnboardingSource[] = [
    {
      id: "inbox",
      name: "Email",
      line: "Gmail or Outlook — where most enquiries already land.",
      icon: Mail,
      connected: inboxConnected,
      connectedNote: sources.inboxEmail ? `Connected as ${sources.inboxEmail}` : undefined,
      href: "/api/integrations/gmail/connect?next=onboarding",
      altHref: sources.outlookAvailable ? "/api/integrations/outlook/connect?next=onboarding" : undefined,
      altLabel: "Use Outlook instead",
      error: inboxError,
    },
    ...(sources.metaChannelsAvailable && sources.instagramAvailable
      ? [
          {
            id: "instagram",
            name: "Instagram DMs",
            line: "Messages sent to your professional account.",
            icon: MessageCircle,
            connected: sources.instagramConnected,
            href: "/api/instagram/oauth/start?next=onboarding",
            error: errorFor("instagram"),
          } satisfies OnboardingSource,
        ]
      : []),
    ...(sources.metaChannelsAvailable && sources.facebookAvailable
      ? [
          {
            id: "facebook",
            name: "Facebook Page",
            line: "Messenger chats and Lead Ads forms.",
            icon: MessageSquare,
            connected: sources.facebookConnected,
            href: "/api/facebook/oauth/start?next=onboarding",
            error: errorFor("facebook"),
            // Meta returned more than one Page and the picker lives in
            // Settings. Say so plainly instead of leaving a half-finished
            // connection looking finished.
            note:
              searchParams.get("facebook") === "choose_page"
                ? "You have more than one Page — choose which one in Settings once you're through here."
                : null,
          } satisfies OnboardingSource,
        ]
      : []),
    ...(whatsapp.available || whatsapp.connected
      ? [
          {
            id: "whatsapp",
            name: "WhatsApp",
            line: "The number already in the WhatsApp Business app on your phone.",
            // Smartphone, not the MessageSquare that WhatsAppConfig uses in
            // Settings. Deliberate: FacebookConfig uses MessageSquare too,
            // and in Settings they sit in separate panels where that never
            // shows. Here they are adjacent rows in one list, and two
            // identical icons next to each other say "these are the same
            // kind of thing" — which is worse than the inconsistency.
            // A phone is also the truer picture: this is the number already
            // on the owner's handset, not a page or an inbox.
            icon: Smartphone,
            connected: whatsapp.connected,
            connectedNote: whatsapp.displayNumber ? `Connected as ${whatsapp.displayNumber}` : undefined,
            onConnect: whatsapp.start,
            connecting: whatsapp.connecting,
            error: whatsapp.error,
          } satisfies OnboardingSource,
        ]
      : []),
    {
      id: "widget",
      name: "Website form",
      line: "One line pasted into your site, and its enquiries come here.",
      icon: Globe,
      connected: false,
      expand: <WebsiteFormPanel />,
      onExpand: () => {
        websiteFormTouched.current = true;
      },
    },
  ];

  return (
    // As the canvas draws setup (OnbConnect, OnbChoose, OnbOldCustomers):
    // the mark on the left, "Step N of 4" on the right, then a left-aligned
    // title and one black button at the foot. Steps 1 and 2 (about you, how
    // it works) share "Step 1".
    <div className="min-h-[100dvh] bg-paper">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col px-5">
        <header className="flex h-[60px] shrink-0 items-center justify-between">
          <span className="flex items-center gap-2">
            <LogoMark height={22} />
            <span className="text-base font-semibold">FollowUp</span>
          </span>
          <span className="flex items-center gap-2.5">
            <span className="text-[12.5px] text-ink-faint">Step {shownStep} of 4</span>
            {/* Ink, not the accent: the screen's one accent moment is its button (A-006). */}
            <span className="flex gap-1" aria-hidden="true">
              {([1, 2, 3, 4] as const).map((n) => (
                <span
                  key={n}
                  className="h-[3px] w-[18px] rounded-full"
                  style={{ backgroundColor: shownStep >= n ? "var(--ink)" : "var(--line)" }}
                />
              ))}
            </span>
          </span>
        </header>

        <main className="flex flex-1 flex-col pt-5">
        {step === 1 && (
          <>
            <h1 className={H1}>About your business</h1>
            <p className={LEDE}>A couple quick questions and you&apos;re set up.</p>
            <form onSubmit={handleStep1Submit} className="mt-6 flex flex-1 flex-col gap-4">
              <div>
                <label htmlFor="onboarding-business-name" className="text-sm font-medium block mb-1.5">
                  Business name
                </label>
                <input
                  id="onboarding-business-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 w-full rounded-xl border border-line bg-card px-3.5 text-base"
                  placeholder="e.g. Riverside Realty"
                />
              </div>

              <div>
                <label htmlFor="onboarding-industry" className="text-sm font-medium block mb-1.5">
                  What kind of business?
                </label>
                <select
                  id="onboarding-industry"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="h-12 w-full rounded-xl border border-line bg-card px-3.5 text-base"
                  required
                >
                  <option value="" disabled>
                    Select an industry
                  </option>
                  {INDUSTRIES.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="onboarding-team-size" className="text-sm font-medium block mb-1.5">
                  How many people on your team?
                </label>
                <input
                  id="onboarding-team-size"
                  type="number"
                  min={1}
                  max={500}
                  value={teamSize}
                  onChange={(e) => setTeamSize(Number(e.target.value))}
                  className="h-12 w-24 rounded-xl border border-line bg-card px-3 text-center text-base"
                />
              </div>

              {error && (
                <p className="text-sm" style={{ color: "var(--coral)" }}>
                  {error}
                </p>
              )}

              <div className="mt-auto pb-7 pt-6">
                <button type="submit" disabled={saving} className={PRIMARY} style={PRIMARY_STYLE}>
                  {saving ? "Saving…" : "Continue"}
                  {!saving && <ArrowRight className="h-4 w-4" />}
                </button>
              </div>
            </form>
          </>
        )}

        {step === 2 && <HowItWorks onContinue={() => setStep(3)} onSkip={() => setStep(3)} />}

        {step === 3 && (
          <div className="flex flex-1 flex-col">
            <OnboardingSources sources={sourceList} onDone={() => setStep(4)} finishing={false}>

            {inboxConnected && (
              <>
                {(autoSyncState === "syncing" || autoSyncSummary) && (
                  <p className="mt-3 flex items-center gap-1.5 text-sm leading-relaxed text-ink-soft">
                    {autoSyncState === "syncing" ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pulling in your first leads…
                      </>
                    ) : (
                      autoSyncSummary
                    )}
                  </p>
                )}

                {/* Asked once, here, where the owner has just connected an
                    inbox — not buried in Settings they may never open. Off
                    by default; the switch is the consent
                    (docs/security-roadmap.md). */}
                <div className="mt-4 rounded-[18px] border border-line bg-card px-4 py-3">
                  <ImproveFollowUpToggle compact />
                </div>
              </>
            )}
            </OnboardingSources>
          </div>
        )}

        {step === 4 && <HowItShouldWork onChosen={() => setStep(5)} />}

        {step === 5 && <WaitingCustomers onDone={finishOnboarding} finishing={finishing} />}
        </main>
      </div>
    </div>
  );
}

/**
 * Step 2 — what the product actually does, before anyone is asked to hand
 * over an inbox.
 *
 * Skippable in full, per the founder's brief. Three beats, because
 * brand-principles.md #4 says the reader has ninety seconds and will not
 * read a paragraph.
 *
 * The third beat is the one that has to be exactly true. The old Connect
 * Gmail screen described a read-only product at the moment it asked for
 * send access, and the comment there recorded why that mattered: it is the
 * gap between a surprise and a betrayal. So this says plainly that
 * FollowUp writes and sends — and what stops it.
 *
 * No AI language anywhere on this screen, deliberately
 * ([[rejected#^S-13|S-13]], brand-principles.md #3): remove every
 * AI-referencing word and the screen still says what happens, because
 * there were none to remove.
 */
function HowItWorks({ onContinue, onSkip }: { onContinue: () => void; onSkip: () => void }) {
  const beats = [
    {
      title: "It watches where your customers write to you",
      body: "Your inbox, your DMs, your website form — whichever of those you connect next.",
    },
    {
      title: "When someone goes quiet, it writes the follow-up",
      body: "Using what was actually said in that conversation, in the language they wrote in.",
    },
    {
      // The beat this file's own header calls "the one that has to be
      // exactly true", and it was not.
      //
      // It read: "Anything it isn't certain about waits for your OK […]
      // and you can turn sending off for one person or for everyone."
      // Both halves were wrong the moment holdAllForApproval became
      // @default(true) for every account (2026-09-21):
      //
      //   - "anything it isn't certain about" says some things DO go out
      //     without asking. Nothing does. Every draft waits, on every
      //     account, and this screen is shown while asking for send
      //     access — the exact moment the header says the gap between a
      //     surprise and a betrayal opens.
      //   - "turn sending off" is backwards. It is already off; the
      //     decision a business makes is turning it ON (Settings →
      //     Automation). And "for one person" was false too: holdAll
      //     short-circuits ahead of a lead's own automation tier, so
      //     even a lead set to autonomous is held.
      //
      // Now states today's truth, names the choice, and keeps the
      // guarantee that survives either way.
      // Made true again for the step that follows (founder, 2026-09-26):
      // the owner now chooses, next, whether FollowUp sends on its own or
      // asks first. Either way prices and dates wait for them.
      title: "You choose how much it does",
      body: "Next, you pick: it follows up on its own, or every reply waits for your OK. Either way, prices and dates come to you, and it stops the moment they reply.",
    },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <h1 className={H1}>How FollowUp works</h1>

      <ol className="mt-6 overflow-hidden rounded-[18px] border border-line bg-card">
        {beats.map((beat, i) => (
          <li key={beat.title} className={"flex gap-3 px-4 py-4" + (i ? " border-t border-line-2" : "")}>
            {/* Numbered because this is a real sequence — a lead arrives,
                then goes quiet, then gets written to. Not decoration. */}
            <span
              aria-hidden="true"
              className="h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-xs font-medium"
              style={{ backgroundColor: "var(--card-2)", color: "var(--ink-soft)" }}
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-medium">{beat.title}</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">{beat.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-auto pb-7 pt-6">
        <button onClick={onContinue} className={PRIMARY} style={PRIMARY_STYLE}>
          Got it
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          onClick={onSkip}
          className="mt-1 inline-flex min-h-11 w-full items-center justify-center text-[15px] text-ink-soft transition-colors hover:text-ink"
        >
          Skip
        </button>
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
 * thing they couldn't keep up with in the first place. It is NOT
 * preselected by the server; the owner presses the button either way.
 */
function HowItShouldWork({ onChosen }: { onChosen: () => void }) {
  const [mode, setMode] = useState<"automatic" | "assisted">("automatic");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose() {
    setError(null);
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
      body: "Every reply waits for you. Nothing goes out until you tap Send.",
    },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <h1 className={H1}>How should FollowUp work?</h1>
      <p className={LEDE}>You can change this any time in Settings.</p>

      <div role="radiogroup" aria-label="How FollowUp works" className="mt-[22px] flex flex-col gap-3">
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
        <span>Either way, it stops the moment a customer replies, and every message goes from your own address.</span>
      </p>

      {error && (
        <p role="alert" className="text-sm mt-3" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}

      <div className="mt-auto pb-7 pt-6">
      <button onClick={choose} disabled={saving} className={PRIMARY} style={PRIMARY_STYLE}>
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
 * definition of "routine" (isSafeToSendInBulk), so "Send all 10" sends
 * exactly the 10 counted. A price or a date among them is never in the
 * batch; it waits in Today with its reply written.
 *
 * The replies are written on arrival here (one run of the automation for
 * this business), rather than on the next hourly tick — the founder's
 * "first replies are written right after connecting" decision. On a quiet
 * account, or if writing them fails, the screen says so and moves on:
 * nobody should be stuck at the end of setup.
 */
function WaitingCustomers({ onDone, finishing }: { onDone: () => void; finishing: boolean }) {
  const [state, setState] = useState<"loading" | "ready" | "sending">("loading");
  const [summary, setSummary] = useState<WaitingSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      // Best effort: a failed or slow run leaves whatever is already
      // queued, which the summary below reports truthfully.
      await fetch("/api/automation/run", { method: "POST" }).catch(() => undefined);
      try {
        const res = await fetch("/api/approvals/summary");
        const data = await res.json();
        if (res.ok && data.success) setSummary({ safe: data.safe, needsYou: data.needsYou, preview: data.preview ?? [] });
      } catch {
        // Falls through to the empty state.
      }
      setState("ready");
    })();
  }, []);

  async function sendAll() {
    setError(null);
    setState("sending");
    try {
      const res = await fetch("/api/approvals/send-safe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't send them. They're waiting in Today.");
      // Nothing went out at all (commonly: the inbox they came from isn't
      // connected any more). Say so here rather than moving on as though
      // they had been sent; a partial send moves on, and Today shows the rest.
      const skipped: Array<{ reason: string }> = Array.isArray(data.skipped) ? data.skipped : [];
      if (data.sent === 0 && skipped.length > 0) {
        throw new Error(`None of them went out: ${skipped[0].reason} They're waiting in Today.`);
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send them. They're waiting in Today.");
      setState("ready");
    }
  }

  if (state === "loading") {
    return (
      <div className="flex flex-1 flex-col">
        <h1 className={H1}>Finding who&apos;s waiting on a reply…</h1>
        <p className={LEDE + " flex items-center gap-2"}>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Reading the last 90 days. Nothing is sent.
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
            {finishing ? "Taking you there…" : "Go to Today"}
          </button>
        </div>
      </div>
    );
  }

  // As OnbOldCustomers: everyone who never got a reply, the first one with
  // its written reply in the warm card, the rest as rows; the price
  // questions named once; "Send all N" sends only the routine ones.
  const total = safe + needsYou;
  const preview = summary?.preview ?? [];
  const [first, ...rest] = preview;

  return (
    <div className="flex flex-1 flex-col">
      <h1 className={H1}>
        {total} {total === 1 ? "person" : "people"} never got a reply.
      </h1>
      <p className={LEDE}>From the last 90 days. A reply is written for each. Nothing has been sent.</p>

      <div className="mt-[18px] overflow-hidden rounded-[20px] border border-line bg-card">
        <p className="px-4 pb-2.5 pt-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-ink-faint">
          Ready to send · {safe}
        </p>
        {first && (
          <div className="px-4 pb-3.5">
            <p className="text-[15px] font-medium">{first.leadName}</p>
            {first.theirMessage && <p className="mt-0.5 line-clamp-1 text-[13.5px] text-ink-soft">“{first.theirMessage}”</p>}
            <p className="mt-2.5 rounded-[14px] px-3.5 py-3 text-sm leading-snug line-clamp-4" style={WARM_CARD}>
              {first.draftMessage}
            </p>
          </div>
        )}
        {rest.map((p) => (
          <div key={p.leadId} className="border-t border-line-2 px-4 py-3">
            <p className="text-[15px] font-medium">{p.leadName}</p>
            {p.theirMessage && <p className="mt-0.5 line-clamp-1 text-[13.5px] text-ink-soft">“{p.theirMessage}”</p>}
          </div>
        ))}
        {safe > preview.length && (
          <p className="border-t border-line-2 px-4 py-3 text-sm text-ink-soft">
            and {safe - preview.length} more, all in Today
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
        <button onClick={sendAll} disabled={state === "sending" || finishing} className={PRIMARY} style={PRIMARY_STYLE}>
          {state === "sending" ? "Sending…" : `Send all ${safe}`}
        </button>
        <button
          onClick={onDone}
          disabled={state === "sending" || finishing}
          className="mt-1 inline-flex min-h-11 w-full items-center justify-center text-[15px] text-ink-soft transition-colors hover:text-ink"
        >
          Not now, keep them in Today
        </button>
      </div>
    </div>
  );
}
