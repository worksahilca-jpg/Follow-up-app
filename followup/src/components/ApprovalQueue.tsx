"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

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
 *
 * 2026-09-14 revisit (founder: dashboard reads as "weird" — layout,
 * density, this component, and color all flagged): the original
 * treatment wrapped this in a 2px --coral border under a --gold-soft
 * header band, with the lead's message and the draft each in their own
 * bordered box inside the card. Two things were wrong with that, not
 * just one:
 *   1. --coral/--gold read as an alarm — this is the routine, trusted,
 *      first thing an owner does every day, not an error state. It also
 *      quietly misused --gold outside "going cold," which A-005 already
 *      says it's reserved for ("gold... stays reserved for 'going cold'
 *      alone" — design-brain/decisions/approved.md).
 *   2. said-box-in-draft-box-in-2px-bordered-card is exactly the
 *      "card-in-card soup" design-brain/decisions/rejected.md calls out
 *      as S-09 — a symptom of unresolved hierarchy, not a design choice.
 * Fixed by matching the same calm, borderless-item list treatment every
 * other dashboard section already uses (divide-y rows, no nested boxes,
 * no status-color border) — the queue earns attention by sitting first
 * on the page and by what it says, not by looking like a warning.
 */

export type ApprovalItem = {
  leadId: string;
  leadName: string;
  reason: string;
  draftSubject: string | null;
  draftMessage: string;
  leadLastMessage: string | null;
  leadLastMessageChannel: string | null;
};

const CHANNEL_LABEL: Record<string, string> = {
  email: "email",
  call: "a call",
  text: "text",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
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
      {/* What they actually said, before what we're about to reply with —
          approving a draft with no visible context for what it's replying
          to meant trusting the AI's summary of the situation ("reason")
          instead of judging the reply against the lead's own words. This
          is the whole reason to review a hold at all, so it goes first.
          Previously each of these was its own bordered box (dashed, then
          solid) inside this already-bordered card — a nested-card look
          the design brain's S-09 explicitly names. A single divider
          between the two keeps the same "what they said, then what we'll
          say" distinction without stacking boxes inside boxes. */}
      {item.leadLastMessage && (
        <div className="mt-3 text-sm leading-relaxed">
          <p className="text-xs font-medium text-ink-soft">
            {item.leadName.split(" ")[0]} said, over {CHANNEL_LABEL[item.leadLastMessageChannel ?? ""] ?? "message"}:
          </p>
          <p className="text-ink whitespace-pre-wrap mt-1">{item.leadLastMessage}</p>
        </div>
      )}
      <div className="mt-3 pt-3 border-t border-line text-sm leading-relaxed">
        <p className="text-xs font-medium text-ink-soft">The draft reply:</p>
        {item.draftSubject && <p className="font-medium mt-1">{item.draftSubject}</p>}
        <p className="text-ink-soft whitespace-pre-wrap mt-1">{item.draftMessage}</p>
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
    <div className="mt-6">
      <h2 className="font-display text-xl flex items-center gap-2">
        <ShieldCheck className="h-4 w-4" style={{ color: "var(--ink)" }} />
        Needs your OK ({visible.length})
      </h2>
      <p className="text-sm text-ink-soft mt-1">
        FollowUp drafted these already — approve to send exactly what&apos;s shown, or edit it first.
      </p>
      <div className="mt-4 rounded-xl border border-line bg-card divide-y divide-line overflow-hidden">
        {visible.map((item) => (
          <ApprovalCard key={item.leadId} item={item} onResolved={(leadId) => setResolved((prev) => new Set(prev).add(leadId))} />
        ))}
      </div>
    </div>
  );
}
