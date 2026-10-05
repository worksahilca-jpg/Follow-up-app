"use client";

import { useCallback, useEffect, useState } from "react";
import { Reply } from "lucide-react";
import Switch from "@/components/Switch";

/**
 * "Write like me" — the consent switch for reading the owner's sent Gmail
 * replies from the last year so drafts sound like them (POST
 * /api/business/past-replies, src/lib/pastReplies.ts). Settings → Your data,
 * under "Help improve FollowUp".
 *
 * Its own switch, not folded into that one: that one keeps a draft beside
 * what was sent; this one reads a year of sent mail — a bigger ask, so it
 * gets its own yes. Off by default, never pre-ticked. Off deletes every copy
 * at once, and the copy says so, because that is the promise that makes
 * saying yes easy.
 *
 * The icon is a reply arrow: the owner's replies are the subject. Never a
 * sparkle (rejected.md S-13).
 */
type State = {
  on: boolean;
  status: "reading" | "done" | "failed" | null;
  kept: number;
  error: string | null;
  gmailConnected: boolean;
};

function statusLine(s: State): string | null {
  if (!s.gmailConnected && !s.on) return "Connect Gmail first.";
  if (!s.on) return null;
  if (s.status === "failed") return s.error ?? "Reading stopped. Turn it off and on to try again.";
  if (s.status === "reading") return s.kept > 0 ? `Reading your past replies… ${s.kept} so far.` : "Reading your past replies…";
  if (s.kept === 0) return "No replies to customers found in the last year.";
  return `Learned from ${s.kept} of your past replies.`;
}

export default function PastRepliesToggle() {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/business/past-replies")
      .then((r) => r.json())
      .then((data: { success: boolean } & State) => {
        if (data.success) setState(data);
      })
      .catch(() => {});
  }, []);

  useEffect(load, [load]);

  // While it reads, check back now and then so the count moves.
  useEffect(() => {
    if (state?.status !== "reading") return;
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [state?.status, load]);

  async function toggle() {
    if (!state || busy) return;
    const next = !state.on;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/business/past-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string } & Partial<State>;
      if (!res.ok || !data.success) throw new Error(data.message || "Couldn't save — try again.");
      setState({ ...state, ...data, on: next } as State);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save — try again.");
    } finally {
      setBusy(false);
    }
  }

  const line = state ? statusLine(state) : null;
  const disabled = !state || busy || (!state.on && !state.gmailConnected);

  return (
    <div className="box p-5">
      <div className="flex items-center gap-4">
        <div
          className="h-9 w-9 rounded-[10px] flex items-center justify-center shrink-0"
          style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}
        >
          <Reply className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Write like me</p>
          <p className="text-[13px] text-ink-soft mt-0.5">
            {/* Shortened in the #16 cut (founder, 2026-10-05, A-094). */}
            Learns your style from the Gmail replies you sent this past year. Only your drafts use it. Turn it off to
            delete it.
          </p>
          {line && <p className="text-[13px] text-ink mt-1.5">{line}</p>}
          {error && (
            <p className="mt-1 text-[13px]" style={{ color: "var(--coral)" }}>
              {error}
            </p>
          )}
        </div>
        <Switch checked={!!state?.on} onChange={toggle} disabled={disabled} label="Write like me" />
      </div>
    </div>
  );
}
