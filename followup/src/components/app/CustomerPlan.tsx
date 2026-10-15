"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PlanId } from "@/lib/followUpPlans";

/**
 * The customer's follow-up plan on their page (A-245, as drawn): "On the
 * Fast plan · Change plan", then one sentence. "Change plan" opens the
 * choice in place: the three plans as pills (one black, the one they're
 * on), "Let FollowUp pick" once the owner has picked, and "Don't wait" while
 * FollowUp is holding for a day the customer asked for.
 */
export default function CustomerPlan({
  leadId,
  firstName,
  title,
  sentence,
  plan,
  picked,
  ownExists,
  waitingFor,
  staying = false,
  moment = null,
  bordered = false,
}: {
  leadId: string;
  firstName: string;
  title: string;
  sentence: string;
  plan: PlanId;
  picked: boolean;
  ownExists: boolean;
  waitingFor: string | null;
  /** Staying in touch (A-260): "Change" offers to stop the notes, not a plan. */
  staying?: boolean;
  /** "Their moment" (A-262): their words and when FollowUp brings them up; "Change" picks another day, or none. */
  moment?: { quote: string; when: string; at: number } | null;
  /** Inside the "where they stand" card: a hairline above, as drawn. */
  bordered?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [momentOpen, setMomentOpen] = useState(false);
  const [momentDay, setMomentDay] = useState(moment ? new Date(moment.at).toISOString().slice(0, 10) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  async function save(body: { plan?: PlanId | null; stopWaiting?: true; stayInTouch?: false; moment?: string | null }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/plan`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const out = await res.json();
      if (!out.success) throw new Error(out.message ?? "Couldn’t change it. Try again.");
      setOpen(false);
      setMomentOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t change it. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const options: [PlanId, string][] = [
    ["fast", "Fast"],
    ["long", "Long"],
    ...(ownExists ? ([["own", "My own"]] as [PlanId, string][]) : []),
  ];

  return (
    <div className={bordered ? "mt-3 border-t border-line-2 pt-3" : ""}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[14.5px] font-semibold">{title}</span>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="-my-3 inline-flex min-h-11 shrink-0 items-center text-[13.5px] underline underline-offset-[3px] hover:text-ink-soft"
        >
          {open ? "Close" : staying ? "Change" : "Change plan"}
        </button>
      </div>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">{sentence}</p>
      {/* "Their moment" (A-262), as drawn: their words, then when FollowUp brings them up, with Change. */}
      {moment && (
        <div className="mt-3 border-t border-line-2 pt-3">
          <p className="text-[13px] text-ink-soft">{firstName}’s moment</p>
          <p className="mt-1 font-read text-[15px] leading-snug">“{moment.quote}”</p>
          <p className="mt-1 text-[14px] leading-snug text-ink-soft">
            FollowUp brings {firstName} up on Today {moment.when}, with a note about it.{" "}
            <button
              type="button"
              aria-expanded={momentOpen}
              onClick={() => setMomentOpen(!momentOpen)}
              className="inline-flex min-h-11 items-center underline underline-offset-[3px] hover:text-ink"
            >
              {momentOpen ? "Close" : "Change"}
            </button>
          </p>
          {momentOpen && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <label htmlFor={`moment-day-${leadId}`} className="text-[13.5px] text-ink-soft">
                Bring {firstName} up on
              </label>
              <input
                id={`moment-day-${leadId}`}
                type="date"
                min={today}
                value={momentDay}
                onChange={(e) => setMomentDay(e.target.value)}
                className="h-11 rounded-full border border-line-strong bg-card px-3 text-[14.5px]"
              />
              <button
                type="button"
                disabled={busy || !momentDay}
                onClick={() => save({ moment: momentDay })}
                className="inline-flex h-11 items-center rounded-full border border-line-strong bg-card px-4 text-[14.5px] hover:bg-card-2 disabled:opacity-60"
              >
                Save
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => save({ moment: null })}
                className="inline-flex min-h-11 items-center text-[13.5px] text-ink-soft underline underline-offset-[3px] hover:text-ink disabled:opacity-60"
              >
                No moment
              </button>
            </div>
          )}
          {momentOpen && error && (
            <p className="mt-1 text-[13px]" role="alert" style={{ color: "var(--coral)" }}>
              {error}
            </p>
          )}
        </div>
      )}
      {open && staying && (
        <div className="mt-2 grid gap-1">
          <p className="text-[13.5px] leading-snug text-ink-soft">FollowUp stops writing to {firstName}. If they write, you still get a reply ready, as always.</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => save({ stayInTouch: false })}
            className="inline-flex min-h-11 items-center justify-self-start text-[14px] underline underline-offset-[3px] hover:text-ink-soft disabled:opacity-60"
          >
            Stop staying in touch
          </button>
          {error && (
            <p className="text-[13px]" role="alert" style={{ color: "var(--coral)" }}>
              {error}
            </p>
          )}
        </div>
      )}
      {open && !staying && (
        <div className="mt-3 grid gap-1">
          <div role="group" aria-label={`Plan for ${firstName}`} className="flex flex-wrap gap-2">
            {options.map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={plan === id}
                disabled={busy}
                onClick={() => (plan === id && picked ? setOpen(false) : save({ plan: id }))}
                className={
                  "inline-flex h-11 items-center rounded-full px-4 text-[14.5px] disabled:opacity-60 " +
                  (plan === id ? "bg-ink font-semibold text-on-accent" : "border border-line-strong bg-card text-ink hover:bg-card-2")
                }
              >
                {label}
              </button>
            ))}
          </div>
          {picked && (
            <button type="button" disabled={busy} onClick={() => save({ plan: null })} className="inline-flex min-h-11 items-center justify-self-start text-[13.5px] text-ink-soft underline underline-offset-[3px] hover:text-ink">
              Let FollowUp pick
            </button>
          )}
          {waitingFor && (
            <button type="button" disabled={busy} onClick={() => save({ stopWaiting: true })} className="inline-flex min-h-11 items-center justify-self-start text-[13.5px] text-ink-soft underline underline-offset-[3px] hover:text-ink">
              Don’t wait for {waitingFor}
            </button>
          )}
          {error && (
            <p role="alert" className="text-[13.5px] text-coral">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
