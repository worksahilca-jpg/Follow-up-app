"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { telHref } from "@/lib/callPlan";
import { Eyebrow, Initials } from "./canvasBits";

export type CallCard = {
  leadId: string;
  name: string;
  phone: string;
  /** "Facebook ad · 2nd call" */
  sub: string;
  /** The orange-dot line: what to do. "Call Priya again." */
  todo: string;
  /** The plain line under it, or null: what happened last. */
  last: string | null;
};

/**
 * "Calls to make" on Today (design brain A-103, the realtor team pilot):
 * the calls due now for this person. Each card is one decision: call, then
 * say what happened. The first card's Call is black only when nothing above
 * it already has the black button (one per screen).
 */
export default function CallsToMake({ items, firstIsPrimary }: { items: CallCard[]; firstIsPrimary: boolean }) {
  const shown = items.slice(0, 8);
  return (
    <section className="mb-7">
      <div className="mb-2.5">
        <Eyebrow>Calls to make · {items.length}</Eyebrow>
      </div>
      <div className="flex flex-col gap-3">
        {shown.map((c, i) => (
          <CallRow key={c.leadId} card={c} primary={firstIsPrimary && i === 0} />
        ))}
      </div>
      {items.length > shown.length && (
        <p className="mt-2 px-0.5 text-[13px] text-ink-faint">
          {items.length - shown.length} more after these. <Link href="/leads" className="underline underline-offset-4">See Customers</Link>
        </p>
      )}
    </section>
  );
}

function CallRow({ card, primary }: { card: CallCard; primary: boolean }) {
  const router = useRouter();
  const first = card.name.split(" ")[0] || card.name;
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<null | { kind: "no_answer" | "spoke" | "later"; note: string }>(null);
  const [error, setError] = useState<string | null>(null);

  async function post(url: string, body: Record<string, unknown>) {
    setError(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(typeof data.message === "string" ? data.message : "Couldn't save that. Try again.");
        return null;
      }
      return data as Record<string, unknown>;
    } catch {
      setError("Couldn't reach FollowUp. Check your connection and try again.");
      return null;
    }
  }

  async function act(kind: "no_answer" | "spoke" | "later") {
    setBusy(kind);
    const url = kind === "no_answer" ? `/api/leads/${card.leadId}/no-answer` : kind === "spoke" ? `/api/leads/${card.leadId}/talked` : `/api/leads/${card.leadId}/call-later`;
    const data = await post(url, {});
    setBusy(null);
    if (!data) return;
    const note =
      kind === "no_answer"
        ? typeof data.note === "string" ? data.note : "Saved: no answer."
        : kind === "spoke"
          ? `FollowUp stops checking in until ${first} writes again.`
          : `${first} is back here in 3 hours.`;
    setDone({ kind, note });
  }

  async function undo() {
    if (!done) return;
    setBusy("undo");
    const url = done.kind === "no_answer" ? `/api/leads/${card.leadId}/no-answer` : done.kind === "spoke" ? `/api/leads/${card.leadId}/talked` : `/api/leads/${card.leadId}/call-later`;
    const data = await post(url, { undo: true });
    setBusy(null);
    if (!data) return;
    setDone(null);
  }

  const callClass = primary
    ? "mt-5 flex h-[52px] w-full items-center justify-center rounded-full bg-ink text-base font-semibold text-paper sm:w-auto sm:px-8"
    : "mt-4 inline-flex h-[44px] items-center rounded-full border border-line bg-card px-5 text-[15px] font-medium hover:bg-card-2";
  const link = "inline-flex min-h-[44px] items-center px-1 text-[14.5px] text-ink-soft hover:text-ink disabled:opacity-60";

  return (
    <div className="box p-5">
      <Link href={`/leads/${card.leadId}`} className="flex items-center gap-3">
        <Initials name={card.name} size={40} />
        <span className="min-w-0">
          <span className="block font-medium">{card.name}</span>
          <span className="block text-[13px] text-ink-faint">{card.sub}</span>
        </span>
      </Link>
      {done ? (
        <div role="status" className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14.5px]">
          <span>{done.kind === "no_answer" ? `Saved: no answer. ${done.note}` : done.kind === "spoke" ? `Saved: you spoke. ${done.note}` : done.note}</span>
          <button type="button" onClick={undo} disabled={busy !== null} className="font-semibold underline underline-offset-4 disabled:opacity-60">
            {busy === "undo" ? "…" : "Undo"}
          </button>
          <button type="button" onClick={() => router.refresh()} className="text-ink-soft underline underline-offset-4">
            Next
          </button>
        </div>
      ) : (
        <>
          <p className="mt-4 text-[16px] leading-relaxed">
            <span aria-hidden className="mr-2 inline-block h-[7px] w-[7px] rounded-full align-[2px]" style={{ background: "var(--state-needs)" }} />
            {card.todo}
          </p>
          {card.last && <p className="mt-1.5 text-[14px] text-ink-soft">{card.last}</p>}
          <a href={telHref(card.phone)} className={callClass}>
            Call {first}
          </a>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 text-ink-faint">
            <button type="button" onClick={() => act("no_answer")} disabled={busy !== null} className={link}>
              {busy === "no_answer" ? "…" : "No answer"}
            </button>
            <span aria-hidden>·</span>
            <button type="button" onClick={() => act("spoke")} disabled={busy !== null} className={link}>
              {busy === "spoke" ? "…" : "Already spoke"}
            </button>
            <span aria-hidden>·</span>
            <button type="button" onClick={() => act("later")} disabled={busy !== null} className={link}>
              {busy === "later" ? "…" : "Later"}
            </button>
          </div>
        </>
      )}
      {error && (
        <p className="mt-3 text-[13px]" style={{ color: "var(--coral)" }} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
