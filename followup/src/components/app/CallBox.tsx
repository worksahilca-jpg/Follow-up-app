"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { telHref } from "@/lib/callPlan";

/**
 * The Call box on a customer's page (design brain A-103, the realtor team
 * pilot). Shown only when the business has "Your team calls customers" on
 * and the customer has a number to dial.
 *
 * Call is the one black button when nothing is waiting to be sent; when a
 * reply is waiting, Send keeps the black and Call steps back to an outline
 * (one black button per screen). After the call, one tap says what
 * happened: No answer (records it, plans the next call, and on the first
 * one writes a text asking for a good time, which waits for an OK), or
 * Already spoke (the same tap as everywhere else, now also counted as a
 * call). No confirm: Undo sits next to what was saved.
 */
export default function CallBox({
  leadId,
  leadName,
  phone,
  replyWaiting,
  lastCall,
  nextCallAt,
}: {
  leadId: string;
  leadName: string;
  phone: string;
  /** A reply is waiting for an OK on this page, so Send is the black button. */
  replyWaiting: boolean;
  /** The newest call someone tapped for, already worded ("No answer · Sam · Wed 2:14 PM"). */
  lastCall: string | null;
  /** "Thu 2:14 PM", or null when no call is planned. */
  nextCallAt: string | null;
}) {
  const router = useRouter();
  const first = leadName.split(" ")[0] || leadName;
  const [busy, setBusy] = useState<null | "no_answer" | "spoke" | "undo">(null);
  const [saved, setSaved] = useState<null | { kind: "no_answer" | "spoke"; note: string }>(null);
  const [error, setError] = useState<string | null>(null);

  async function post(url: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    setError(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(typeof data.message === "string" ? data.message : "Couldn't save that. Try again.");
        return null;
      }
      return data;
    } catch {
      setError("Couldn't reach FollowUp. Check your connection and try again.");
      return null;
    }
  }

  async function noAnswer() {
    setBusy("no_answer");
    const data = await post(`/api/leads/${leadId}/no-answer`, {});
    setBusy(null);
    if (!data) return;
    setSaved({ kind: "no_answer", note: typeof data.note === "string" ? data.note : "" });
    router.refresh();
  }

  async function spoke() {
    setBusy("spoke");
    const data = await post(`/api/leads/${leadId}/talked`, {});
    setBusy(null);
    if (!data) return;
    setSaved({ kind: "spoke", note: `FollowUp stops checking in until ${first} writes again.` });
    router.refresh();
  }

  async function undo() {
    if (!saved) return;
    setBusy("undo");
    const data = await post(saved.kind === "no_answer" ? `/api/leads/${leadId}/no-answer` : `/api/leads/${leadId}/talked`, { undo: true });
    setBusy(null);
    if (!data) return;
    setSaved(null);
    router.refresh();
  }

  const call = replyWaiting
    ? "inline-flex h-[44px] items-center rounded-full border border-line bg-card px-4 text-[15px] font-medium hover:bg-card-2"
    : "flex h-[52px] w-full items-center justify-center rounded-full bg-ink px-6 text-base font-semibold text-paper sm:inline-flex sm:w-auto";
  const pill = "inline-flex h-[44px] items-center rounded-full border border-line bg-card px-4 text-[15px] font-medium hover:bg-card-2 disabled:opacity-60";

  return (
    <section className="box p-5" aria-label={`Call ${first}`}>
      <a href={telHref(phone)} className={call}>
        Call {first} · {phone}
      </a>
      {(lastCall || nextCallAt) && (
        <p className="mt-3 text-[14px] text-ink-soft">
          {[lastCall ? `Last call: ${lastCall}` : null, nextCallAt ? `Next call: ${nextCallAt}` : null].filter(Boolean).join(" · ")}
        </p>
      )}
      {saved ? (
        <div role="status" className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14.5px]">
          <span>
            {saved.kind === "no_answer" ? "Saved: no answer." : "Saved: you spoke."} {saved.note}
          </span>
          <button type="button" onClick={undo} disabled={busy !== null} className="font-semibold underline underline-offset-4 disabled:opacity-60">
            {busy === "undo" ? "…" : "Undo"}
          </button>
        </div>
      ) : (
        <>
          <p className="mt-4 text-[13px] text-ink-soft">After the call, tap one</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={noAnswer} disabled={busy !== null} className={pill}>
              {busy === "no_answer" ? "…" : "No answer"}
            </button>
            <button type="button" onClick={spoke} disabled={busy !== null} className={pill} title={`You spoke with ${first}. FollowUp stops checking in until ${first} writes again.`}>
              {busy === "spoke" ? "…" : "Already spoke"}
            </button>
          </div>
        </>
      )}
      {error && (
        <p className="mt-3 text-[13px]" style={{ color: "var(--coral)" }} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
