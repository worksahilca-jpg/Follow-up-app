"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

/**
 * "Needs your OK" — research/product/2026-09-10-ux-simplification.md
 * §0.6 and §8, implementation plan item #1. This is the missing screen
 * that answers "what needs my OK right now": every lead whose most
 * recent AI decision is a held draft (src/lib/pendingApprovals.ts), each
 * with the actual drafted reply inline and a one-click resolution —
 * Approve & send, Edit (goes to the full lead page), or Don't send.
 *
 * Reuses the same POST /api/leads/[id]/send that a human clicking
 * "Send now" in MessageComposer already uses — approving here IS sending
 * the exact drafted text, nothing new to trust.
 */

export type ApprovalItem = {
  leadId: string;
  leadName: string;
  reason: string;
  draftSubject: string | null;
  draftMessage: string;
};

function ApprovalCard({ item, onResolved }: { item: ApprovalItem; onResolved: (leadId: string) => void }) {
  const [busy, setBusy] = useState<"send" | "dismiss" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function approveAndSend() {
    setBusy("send");
    setError(null);
    try {
      const res = await fetch(`/api/leads/${item.leadId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.draftSubject ? { message: item.draftMessage, subject: item.draftSubject } : { message: item.draftMessage }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "Send failed.");
      onResolved(item.leadId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed.");
      setBusy(null);
    }
  }

  async function dontSend() {
    setBusy("dismiss");
    setError(null);
    try {
      const res = await fetch(`/api/leads/${item.leadId}/dismiss-hold`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't dismiss it.");
      onResolved(item.leadId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't dismiss it.");
      setBusy(null);
    }
  }

  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/leads/${item.leadId}`} className="font-medium hover:underline">
          {item.leadName}
        </Link>
      </div>
      <div className="mt-2 rounded-lg border border-line bg-paper p-3 text-sm leading-relaxed">
        {item.draftSubject && <p className="font-medium mb-1">{item.draftSubject}</p>}
        <p className="text-ink-soft whitespace-pre-wrap">{item.draftMessage}</p>
      </div>
      {item.reason && <p className="text-xs text-ink-soft mt-1.5">Held because {item.reason.toLowerCase()}.</p>}
      {error && (
        <p className="text-xs mt-1.5" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button
          onClick={approveAndSend}
          disabled={busy !== null}
          className="rounded-lg px-3.5 py-1.5 text-sm font-medium disabled:opacity-60"
          style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
        >
          {busy === "send" ? "Sending…" : "Approve & send"}
        </button>
        <Link
          href={`/leads/${item.leadId}`}
          className="rounded-lg px-3.5 py-1.5 text-sm font-medium border border-line hover:bg-paper"
        >
          Edit
        </Link>
        <button
          onClick={dontSend}
          disabled={busy !== null}
          className="rounded-lg px-3.5 py-1.5 text-sm font-medium text-ink-soft hover:bg-paper disabled:opacity-60"
        >
          {busy === "dismiss" ? "…" : "Don't send"}
        </button>
      </div>
    </div>
  );
}

export default function ApprovalQueue({ items }: { items: ApprovalItem[] }) {
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const visible = items.filter((i) => !resolved.has(i.leadId));
  if (visible.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl border-2 overflow-hidden" style={{ borderColor: "var(--gold)" }}>
      <div className="flex items-center gap-2 px-5 py-3" style={{ backgroundColor: "var(--gold-soft)" }}>
        <ShieldAlert className="h-4 w-4" style={{ color: "var(--gold)" }} />
        <h2 className="font-display text-lg" style={{ color: "var(--ink)" }}>
          Needs your OK ({visible.length})
        </h2>
      </div>
      <div className="divide-y divide-line bg-card">
        {visible.map((item) => (
          <ApprovalCard key={item.leadId} item={item} onResolved={(leadId) => setResolved((prev) => new Set(prev).add(leadId))} />
        ))}
      </div>
    </div>
  );
}
