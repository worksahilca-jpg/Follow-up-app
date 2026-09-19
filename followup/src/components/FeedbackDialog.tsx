"use client";

import { useState } from "react";
import { MessageSquare, X } from "lucide-react";

/**
 * "Tell us what broke" — one button in the sidebar, one box, one send.
 * Posts to the existing /api/feedback (the quiet form in Settings stays).
 * Beta testers have to be able to say what went wrong from any screen,
 * without hunting for it (founder, 2026-09-19: "users can test and we
 * will improve accordingly").
 */
export default function FeedbackDialog() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };
      if (!res.ok || !data.success) throw new Error(data.message || "Couldn't send — try again.");
      setText("");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          setSent(false);
        }}
        className="flex items-center gap-2.5 rounded-lg px-3 py-2 mx-3 text-sm text-ink-soft hover:bg-paper transition-colors"
      >
        <MessageSquare className="h-4 w-4" />
        Something broke?
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={() => setOpen(false)}
        >
          <div className="box-lift w-full max-w-md p-5" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Send feedback">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg">Tell us what went wrong</h2>
                <p className="text-sm text-ink-soft mt-1">
                  Or what you wish it did. Goes straight to the people building FollowUp.
                </p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-soft hover:bg-paper">
                <X className="h-4 w-4" />
              </button>
            </div>
            {sent ? (
              <p className="mt-4 text-sm">Thanks. We read every one of these.</p>
            ) : (
              <>
                <textarea
                  id="feedback-message"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  placeholder="What were you doing, and what happened?"
                  className="mt-4 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm"
                />
                {error && (
                  <p className="mt-2 text-sm" style={{ color: "var(--coral)" }}>
                    {error}
                  </p>
                )}
                <div className="mt-3 flex justify-end gap-2">
                  <button onClick={() => setOpen(false)} className="rounded-lg px-3.5 py-1.5 text-sm font-medium border border-line hover:bg-paper">
                    Not now
                  </button>
                  <button
                    onClick={send}
                    disabled={busy || !text.trim()}
                    className="rounded-lg px-3.5 py-1.5 text-sm font-medium disabled:opacity-60"
                    style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
                  >
                    {busy ? "Sending…" : "Send"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
