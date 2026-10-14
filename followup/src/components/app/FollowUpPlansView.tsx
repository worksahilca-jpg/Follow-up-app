"use client";

import { useId, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import {
  FAST_DAYS,
  MAX_PLAN_DAY,
  MAX_PLAN_DAYS,
  MIN_PLAN_DAY,
  PLAN_IDS,
  PLAN_NAMES,
  planDays,
  planDaysText,
  planRows,
  usedFor,
  type FollowUpPlans,
  type OwnPlan,
  type PlanId,
} from "@/lib/followUpPlans";

/**
 * The follow-up plans window (A-245, drawn and approved 2026-10-14): Fast,
 * Long and My own in the ready-plan pattern the page already had (day |
 * what; side by side on a computer, one open at a time on a phone, R-015),
 * the four rules on every plan, and the editor behind "Change the days" and
 * "Set up my own". The days and their words come from src/lib/followUpPlans.ts,
 * the same module the engine sends from.
 */

export type PlansData = {
  plans: FollowUpPlans;
  counts: Record<PlanId, number>;
  realtor: boolean;
  holdAll: boolean;
  isAdmin: boolean;
};

const WHO: Record<PlanId, string> = {
  fast: "For customers who might move soon.",
  long: "For customers 6+ months away, or just looking.",
  own: "You pick the days.",
};

/** "Used for most customers · 9 now", "Only when you pick it · 2 now", "Not set up". */
function usage(data: PlansData, id: PlanId): string {
  if (id === "own" && !data.plans.own) return "Not set up";
  const who = usedFor(data.plans)[id];
  const words = who === "most" ? "Used for most customers" : who === "later" ? "Used for Later customers" : "Only when you pick it";
  // "17 now" stays together, so a narrow card never leaves "now" alone.
  return `${words} · ${data.counts[id]}\u00a0now`;
}

/** The phone's folded line: what the plan is, then whom it's for. */
function folded(data: PlansData, id: PlanId): string {
  if (id === "own" && !data.plans.own) return "You pick the days · not set up";
  const days = planDaysText(data.plans, id);
  const short = usage(data, id).replace("Used for m", "M").replace("Used for L", "L");
  return `${days[0].toUpperCase()}${days.slice(1)} · ${short}`;
}

function buttonLabel(data: PlansData, id: PlanId): string {
  if (id !== "own") return "Change the days";
  return data.plans.own ? "Change my plan" : "Set up my own";
}

function Rows({ data, id, first }: { data: PlansData; id: PlanId; first?: boolean }) {
  if (id === "own" && !data.plans.own) {
    return (
      <p className="mt-1 text-[14.5px] leading-relaxed text-ink-soft">
        Choose the days and what happens after the last one. FollowUp still writes each message from the conversation.
      </p>
    );
  }
  return (
    <ul>
      {planRows(data.plans, id, data.realtor).map((r, i) => (
        <li key={r.day} className={"flex gap-3.5 py-[11px] " + (i === 0 && first ? "" : "border-t border-line-2")}>
          <span className="w-[68px] shrink-0 text-[14px] font-semibold tabular-nums">{r.day}</span>
          <span className="text-[14.5px] leading-snug text-ink-soft">{r.what}</span>
        </li>
      ))}
    </ul>
  );
}

const OUTLINED = "inline-flex h-11 w-full items-center justify-center rounded-full border border-line-strong bg-card px-4 text-[15px] font-semibold text-ink hover:bg-card-2";

/** Fast, Long and My own: three cards on a computer, one list with one plan open on a phone. */
export function PlansOverview({ data, onEdit }: { data: PlansData; onEdit: (id: PlanId) => void }) {
  const [open, setOpen] = useState<PlanId | "">("fast");
  return (
    <>
      <div className="hidden gap-3 lg:grid lg:grid-cols-3">
        {PLAN_IDS.map((id) => (
          <div key={id} className="flex flex-col rounded-[18px] border border-line bg-card p-5">
            <p className="text-base font-semibold">{PLAN_NAMES[id]}</p>
            <p className="mt-0.5 min-h-9 text-[13px] leading-snug text-ink-faint">{WHO[id]}</p>
            <div className="mt-2.5 flex-1">
              <Rows data={data} id={id} first />
            </div>
            <p className="mb-3 mt-2.5 text-[13px] text-ink-soft">{usage(data, id)}</p>
            {data.isAdmin && (
              <button type="button" onClick={() => onEdit(id)} className={OUTLINED}>
                {buttonLabel(data, id)}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-[18px] border border-line bg-card lg:hidden">
        {PLAN_IDS.map((id, i) => {
          const isOpen = open === id;
          return (
            <div key={id} className={i ? "border-t border-line-2" : ""}>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`plan-${id}`}
                onClick={() => setOpen(isOpen ? "" : id)}
                className="flex min-h-16 w-full items-center gap-2.5 px-4 py-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold">{PLAN_NAMES[id]}</span>
                  <span className="mt-0.5 block text-[13.5px] leading-snug text-ink-faint">
                    {isOpen ? `${WHO[id]} ${usage(data, id)}` : folded(data, id)}
                  </span>
                </span>
                <ChevronDown
                  aria-hidden
                  className="h-[18px] w-[18px] shrink-0 transition-transform motion-reduce:transition-none"
                  style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)", color: isOpen ? "var(--ink)" : "var(--ink-faint)" }}
                />
              </button>
              {isOpen && (
                <div id={`plan-${id}`} className="px-4 pb-4">
                  <Rows data={data} id={id} />
                  {data.isAdmin && (
                    <div className="pt-1.5">
                      <button type="button" onClick={() => onEdit(id)} className={OUTLINED}>
                        {buttonLabel(data, id)}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

const RULES = [
  "Stops when they book, reply or say no.",
  "Stops 6 months after their last message. If they write again, it starts again.",
  "Never more than 1 message a day, or 3 a week, to one customer.",
  "If they say when to come back (“try me in March”), nothing goes out before then.",
];

/** The four rules no plan can change (A-245), said once, under the plans. */
export function EveryPlanBox({ holdAll }: { holdAll: boolean }) {
  return (
    <div className="rounded-[16px] border border-line bg-card px-4 py-3.5 lg:max-w-[760px] lg:px-5 lg:py-4">
      <p className="mb-1.5 text-[15px] font-semibold">On every plan</p>
      <ul>
        {RULES.map((r) => (
          <li key={r} className="flex gap-2.5 py-[7px] text-[14.5px] leading-snug">
            <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-sage" strokeWidth={2.4} />
            <span>{r}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-faint">
        {holdAll
          ? "Each message follows your “Replies and check-ins” setting: right now every one waits for your OK."
          : "Each message follows your “Replies and check-ins” setting: FollowUp sends them itself, and a price, a date or anything unsure waits for your OK."}
      </p>
    </div>
  );
}

const PILL_ON = "bg-ink text-on-accent font-semibold";
const PILL_OFF = "border border-line-strong bg-card text-ink hover:bg-card-2";

function Pills<T extends string>({ label, options, value, onChange }: { label: string; options: [T, string][]; value: T; onChange: (v: T) => void }) {
  const id = useId();
  return (
    <>
      <p id={id} className="mb-2.5 mt-[22px] text-[13.5px] text-ink-soft">
        {label}
      </p>
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-2">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={"inline-flex h-11 items-center rounded-full px-4 text-[14.5px] " + (value === v ? PILL_ON : PILL_OFF)}
          >
            {text}
          </button>
        ))}
      </div>
    </>
  );
}

/**
 * "Change the days" (Fast, Long) and "Set up my own" (My own), as drawn
 * for My own: the days as chips with ×, "+ Add a day", and for My own what
 * happens after the last day and whom it is for. One black button.
 */
export function PlanEditor({
  which,
  data,
  onSaved,
  onCancel,
}: {
  which: PlanId;
  data: PlansData;
  onSaved: (plans: FollowUpPlans, counts: Record<PlanId, number>) => void;
  onCancel: () => void;
}) {
  const start = which === "own" ? data.plans.own?.days ?? [2, 5, 10, 21] : planDays(data.plans, which).days;
  const [days, setDays] = useState<number[]>([...start]);
  const [after, setAfter] = useState<OwnPlan["after"]>(data.plans.own?.after ?? "monthly");
  const [useFor, setUseFor] = useState<OwnPlan["useFor"]>(data.plans.own?.useFor ?? "picked");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputId = useId();

  function add() {
    const n = Number(draft);
    if (!Number.isInteger(n) || n < MIN_PLAN_DAY || n > MAX_PLAN_DAY) return setError(`Pick a day from ${MIN_PLAN_DAY} to ${MAX_PLAN_DAY}.`);
    if (days.includes(n)) return setError(`Day ${n} is already there.`);
    if (days.length >= MAX_PLAN_DAYS) return setError(`${MAX_PLAN_DAYS} days at most. After that, “once a month” carries on.`);
    setDays([...days, n].sort((a, b) => a - b));
    setDraft("");
    setAdding(false);
    setError(null);
  }

  async function save(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/follow-up-plans", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const out = await res.json();
      if (!out.success) throw new Error(out.message ?? "Couldn’t save. Try again.");
      onSaved(out.plans, out.counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const changed = which !== "own" && Boolean(data.plans[which]);
  const intro =
    which === "own"
      ? "Pick the days. FollowUp writes each message from the conversation, so every one says something new."
      : which === "fast"
        ? "Pick the days. FollowUp writes each message from the conversation, so every one says something new."
        : "Pick the first days. After the last one, FollowUp writes once a month, up to 6 months.";

  return (
    <div className="lg:max-w-[560px]">
      <button type="button" onClick={onCancel} className="inline-flex min-h-11 items-center text-[13px] text-ink-faint hover:text-ink">
        ← Follow-up plans
      </button>
      <h1 className="title-serif mt-1 text-[30px] leading-[1.12] lg:text-[34px]">{which === "own" ? "My own plan" : `${PLAN_NAMES[which]} plan`}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{intro}</p>

      <p className="mb-2.5 mt-[22px] text-[13.5px] text-ink-soft">Days after they go quiet</p>
      <ul className="flex flex-wrap gap-2" aria-label="Days">
        {days.map((d) => (
          <li key={d} className="inline-flex h-11 items-center rounded-full border border-line-strong bg-card pl-3.5 text-[15px] font-semibold tabular-nums">
            Day {d}
            <button
              type="button"
              aria-label={`Remove day ${d}`}
              disabled={days.length === 1}
              onClick={() => setDays(days.filter((x) => x !== d))}
              className="ml-0.5 grid h-11 w-10 place-items-center rounded-full text-ink-faint hover:text-ink disabled:opacity-40"
            >
              <X aria-hidden className="h-[15px] w-[15px]" strokeWidth={2.2} />
            </button>
          </li>
        ))}
        {!adding && days.length < MAX_PLAN_DAYS && (
          <li>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex h-11 items-center rounded-full border border-dashed border-line-strong px-3.5 text-[15px] text-ink-soft hover:text-ink"
            >
              + Add a day
            </button>
          </li>
        )}
      </ul>
      {adding && (
        <div className="mt-3 flex items-center gap-2">
          <label htmlFor={inputId} className="text-[15px]">
            Day
          </label>
          <input
            id={inputId}
            type="number"
            inputMode="numeric"
            min={MIN_PLAN_DAY}
            max={MAX_PLAN_DAY}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
              if (e.key === "Escape") setAdding(false);
            }}
            className="h-11 w-20 rounded-[12px] border border-line-strong bg-card px-3 text-[15px] tabular-nums"
          />
          <button type="button" onClick={add} className="inline-flex h-11 items-center rounded-full border border-line-strong bg-card px-4 text-[15px] font-semibold hover:bg-card-2">
            Add
          </button>
          <button type="button" onClick={() => (setAdding(false), setError(null))} className="inline-flex min-h-11 items-center px-2 text-[14px] text-ink-soft">
            Cancel
          </button>
        </div>
      )}

      {which === "own" && (
        <>
          <Pills
            label="After the last day"
            value={after}
            onChange={setAfter}
            options={[
              ["stop", "Stop"],
              ["monthly", "Once a month, up to 6 months"],
            ]}
          />
          <Pills
            label="Use it for"
            value={useFor}
            onChange={setUseFor}
            options={[
              ["most", "Most customers"],
              ["later", "Later customers"],
              ["picked", "Only when I pick it"],
            ]}
          />
        </>
      )}
      {which === "long" && <p className="mt-4 text-[14px] text-ink-soft">Then once a month, up to 6 months, with the last one closing the loop.</p>}

      <p className="mt-[22px] text-[13.5px] leading-relaxed text-ink-faint">
        The rules on every plan still apply: it stops when they book, reply or say no, and never sends more than 1 a day or 3 a week.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-[14px] text-coral">
          {error}
        </p>
      )}
      <div className="mt-[22px] grid gap-1.5 lg:flex lg:items-center lg:gap-4">
        <button
          type="button"
          disabled={busy || days.length === 0}
          onClick={() => save(which === "own" ? { own: { days, after, useFor } } : { [which]: days })}
          className="h-[50px] w-full rounded-full bg-accent px-6 text-base font-semibold text-on-accent disabled:opacity-60 lg:w-auto"
        >
          {which === "own" ? "Save my plan" : "Save the days"}
        </button>
        <button type="button" onClick={onCancel} className="min-h-11 text-center text-[14px] text-ink-soft hover:text-ink">
          Cancel
        </button>
      </div>
      {(changed || (which === "own" && data.plans.own)) && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (which === "own" && !window.confirm("Delete your own plan? Customers on it go back to the plan FollowUp picks.")) return;
            save({ [which]: null });
          }}
          className="mt-3 inline-flex min-h-11 items-center text-[14px] text-ink-soft underline underline-offset-[3px] hover:text-ink"
        >
          {which === "own" ? "Delete my plan" : `Back to day ${FAST_DAYS.join(", ")}`}
        </button>
      )}
    </div>
  );
}
