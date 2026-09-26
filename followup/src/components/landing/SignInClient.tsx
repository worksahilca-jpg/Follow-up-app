"use client";

import { useEffect, useState } from "react";
import { Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Reveal from "@/components/landing/Reveal";
import LogoMark from "@/components/LogoMark";

// The sign-in screen on the app's own tokens (globals.css): the same
// charcoal-or-white ground as the landing page and the app, the brand
// symbol, one card, one button. It used to scope the navy-era
// landing.module.css and carry a floating-chip 3D scene behind the card;
// both went on 2026-09-19 with the move to the black-and-white system —
// the one thing a visitor has to do here is click precisely, and nothing
// should compete with that.
//
// Everything below the markup is unchanged: the actual sign-in logic
// (auto-retry, error states, the Google button itself) is as before.
// The already-signed-in redirect lives one level up, in page.tsx (a server
// component) — it runs before this client UI ever mounts.
export default function SignInClient({ inviteBusinessName }: { inviteBusinessName?: string | null } = {}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-paper text-ink">
      {/* The same soft light the landing page puts behind its hero. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[70vh]"
        style={{ background: "radial-gradient(60% 55% at 50% 0%, var(--accent-soft) 0%, transparent 70%)" }}
      />
      <div className="relative flex min-h-screen flex-col items-center justify-center px-6 py-16">
        <Link href="/" className="mb-10 flex items-center gap-2.5" aria-label="FollowUp home">
          <LogoMark height={22} />
          <span className="text-[17px] font-bold" style={{ letterSpacing: "-0.02em" }}>
            FollowUp
          </span>
        </Link>
        <Suspense fallback={null}>
          <SignInPageInner inviteBusinessName={inviteBusinessName ?? null} />
        </Suspense>
        <Link href="/" className="mt-8 text-xs font-medium text-ink-soft transition-opacity hover:opacity-70">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}

// One retry of a failed Google callback is silently attempted before ever
// showing an error — see readAutoRetry() below for why.
const RETRY_KEY = "followup_oauth_retried";

// OAuthCallback has shown up on a clean single click, with no double-click
// involved — every check NextAuth runs before that error (state/PKCE cookie
// presence) only needs OUR OWN cookie + secret, so it isn't cold-start-
// sensitive. What IS in that same try/catch is the actual network round-trip
// to Google's token endpoint, which on a serverless platform can flake on
// the first (cold) invocation and succeed immediately after. Since manually
// clicking "Continue with Google" again always works, we do that one retry
// automatically instead of making the user see a scary error and do it
// themselves. Runs once at mount (not in an effect) so it can decide
// synchronously, before the first paint, whether to show the real UI or a
// silent "Redirecting…" state; sessionStorage caps it at once per browser
// session — a second real failure in a row still shows the actual error
// rather than looping forever.
function readAutoRetry(error: string | null): boolean {
  if (typeof window === "undefined") return false;
  if (error !== "OAuthCallback") {
    // A clean landing (no error, or some other error) — a future
    // OAuthCallback gets its own fresh one-time retry budget.
    window.sessionStorage.removeItem(RETRY_KEY);
    return false;
  }
  if (window.sessionStorage.getItem(RETRY_KEY)) {
    // Already auto-retried once this session and failed again for real —
    // clear the flag so a later, fresh sign-in attempt still gets its own
    // one free retry, and let the actual error show.
    window.sessionStorage.removeItem(RETRY_KEY);
    return false;
  }
  window.sessionStorage.setItem(RETRY_KEY, "1");
  return true;
}

function SignInPageInner({ inviteBusinessName }: { inviteBusinessName: string | null }) {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  // Google's PKCE/state verification cookies are set the instant signIn()
  // fires and checked when Google redirects back — a second click before
  // that redirect happens overwrites them, so the first round-trip comes
  // back and fails verification (OAuthCallback). Disabling on first click
  // makes that race impossible, not just less likely.
  const [redirecting, setRedirecting] = useState(false);
  const [autoRetrying] = useState(() => readAutoRetry(error));

  useEffect(() => {
    if (autoRetrying) signIn("google", { callbackUrl: "/dashboard" });
  }, [autoRetrying]);

  return (
    <Reveal className="w-full max-w-sm">
      <div
        className="relative w-full rounded-[var(--radius-box)] bg-card p-8 text-center"
        style={{ boxShadow: "var(--shadow-box-lift)" }}
      >
        {/* Not "Welcome back": the landing page's button lands first-time
            visitors on this exact screen, so roughly half the traffic here
            has never signed in before. */}
        <h1 className="text-xl font-bold" style={{ letterSpacing: "-0.02em" }}>
          Sign in to FollowUp
        </h1>
        <p className="mt-2 text-sm text-ink-soft">FollowUp is in a private beta. Sign in with the Google account Sahil added.</p>

        <button
          onClick={() => {
            setRedirecting(true);
            signIn("google", { callbackUrl: "/dashboard" });
          }}
          disabled={redirecting || autoRetrying}
          className="mt-7 w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-transform hover:scale-[1.015] disabled:opacity-60 disabled:hover:scale-100"
          style={{ background: "var(--accent)", color: "var(--on-accent)" }}
        >
          <GoogleIcon className="h-4 w-4" />
          {redirecting || autoRetrying ? "Redirecting…" : "Continue with Google"}
        </button>

        {/* A first-attempt OAuthCallback silently retries once (see the
            effect above) — don't flash the scary error while that's
            in flight; only show it if the retry fails too. */}
        {!autoRetrying && error === "AccessDenied" && (
          <p className="mt-4 text-sm" style={{ color: "var(--coral)" }}>
            That Google account isn&apos;t on the list. FollowUp is invite-only for now — email{" "}
            <a href="mailto:contact@followupbase.io" className="underline">
              contact@followupbase.io
            </a>
            .
          </p>
        )}
        {/* Team invites need their link since 2026-09-26 (security audit
            H-2). Someone invited who signs in without it is told what to
            do, not refused as a stranger. */}
        {/* Names the team, read server-side from the invite this browser
            opened: signing in here joins it, so the person should know
            whose workspace they are walking into before they do. */}
        {!error && inviteBusinessName && (
          <p className="mt-4 text-sm text-ink-soft">
            Signing in will add you to <span className="font-medium text-ink">{inviteBusinessName}</span>&apos;s team. Continue
            with the Google account for the email address the invite was sent to.
          </p>
        )}
        {!autoRetrying && error === "InviteLink" && (
          <p className="mt-4 text-sm" style={{ color: "var(--coral)" }}>
            You&apos;ve been invited to a team. Open the invite link you were sent, then sign in from there. No link?
            Ask the person who invited you to copy it from their Team settings.
          </p>
        )}
        {!autoRetrying && error === "InviteInvalid" && (
          <p className="mt-4 text-sm" style={{ color: "var(--coral)" }}>
            That invite link isn&apos;t valid any more. Ask the person who invited you for a new one.
          </p>
        )}
        {!autoRetrying && error && error !== "AccessDenied" && error !== "InviteLink" && error !== "InviteInvalid" && (
          <p className="mt-4 text-sm" style={{ color: "var(--coral)" }}>
            Sign-in failed — please try again. <span className="text-ink-soft">({error})</span>
          </p>
        )}
      </div>
    </Reveal>
  );
}

// Google's own four-colour mark, as their sign-in guidelines ask. The one
// place on a monochrome screen that keeps its colour, because it is not ours.
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
