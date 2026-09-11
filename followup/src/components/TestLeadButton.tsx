"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

/**
 * "Send a test lead to myself" — research/product/2026-09-10-ux-
 * simplification.md §3: the only way to demonstrate the core promise to
 * a business whose real inbox is quiet right now. Hits
 * POST /api/leads/test-lead, which runs the real instant-ack path
 * against the owner's own address (see that route's own doc comment).
 */
export default function TestLeadButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function send() {
    setState("sending");
    setMessage(null);
    try {
      const res = await fetch("/api/leads/test-lead", { method: "POST" });
      const data = await res.json();
      setMessage(data.message ?? (data.success ? "Done." : "Something went wrong — try again."));
      setState("done");
      if (data.success) router.refresh(); // the lead now exists — let the page pick it up
    } catch {
      setMessage("Something went wrong — try again.");
      setState("done");
    }
  }

  return (
    <div className="flex flex-col items-center text-center">
      <button
        onClick={send}
        disabled={state === "sending"}
        className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium border border-line disabled:opacity-60"
      >
        <Sparkles className="h-4 w-4" style={{ color: "var(--rust)" }} />
        {state === "sending" ? "Sending…" : "Send a test lead to myself"}
      </button>
      {message && <p className="text-xs text-ink-soft mt-2 max-w-xs">{message}</p>}
    </div>
  );
}
