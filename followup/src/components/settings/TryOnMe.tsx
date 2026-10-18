"use client";

import { useState } from "react";
import { Check } from "lucide-react";

/**
 * "Try it on me first" (A-287, founder 2026-10-18: "build it for users too, so that they can try it themselves …
 * before switching to automatic"). Under "Who sends your replies?": one tap, and a practice customer writes to the
 * owner's own address and FollowUp answers by itself, while every real customer keeps waiting for the owner's OK.
 * POST /api/leads/test-lead with { tryOnMe: true }; the hold is lifted for that practice customer only
 * (acknowledgeNewLead's practiceForOwner).
 */
export default function TryOnMe({ box }: { box: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "other">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function tryIt() {
    setState("sending");
    setMessage(null);
    try {
      const res = await fetch("/api/leads/test-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tryOnMe: true }),
      });
      const data = await res.json().catch(() => ({}));
      setMessage(data.message ?? "Couldn't try it just now. Try again in a minute.");
      setState(data.success && data.sent ? "sent" : "other");
    } catch {
      setMessage("Couldn't try it just now. Try again in a minute.");
      setState("other");
    }
  }

  if (state === "sent") {
    return (
      <div className={box + " mt-3"} role="status">
        <div className="flex items-start gap-3 px-4 py-3.5">
          <span
            aria-hidden="true"
            className="mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
            style={{ background: "var(--ink)", color: "var(--paper)" }}
          >
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-semibold">Sent to you</p>
            <p className="mt-0.5 text-[14px] leading-snug text-ink-soft">{message}</p>
            <p className="mt-1.5 text-[14px] leading-snug text-ink-soft">Your real customers still wait for your OK.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={box + " mt-3"}>
      <div className="flex items-center gap-3.5 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold">Try it on me first</p>
          <p className="mt-0.5 text-[14px] leading-snug text-ink-soft">
            FollowUp writes to you like a customer, then answers you by itself. Nobody else gets anything.
          </p>
        </div>
        <button
          type="button"
          onClick={tryIt}
          disabled={state === "sending"}
          className="min-h-11 shrink-0 rounded-full border px-[18px] text-[15px] font-medium disabled:opacity-60"
          style={{ borderColor: "var(--line-strong)" }}
        >
          {state === "sending" ? "Sending…" : "Try it"}
        </button>
      </div>
      {state === "other" && message && (
        <p role="alert" className="px-4 pb-3.5 text-[14px] leading-snug text-ink-soft">
          {message}
        </p>
      )}
    </div>
  );
}
