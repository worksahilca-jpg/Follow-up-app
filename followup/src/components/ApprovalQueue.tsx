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
    <div className="box px-4 py-4">
      <Link href={`/leads/${item.leadId}`} className="font-medium hover:underline">
        {item.leadName}
      </Link>
      {/* The reason moves directly under the name, above everything else. It
          used to render last, at 12px, after the draft — but the reason is
          what tells you what to check the draft FOR. Reading it afterwards
          means re-reading the draft, or approving without having done the one
          piece of judgement you were asked for.

          Also no longer lowercased mid-sentence: `.toLowerCase()` on the most
          trust-critical string in the product mangled names and acronyms, and
          paired with a trailing period after a reason that already ended in
          one, it produced "Held because the lead asked about pricing.." */}
      {item.reason && (
        <p className="mt-1 text-xs text-ink-soft">
          Held because {item.reason.replace(/\.\s*$/, "")}.
        </p>
      )}
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

export default function ApprovalQueue({
  items,
  answeredForYou = 0,
}: {
  items: ApprovalItem[];
  /** Replies FollowUp sent on its own this week — what it did instead of asking. */
  answeredForYou?: number;
}) {
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const visible = items.filter((i) => !resolved.has(i.leadId));

  // An empty queue used to `return null`, so a good day rendered as a greeting,
  // three tiles and a link — and the screen read as broken rather than as calm.
  // This product had no way, anywhere, to say "all clear": silence looked
  // identical to something having gone wrong. An empty queue is a real state
  // and it is the state the owner most wants to be in, so it gets said out
  // loud, with what FollowUp did instead of asking.
  if (visible.length === 0) {
    return (
      <div className="mt-6">
        <div
          className="relative box py-3 pl-4 pr-3"
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-[3px] rounded-l-[var(--radius-box)]"
            style={{ backgroundColor: "var(--sage)" }}
          />
          <p className="text-sm font-medium">Nothing needs your OK right now.</p>
          <p className="mt-1 text-xs text-ink-soft">
            {answeredForYou > 0
              ? `FollowUp answered ${answeredForYou} ${answeredForYou === 1 ? "lead" : "leads"} on its own this week. Anything it wasn't sure about would be here.`
              : "Anything FollowUp isn't sure about will show up here before it sends."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h2 className="font-display text-xl flex items-center gap-2">
        <ShieldCheck className="h-4 w-4" style={{ color: "var(--ink)" }} />
        Needs your OK ({visible.length})
      </h2>
      <p className="text-sm text-ink-soft mt-1">
        FollowUp drafted these already — approve to send exactly what&apos;s shown, or edit it first.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {visible.map((item) => (
          <ApprovalCard key={item.leadId} item={item} onResolved={(leadId) => setResolved((prev) => new Set(prev).add(leadId))} />
        ))}
      </div>
    </div>
  );
}
