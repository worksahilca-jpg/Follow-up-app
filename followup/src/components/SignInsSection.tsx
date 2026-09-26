"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";

type Row = { device: string; place: string | null; at: string };

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * Sign-ins and security (design brain A-041, the Sign-ins board).
 *
 * "Recent sign-ins", not "where you're signed in": FollowUp's sessions
 * live in a cookie, so it can list when and from where the account was
 * signed in but can't see which of those browsers still hold a session.
 */
export default function SignInsSection() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [emailsOn, setEmailsOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/account/sign-ins")
      .then((r) => r.json())
      .then((d: { success?: boolean; signIns?: Row[]; emailsOn?: boolean }) => {
        if (d.success) {
          setRows(d.signIns ?? []);
          setEmailsOn(Boolean(d.emailsOn));
        } else setRows([]);
      })
      .catch(() => setRows([]));
  }, []);

  async function signOutEverywhere() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/sign-out-everywhere", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(typeof data.message === "string" ? data.message : "Couldn't do that. Try again.");
        setBusy(false);
        return;
      }
      await signOut({ callbackUrl: "/signin" });
    } catch {
      setError("Couldn't reach FollowUp. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="box p-5">
        <p className="font-medium text-sm">Recent sign-ins</p>
        <p className="text-xs text-ink-soft mt-1">When and from where your account was signed in, over the last 90 days.</p>
        {rows === null ? (
          <p className="mt-3 text-sm text-ink-soft">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">None recorded yet. Sign-ins show up here from now on.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {rows.map((r) => (
              <li key={r.at} className="py-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <span className="text-sm">
                  {r.device}
                  {r.place && <span className="text-ink-soft"> · {r.place}</span>}
                </span>
                <span className="text-xs text-ink-soft tabular-nums">{when(r.at)}</span>
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p className="mt-3 text-xs" style={{ color: "var(--coral)" }}>
            {error}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={signOutEverywhere}
            disabled={busy}
            className="rounded-lg px-3.5 py-1.5 text-sm font-medium border disabled:opacity-60"
            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
          >
            {busy ? "Signing out…" : "Sign out everywhere"}
          </button>
          <p className="text-xs text-ink-soft">Every device, this one too, is signed out within 5 minutes.</p>
        </div>
      </div>
      <div className="box p-5 text-sm space-y-2">
        {emailsOn && <p>When your account is signed in from a device or place we haven&apos;t seen, we email you.</p>}
        <p className="text-ink-soft">
          FollowUp has no password. You sign in with Google, so turning on Google&apos;s 2-Step Verification protects
          FollowUp too.
        </p>
      </div>
    </div>
  );
}
