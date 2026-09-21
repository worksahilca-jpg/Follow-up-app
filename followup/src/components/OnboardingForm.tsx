"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { INDUSTRIES } from "@/lib/industries";
import { useRouter, useSearchParams } from "next/navigation";
// MessageCircle for Instagram and MessageSquare for Facebook are the
// icons InstagramConfig and FacebookConfig already use — this lucide
// version carries no brand marks, and a channel wearing a different
// icon on each screen is the drift the design brain exists to stop.
import { ArrowRight, Globe, Loader2, Mail, MessageCircle, MessageSquare, Smartphone } from "lucide-react";
import LogoMark from "@/components/LogoMark";
import ImproveFollowUpToggle from "@/components/ImproveFollowUpToggle";
import OnboardingSources, { WebsiteFormPanel, type OnboardingSource } from "@/components/OnboardingSources";
import { useWhatsAppSignup } from "@/lib/useWhatsAppSignup";

/**
 * Three steps: who you are, how this works, where your leads come from.
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

type Step = 1 | 2 | 3;

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
    <div className="min-h-screen flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-1">
          <LogoMark height={24} />
          <span className="font-display text-2xl">FollowUp</span>
        </div>

        {/* Three pips now. Ink, not the accent: the screen's one accent
            moment belongs to its primary button (A-006), and three coloured
            marks above it would take that away. */}
        <div className="flex items-center justify-center gap-1.5 mt-4">
          {([1, 2, 3] as const).map((n) => (
            <span
              key={n}
              className="h-1.5 w-6 rounded-full"
              style={{ backgroundColor: step >= n ? "var(--ink)" : "var(--line)" }}
            />
          ))}
        </div>

        {step === 1 && (
          <>
            <p className="text-ink-soft text-center mt-4">A couple quick questions and you&apos;re set up.</p>
            <form onSubmit={handleStep1Submit} className="mt-8 space-y-4">
              <div>
                <label htmlFor="onboarding-business-name" className="text-sm font-medium block mb-1.5">
                  Business name
                </label>
                <input
                  id="onboarding-business-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm"
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
                  className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm"
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
                  className="w-24 rounded-lg border border-line bg-card px-3 py-2 text-sm text-center"
                />
              </div>

              {error && (
                <p className="text-sm" style={{ color: "var(--coral)" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-60"
                style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
              >
                {saving ? "Saving…" : "Continue"}
              </button>
            </form>
          </>
        )}

        {step === 2 && <HowItWorks onContinue={() => setStep(3)} onSkip={() => setStep(3)} />}

        {step === 3 && (
          <>
            <OnboardingSources sources={sourceList} onDone={finishOnboarding} finishing={finishing} />

            {inboxConnected && (
              <>
                {(autoSyncState === "syncing" || autoSyncSummary) && (
                  <p className="text-sm text-ink-soft text-center mt-3 leading-relaxed flex items-center justify-center gap-1.5">
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
                <div className="mt-4 box px-4 py-3">
                  <ImproveFollowUpToggle compact />
                </div>
              </>
            )}
          </>
        )}
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
      title: "It watches where your leads arrive",
      body: "Your inbox, your DMs, your website form — whichever of those you connect next.",
    },
    {
      title: "When someone goes quiet, it writes the follow-up",
      body: "Using what was actually said in that conversation, in the language they wrote in.",
    },
    {
      title: "Nothing goes out behind your back",
      body: "Anything it isn't certain about waits for your OK, everything stops the moment they reply, and you can turn sending off for one person or for everyone.",
    },
  ];

  return (
    <div className="mt-8">
      <h2 className="font-display text-xl text-center">How FollowUp works</h2>

      <ol className="mt-6 space-y-4">
        {beats.map((beat, i) => (
          <li key={beat.title} className="flex gap-3">
            {/* Numbered because this is a real sequence — a lead arrives,
                then goes quiet, then gets written to. Not decoration. */}
            <span
              aria-hidden="true"
              className="h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-xs font-medium"
              style={{ backgroundColor: "var(--card)", color: "var(--ink-soft)" }}
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{beat.title}</p>
              <p className="text-xs text-ink-soft mt-0.5 leading-relaxed">{beat.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <button
        onClick={onContinue}
        className="w-full mt-7 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium"
        style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
      >
        Got it
        <ArrowRight className="h-4 w-4" />
      </button>
      <button
        onClick={onSkip}
        className="w-full mt-2 inline-flex min-h-11 items-center justify-center text-sm text-ink-soft hover:text-ink transition-colors"
      >
        Skip
      </button>
    </div>
  );
}
