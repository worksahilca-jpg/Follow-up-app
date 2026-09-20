"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { INDUSTRIES } from "@/lib/industries";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Check, ArrowRight, Loader2 } from "lucide-react";
import LogoMark from "@/components/LogoMark";
import ImproveFollowUpToggle from "@/components/ImproveFollowUpToggle";


interface OnboardingFormProps {
  initialName: string;
  initialIndustry?: string | null;
  initialTeamSize?: number | null;
  step1Done: boolean;
  /** Gmail OR Outlook — either one finishes this step. */
  inboxConnected: boolean;
  inboxEmail?: string;
  /** Which provider is connected — decides which sync endpoint to kick. */
  inboxProvider: "gmail" | "outlook" | null;
  /** Whether the Microsoft one-click button can be offered at all. */
  outlookAvailable: boolean;
}

// Wrapped in Suspense because the inner component reads useSearchParams()
// (for the gmail=connected/error round trip from Google) — same pattern
// Settings uses for the same reason.
export default function OnboardingForm(props: OnboardingFormProps) {
  return (
    <Suspense fallback={null}>
      <OnboardingFormInner {...props} />
    </Suspense>
  );
}

function OnboardingFormInner({
  initialName,
  initialIndustry,
  initialTeamSize,
  step1Done,
  inboxConnected,
  inboxEmail,
  inboxProvider,
  outlookAvailable,
}: OnboardingFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Resume on step 2 both for someone returning after already finishing
  // step 1 earlier, and for the mid-flow return trip from Google's consent
  // screen (a full page navigation that loses all client state) — either
  // way, step1Done is what the server already knows to be true.
  const [step, setStep] = useState<1 | 2>(step1Done ? 2 : 1);
  const [name, setName] = useState(initialName);
  const [industry, setIndustry] = useState(initialIndustry || "");
  const [teamSize, setTeamSize] = useState(initialTeamSize ?? 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  // Fires once, right when the "connected" state first renders — pulls the
  // first batch of leads in immediately rather than leaving the dashboard
  // empty until someone finds "Sync now" in Settings later. Silent on
  // failure (most commonly: this business has no active subscription
  // yet, which every brand-new signup doesn't) — an onboarding screen is
  // the wrong place to surprise someone with a billing wall, and Settings
  // already carries that message once they land in the app for real.
  const [autoSyncState, setAutoSyncState] = useState<"idle" | "syncing" | "done">("idle");
  const [autoSyncSummary, setAutoSyncSummary] = useState<string | null>(null);
  const autoSyncStarted = useRef(false);

  useEffect(() => {
    if (!inboxConnected || !inboxProvider || autoSyncStarted.current) return;
    autoSyncStarted.current = true;
    setAutoSyncState("syncing");
    // Kick the sync for whichever provider actually connected. This was
    // hardcoded to the Gmail endpoint, so an Outlook business finished
    // onboarding and landed on an empty dashboard with nothing pulled in —
    // the failure was swallowed by the catch below, exactly as designed for
    // a billing wall, so nothing surfaced it.
    fetch(`/api/integrations/${inboxProvider}/sync`, { method: "POST" })
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
        // Silent — see comment above.
      })
      .finally(() => setAutoSyncState("done"));
  }, [inboxConnected, inboxProvider]);

  // Either provider's callback can bounce back here with an error. Reading
  // only `gmail` meant an Outlook failure returned to a screen that said
  // nothing at all about it — the owner just saw the connect step again with
  // no explanation of why it hadn't worked.
  const connectError =
    searchParams.get("gmail") === "error"
      ? searchParams.get("message") ?? "Couldn't connect Gmail."
      : searchParams.get("outlook") === "error"
        ? searchParams.get("message") ?? "Couldn't connect Outlook."
        : null;

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

  async function finishOnboarding() {
    setFinishing(true);
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
      // Finishing failed (rare — a DB hiccup) — let them try the button
      // again rather than stranding them on a dead click.
      setFinishing(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-1">
          <LogoMark height={24} />
          <span className="font-display text-2xl">FollowUp</span>
        </div>

        {/* Two-step progress — just enough structure to signal "one more
            thing" rather than "here's an open-ended checklist".

            The logo and both pips used to be --rust. That put three blue marks
            on a screen whose ONE blue moment is meant to be the Connect Gmail
            button — which is the best example of "accent held back" (A-006)
            already shipping anywhere in the product. Ink here, so the button
            keeps the only blue on the screen. */}
        <div className="flex items-center justify-center gap-1.5 mt-4">
          <span className="h-1.5 w-6 rounded-full" style={{ backgroundColor: "var(--ink)" }} />
          <span
            className="h-1.5 w-6 rounded-full"
            style={{ backgroundColor: step === 2 ? "var(--ink)" : "var(--line)" }}
          />
        </div>

        {step === 1 ? (
          <>
            <p className="text-ink-soft text-center mt-4">A couple quick questions and you&apos;re set up.</p>
            <form onSubmit={handleStep1Submit} className="mt-8 space-y-4">
              <div>
                <label htmlFor="onboarding-business-name" className="text-sm font-medium block mb-1.5">Business name</label>
                <input
                  id="onboarding-business-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm"
                  placeholder="e.g. Riverside Realty"
                />
              </div>

              <div>
                <label htmlFor="onboarding-industry" className="text-sm font-medium block mb-1.5">What kind of business?</label>
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
                <label htmlFor="onboarding-team-size" className="text-sm font-medium block mb-1.5">How many people on your team?</label>
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
        ) : (
          <div className="mt-8">
            {inboxConnected ? (
              <>
                <div
                  className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto"
                  style={{ backgroundColor: "var(--sage-soft)", color: "var(--sage)" }}
                >
                  <Check className="h-6 w-6" />
                </div>
                <h2 className="font-display text-xl text-center mt-4">
                  {inboxProvider === "outlook" ? "Outlook" : "Gmail"} connected
                </h2>
                <p className="text-sm text-ink-soft text-center mt-2 leading-relaxed">
                  Connected as <span className="font-medium text-ink">{inboxEmail}</span>.
                </p>

                {/* Real-time status of the auto-sync kicked off in the
                    effect above — replaces the old static "sync from the
                    dashboard" copy with what's actually happening right
                    now. Never blocks "Continue" — worst case (most
                    commonly: no active subscription yet) this renders
                    nothing at all and the dashboard behaves exactly as it
                    always has. */}
                {(autoSyncState === "syncing" || autoSyncSummary) && (
                  <p className="text-sm text-ink-soft text-center mt-1 leading-relaxed flex items-center justify-center gap-1.5">
                    {autoSyncState === "syncing" ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pulling in your first leads…
                      </>
                    ) : (
                      autoSyncSummary
                    )}
                  </p>
                )}

                {/* Asked once, here, where the owner has just seen what
                    FollowUp does with their inbox — not buried in Settings
                    they may never open. Off by default; the switch is the
                    consent (docs/security-roadmap.md). */}
                <div className="mt-5 rounded-[var(--radius-box)] bg-card px-4 py-3" style={{ boxShadow: "var(--shadow-box)" }}>
                  <ImproveFollowUpToggle compact />
                </div>

                <button
                  onClick={finishOnboarding}
                  disabled={finishing}
                  className="w-full mt-4 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-60"
                  style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
                >
                  {finishing ? "Taking you there…" : "Continue to dashboard"}
                  {!finishing && <ArrowRight className="h-4 w-4" />}
                </button>
              </>
            ) : (
              <>
                <div
                  className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto border border-line"
                  style={{ backgroundColor: "var(--card)", color: "var(--ink-soft)" }}
                >
                  <Mail className="h-6 w-6" />
                </div>
                <h2 className="font-display text-xl text-center mt-4">Connect Gmail</h2>
                {/* This said FollowUp "reads your sales conversations and tells
                    you who needs a follow-up today" — which describes a
                    READ-ONLY product, at the exact moment the owner grants send
                    access. It isn't read-only: connecting imports the last 90
                    days of threads, automation is already enabled at signup
                    (auth.ts), and dead-lead reactivation defaults to on at a
                    45-day threshold — so imported threads between 45 and 90
                    days old are the reactivation batch.

                    Nobody decided that; three separate defaults stack into it.
                    Changing the defaults is a product call and is flagged
                    separately. What this screen can do is stop understating
                    what the owner is agreeing to, which is the thing that
                    turns a surprise into a betrayal. Say it plainly, before
                    the OAuth screen, not after the first message goes out. */}
                <p className="text-sm text-ink-soft text-center mt-2 leading-relaxed">
                  This is the whole point — FollowUp reads your sales conversations and tells you who needs a
                  follow-up today. Without it, the dashboard stays empty.
                </p>

                <div
                  className="relative mt-4 rounded-[var(--radius-box)] bg-card py-3 pl-4 pr-3 text-left"
                  style={{ boxShadow: "var(--shadow-box)" }}
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 w-[3px] rounded-l-[var(--radius-box)]"
                    style={{ backgroundColor: "var(--gold)" }}
                  />
                  <p className="text-sm font-medium">What happens when you connect</p>
                  <ul className="mt-1.5 space-y-1 text-xs text-ink-soft">
                    <li>
                      FollowUp imports your conversations from the{" "}
                      <strong className="font-medium">last 3 months</strong> so it has something to work with.
                    </li>
                    <li>
                      It can then <strong className="font-medium">send follow-ups from your address</strong>, including
                      to people who went quiet a while ago.
                    </li>
                    <li>
                      Anything it isn&apos;t sure about waits for your OK first. It stops the moment someone replies.
                    </li>
                    <li>
                      You can turn sending off for everyone, or for one person, at any time in Settings.
                    </li>
                  </ul>
                </div>

                {connectError && (
                  <p className="text-sm text-center mt-4" style={{ color: "var(--coral)" }}>
                    {connectError}
                  </p>
                )}

                <a
                  href="/api/integrations/gmail/connect?next=onboarding"
                  className="w-full mt-6 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold"
                  style={{ backgroundColor: "var(--rust)", color: "var(--on-accent)" }}
                >
                  <Mail className="h-4 w-4" /> Connect Gmail
                </a>

                {/* Google's own interstitial, warned about before it
                    appears rather than left to land as a shock. Until the
                    OAuth app finishes verification, the consent screen
                    shows a full-page red "Google hasn't verified this
                    app" with the continue link folded away under
                    "Advanced" — to someone one click into a product about
                    trusting software with their inbox, that page reads as
                    "this is a scam", and it is the most likely place in
                    the whole funnel to lose a tester. The one thing that
                    turns it from a warning into a step is knowing it is
                    coming and where the button is. */}
                <p className="text-xs text-ink-soft text-center mt-3 leading-relaxed">
                  Google will show a red &ldquo;hasn&apos;t verified this app&rdquo; screen first — FollowUp&apos;s
                  review with Google is still in progress. Choose <strong className="font-medium">Advanced</strong>,
                  then <strong className="font-medium">Go to FollowUp</strong>. Nothing is shared until you press
                  Allow on the screen after it.
                </p>

                {/* Outlook was missing from this screen entirely. A business on
                    Microsoft 365 had no way to finish onboarding — and once
                    inside the app, setupStatus checked Gmail alone, so it got
                    nagged "Connect Gmail" forever with a step count it could
                    never clear. The connect route already accepted
                    `next=onboarding`; nothing linked to it from here.

                    Secondary styling deliberately: Gmail keeps the one accent
                    moment on this screen (A-006), and Gmail is the majority
                    case. Hidden entirely when MICROSOFT_CLIENT_ID isn't
                    configured, rather than offering a button that errors. */}
                {outlookAvailable && (
                  <a
                    href="/api/integrations/outlook/connect?next=onboarding"
                    className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm font-medium"
                  >
                    <Mail className="h-4 w-4" /> Connect Outlook instead
                  </a>
                )}
                <button
                  onClick={finishOnboarding}
                  disabled={finishing}
                  className="w-full mt-3 text-sm text-ink-soft hover:text-ink transition-colors disabled:opacity-60"
                >
                  {finishing ? "One sec…" : "I'll do this later"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
