"use client";

import { useState } from "react";
import { Sparkles, Send, RotateCcw } from "lucide-react";

export default function MessageComposer({
  leadId,
  initialMessage,
  initialHoldReason,
  leadName,
}: {
  leadId: string;
  initialMessage: string;
  initialHoldReason?: string | null;
  leadName: string;
}) {
  const [message, setMessage] = useState(initialMessage);
  const [holdReason, setHoldReason] = useState(initialHoldReason ?? null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function regenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/regenerate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "Regeneration failed.");
      setMessage(data.message);
      // Matches the backend: a freshly regenerated draft hasn't been risk-
      // assessed yet, so whatever reason the old one was held for no longer
      // describes it.
      setHoldReason(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regeneration failed.");
    } finally {
      setRegenerating(false);
    }
  }

  async function send() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "Send failed.");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <section>
        <h2 className="font-display text-xl">AI-suggested follow-up</h2>
        <div className="mt-3 rounded-lg border border-line p-4 text-sm" style={{ backgroundColor: "var(--sage-soft)", color: "var(--sage)" }}>
          Sent to {leadName} for real, via Gmail.
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="font-display text-xl flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-ink-soft" />
        AI-suggested follow-up
      </h2>
      <p className="text-xs text-ink-soft mt-1">
        FollowUp drafted this based on your conversation. Nothing sends without your approval.
      </p>
      {holdReason && (
        <p
          className="mt-2 rounded-lg border border-line px-3 py-2 text-xs"
          style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}
        >
          Why this is waiting on you: {holdReason}
        </p>
      )}
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        className="mt-3 w-full rounded-lg border border-line bg-card p-3 text-sm leading-relaxed"
      />
      {error && (
        <p className="mt-2 text-xs" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={send}
          disabled={sending || regenerating || !message.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60"
          style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
        >
          <Send className="h-3.5 w-3.5" /> {sending ? "Sending…" : "Send now"}
        </button>
        <button
          onClick={regenerate}
          disabled={sending || regenerating}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium disabled:opacity-60"
        >
          <RotateCcw className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
          {regenerating ? "Regenerating…" : "Regenerate"}
        </button>
      </div>
    </section>
  );
}
