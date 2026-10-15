"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { MEETING_ANSWERS, outcomeWords, type MeetingOutcome } from "@/lib/meetingOutcome";

export type MeetingToLookBackOn = {
  bookingId: string;
  leadId: string;
  /** The customer's full name and first name. */
  name: string;
  first: string;
  /** "yesterday at 2:00 PM", on the owner's clock. */
  when: string;
  /** The plan that carries on for someone still deciding: "Fast". */
  plan: string;
  /** Answered today already: the card opens on its answer, with Undo. */
  outcome: MeetingOutcome | null;
};

/**
 * "How did it go?" (A-263): the day after a booked call, one question with
 * four answers, 2×2 on a phone. One tap ends the conversation the right
 * way (src/lib/meetingOutcomeData.ts); the card then says what FollowUp
 * does now, with Undo. The box has the ink edge of the thing to do first.
 */
export default function MeetingOutcomeCard({ meeting }: { meeting: MeetingToLookBackOn }) {
  const router = useRouter();
  const [picked, setPicked] = useState<MeetingOutcome | null>(meeting.outcome);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { first } = meeting;

  async function post(body: Record<string, unknown>): Promise<{ success: boolean; message?: string; note?: string | null }> {
    const res = await fetch(`/api/leads/${meeting.leadId}/meeting`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: meeting.bookingId, ...body }),
    });
    return res.json().catch(() => ({ success: false, message: "Something went wrong. Try again." }));
  }

  async function pick(outcome: MeetingOutcome) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const out = await post({ outcome });
    setBusy(false);
    if (!out.success) {
      setError(out.message ?? "Something went wrong. Try again.");
      return;
    }
    setPicked(outcome);
    setNote(out.note ?? null);
    router.refresh();
  }

  async function undo() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const out = await post({ undo: true });
    setBusy(false);
    if (!out.success) {
      setError(out.message ?? "Something went wrong. Try again.");
      return;
    }
    setPicked(null);
    setNote(null);
    router.refresh();
  }

  if (picked) {
    const words = outcomeWords(picked, first, meeting.plan);
    return (
      <section aria-label={`How it went with ${first}`} className="box p-4 sm:p-5" style={{ borderColor: "var(--ink)" }}>
        <p className="text-[13px] text-ink-soft">After your call</p>
        <p className="mt-1 text-[16px] font-semibold leading-snug">{words.headline}</p>
        <p className="mt-1.5 text-[15px] leading-snug">{words.body}</p>
        {note && <p className="mt-1.5 text-[14px] leading-snug text-ink-soft">{note}</p>}
        {error && <p className="mt-1.5 text-[14px] text-coral">{error}</p>}
        <button
          type="button"
          onClick={undo}
          disabled={busy}
          className="mt-2 inline-flex min-h-11 items-center text-[14px] text-ink-soft underline underline-offset-2 hover:text-ink disabled:opacity-60"
        >
          Undo
        </button>
      </section>
    );
  }

  return (
    <section aria-label={`How did it go with ${first}?`} className="box p-4 sm:p-5" style={{ borderColor: "var(--ink)" }}>
      <p className="text-[13px] text-ink-soft">After your call</p>
      <h2 className="mt-1 text-[18px] font-semibold leading-snug tracking-[-0.01em]">How did it go with {first}?</h2>
      <p className="mt-1 text-[14px] leading-snug text-ink-soft">
        You had a call with {meeting.name} {meeting.when}. One tap, and FollowUp does the rest.
      </p>
      <fieldset className="mt-3" disabled={busy}>
        <legend className="sr-only">How did it go with {first}?</legend>
        <div className="grid grid-cols-2 gap-2">
          {MEETING_ANSWERS.map((a) => (
            <button
              key={a.outcome}
              type="button"
              onClick={() => pick(a.outcome)}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-line bg-card px-3 text-center text-[14px] leading-tight text-ink transition-colors hover:bg-card-2 disabled:opacity-60"
            >
              {busy ? <Check size={14} strokeWidth={2.4} aria-hidden="true" className="opacity-0" /> : null}
              {a.label}
            </button>
          ))}
        </div>
      </fieldset>
      {error && <p className="mt-2 text-[14px] text-coral">{error}</p>}
    </section>
  );
}
