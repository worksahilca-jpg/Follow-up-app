"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Compass, Mail, Check, ArrowRight, Loader2 } from "lucide-react";

const INDUSTRIES = [
  "Real estate",
  "Mortgage brokerage",
  "Home services (contractor, cleaning, etc.)",
  "Dental / medical clinic",
  "Legal",
  "Marketing agency",
  "Other",
];

interface OnboardingFormProps {
  initialName: string;
  initialIndustry?: string | null;
  initialTeamSize?: number | null;
  step1Done: boolean;
  gmailConnected: boolean;
  gmailEmail?: string;
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
  gmailConnected,
  gmailEmail,
}: OnboardingFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Resume on step 2 both for someone returning after already finishing
  // step 1 earlier, and for the mid-flow return trip from Google's consent
  // screen (a full page navigation that loses all client state) — either
  // way, step1Done is what the server already knows to be true.
  const [step, setStep] = useState<1 | 2>(step1Done ? 2 : 1);
  const [name, setName] = useState(initialName);
  const [industry, setIndustry] = useState(initialIndustry || INDUSTRIES[0]);
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
    if (!gmailConnected || autoSyncStarted.current) return;
    autoSyncStarted.current = true;
    setAutoSyncState("syncing");
    fetch("/api/integrations/gmail/sync", { method: "POST" })
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
  }, [gmailConnected]);

  const gmailError = searchParams.get("gmail") === "error" ? searchParams.get("message") ?? "Couldn't connect Gmail." : null;

  async function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give your business a name to continue.");
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
          <Compass className="h-6 w-6" style={{ color: "var(--rust)" }} />
          <span className="font-display text-2xl">FollowUp</span>
        </div>

        {/* Two-step progress — just enough structure to signal "one more
            thing" rather than "here's an open-ended checklist". */}
        <div className="flex items-center justify-center gap-1.5 mt-4">
          <span className="h-1.5 w-6 rounded-full" style={{ backgroundColor: "var(--rust)" }} />
          <span
            className="h-1.5 w-6 rounded-full"
            style={{ backgroundColor: step === 2 ? "var(--rust)" : "var(--line)" }}
          />
        </div>

        {step === 1 ? (
          <>
            <p className="text-ink-soft text-center mt-4">A couple quick questions and you&apos;re set up.</p>
            <form onSubmit={handleStep1Submit} className="mt-8 space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">Business name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm"
                  placeholder="e.g. Riverside Realty"
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5">What kind of business?</label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm"
                >
                  {INDUSTRIES.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5">How many people on your team?</label>
                <input
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
            {gmailConnected ? (
              <>
                <div
                  className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto"
                  style={{ backgroundColor: "var(--sage-soft)", color: "var(--sage)" }}
                >
                  <Check className="h-6 w-6" />
                </div>
                <h2 className="font-display text-xl text-center mt-4">Gmail connected</h2>
                <p className="text-sm text-ink-soft text-center mt-2 leading-relaxed">
                  Connected as <span className="font-medium text-ink">{gmailEmail}</span>.
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

                <button
                  onClick={finishOnboarding}
                  disabled={finishing}
                  className="w-full mt-6 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-60"
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
                <p className="text-sm text-ink-soft text-center mt-2 leading-relaxed">
                  This is the whole point — FollowUp reads your sales conversations and tells you who
                  needs a follow-up today. Without it, the dashboard stays empty.
                </p>

                {gmailError && (
                  <p className="text-sm text-center mt-4" style={{ color: "var(--coral)" }}>
                    {gmailError}
                  </p>
                )}

                <a
                  href="/api/integrations/gmail/connect?next=onboarding"
                  className="w-full mt-6 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold"
                  style={{ backgroundColor: "var(--rust)", color: "var(--on-accent)" }}
                >
                  <Mail className="h-4 w-4" /> Connect Gmail
                </a>
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
