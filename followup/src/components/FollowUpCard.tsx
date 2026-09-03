"use client";

import { useState } from "react";
import Link from "next/link";
import { Lead } from "@/lib/types";
import ScoreBadge from "./ScoreBadge";
import PriorityPill from "./PriorityPill";
import { formatCurrency } from "@/lib/demo-data";
import { Mail, Phone, Clock, Check } from "lucide-react";

export default function FollowUpCard({ lead }: { lead: Lead }) {
  const [status, setStatus] = useState<"pending" | "done" | "snoozed">("pending");
  const [busy, setBusy] = useState<"snooze" | "complete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "snooze" | "complete") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message ?? "Couldn't update — try again.");
      setStatus(action === "snooze" ? "snoozed" : "done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update — try again.");
    } finally {
      setBusy(null);
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-xl border border-line bg-card px-5 py-4 flex items-center gap-3 opacity-60">
        <Check className="h-4 w-4" style={{ color: "var(--sage)" }} />
        <p className="text-sm text-ink-soft">
          Marked {lead.name} as followed up.
        </p>
      </div>
    );
  }

  if (status === "snoozed") {
    return (
      <div className="rounded-xl border border-line bg-card px-5 py-4 flex items-center gap-3 opacity-60">
        <Clock className="h-4 w-4" style={{ color: "var(--slate)" }} />
        <p className="text-sm text-ink-soft">Snoozed {lead.name} until tomorrow.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <div className="flex items-start gap-4">
        <ScoreBadge score={lead.score} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <Link href={`/leads/${lead.id}`} className="font-display text-lg hover:underline">
              {lead.name}
            </Link>
            <span className="text-sm font-medium tabular-nums whitespace-nowrap" style={{ color: "var(--gold)" }}>
              {formatCurrency(lead.dealValue)}
            </span>
          </div>
          <p className="text-sm text-ink-soft">{lead.company}</p>
          <div className="mt-2">
            <PriorityPill priority={lead.priority} />
          </div>
          <p className="text-sm mt-3 text-ink-soft leading-relaxed">{lead.scoreReason}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/leads/${lead.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium"
              style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
            >
              <Mail className="h-3.5 w-3.5" /> Review &amp; send
            </Link>
            {lead.phone && (
              <a
                href={`tel:${lead.phone}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium"
              >
                <Phone className="h-3.5 w-3.5" /> Call
              </a>
            )}
            <button
              onClick={() => act("snooze")}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft disabled:opacity-60"
            >
              <Clock className="h-3.5 w-3.5" /> {busy === "snooze" ? "Snoozing…" : "Snooze until tomorrow"}
            </button>
            <button
              onClick={() => act("complete")}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" /> {busy === "complete" ? "Marking…" : "Mark complete"}
            </button>
          </div>
          {error && (
            <p className="text-xs mt-2" style={{ color: "var(--coral)" }}>
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
