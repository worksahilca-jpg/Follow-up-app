"use client";

/**
 * Workflow builder — create/edit/delete multi-step automated sequences
 * (see src/lib/sequences.ts for what a step actually does when it runs).
 * Enrolling a specific lead into one happens on that lead's own page, not
 * here — this page is only about defining the sequences themselves.
 *
 * Client-rendered like Settings: state lives in React, persisted via
 * fetch() to /api/sequences rather than server-rendered from a DB read,
 * since almost everything on this page is an edit in progress.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, ChevronUp, ChevronDown, Mail, ArrowRightLeft, Workflow as WorkflowIcon } from "lucide-react";
import { CARRIER_CHANNELS_AVAILABLE } from "@/lib/pricing";
import { READY_PLANS, toStepDelays, dayLabel, type ReadyPlan } from "@/lib/readyPlans";

type SequenceAction = "EMAIL" | "CHANGE_STAGE";

/**
 * What an email step actually falls back to — detectNonEmailChannel in
 * src/lib/sending.ts, named in the owner's words.
 *
 * Both sentences below used to say "sends a text instead", which was
 * wrong twice over. The fallback has never been SMS-only: an Instagram
 * lead gets an Instagram DM, a Messenger lead a Messenger message, a
 * WhatsApp lead a WhatsApp message — those are the channels most beta
 * leads actually arrive on. And SMS itself needs a phone number the
 * business cannot even set up right now: CARRIER_CHANNELS_AVAILABLE is
 * false, so Settings hides the panel, while twilio.ts still answers a
 * failed send with "check Settings → Phone" — a page that isn't there.
 * So "text" is listed only while that flag says it is offered.
 */
const FALLBACK_CHANNELS = CARRIER_CHANNELS_AVAILABLE
  ? "whichever channel they came in on — WhatsApp, Instagram, Messenger or text"
  : "whichever channel they came in on — WhatsApp, Instagram or Messenger";

interface StepDraft {
  /** Hours after the previous step (or after enrollment, for the first). */
  delayHours: number;
  action: SequenceAction;
  stageTo: string | null;
  messageHint: string;
}

interface SequenceSummary {
  id: string;
  name: string;
  active: boolean;
  enrolledCount: number;
  steps: { id: string; order: number; delayHours: number; action: SequenceAction; stageTo: string | null; messageHint: string | null }[];
}

/**
 * How a cumulative offset reads in the step list. People think about a
 * plan in days ("what happens on day 7"), which is what this showed before
 * the unit changed to hours — so whole days still read as "Day N", and only
 * a sub-day offset (the Instagram case: a touch at 3 h, another by 20 h,
 * inside Meta's window) shows hours at all. Nobody who never types an hour
 * sees the word.
 */
function describeOffset(hours: number): string {
  if (hours === 0) return "Right away";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} in`;
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return rest === 0 ? `Day ${days}` : `Day ${days}, +${rest}h`;
}

const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "PROPOSAL", label: "Proposal sent" },
  { value: "NEGOTIATION", label: "Negotiation" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
];

function blankStep(): StepDraft {
  return { delayHours: 72, action: "EMAIL", stageTo: null, messageHint: "" };
}

export default function WorkflowsPage() {
  const [sequences, setSequences] = useState<SequenceSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  // A ready plan being set up (A-044): pick one, change a day, save.
  const [picked, setPicked] = useState<ReadyPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Business.holdAllForApproval — true for every beta account.
  const [holdAllForApproval, setHoldAllForApproval] = useState(false);
  // Phone: one ready plan open at a time (A-066); "" = all closed.
  const [openPlan, setOpenPlan] = useState<string>(READY_PLANS[0]?.id ?? "");

  function load() {
    fetch("/api/sequences")
      .then((r) => r.json())
      .then((data: { success: boolean; sequences?: SequenceSummary[] }) => {
        if (data.success && data.sequences) setSequences(data.sequences);
      })
      .finally(() => setLoaded(true));
  }

  useEffect(load, []);

  // A second, tiny read, because this page sells a multi-step plan and on
  // a holding account the plan cannot run past its first message step:
  // runSequencesForBusiness drafts step 1, holds it, and UNENROLLS the
  // lead (src/lib/sequences.ts — "the workflow stopped here"). The
  // notification says so after the fact; nothing said so before, so a
  // tester built a four-touch plan that was never going to reach touch
  // two. Whether a workflow should resume after approval is a product
  // decision, not this page's to make — but not saying anything is not
  // neutral, it is a promise.
  useEffect(() => {
    fetch("/api/automation/settings")
      .then((r) => r.json())
      .then((data: { holdAllForApproval?: boolean }) => setHoldAllForApproval(Boolean(data.holdAllForApproval)))
      .catch(() => {});
  }, []);

  return (
    <div>
      {/* The third paragraph that used to sit here was the stop-on-reply
          guarantee — the single most trust-bearing sentence in the product,
          and PRODUCT_DIRECTION.md's Rule 3 — set as body copy in --ink-soft,
          third in a stack of three paragraphs nobody reads to the end. It has
          its own box below now.

          "Use recommended cadence" lost both its Sparkles icon (S-13 names
          sparkle icons specifically; it sat on a button whose action is
          "load a template", so it was pure decoration) and the word
          "cadence" — which is jargon this page's own h1, button and empty
          state all avoid by saying "plan". */}
      {/* Ready plans first (A-044, the Zapier study): pick one, change a
          day. The blank builder is a quiet link, not the main button. */}
      <Link href="/settings" className="text-[13px] text-ink-faint hover:text-ink">
        ← Settings
      </Link>
      <h1 className="title-serif mt-2 text-[30px] leading-[1.12] lg:text-[34px]">Follow-up plans</h1>
      {/* The stop-on-reply guarantee (PRODUCT_DIRECTION Rule 3) is said
          here, in the one sentence everyone reads, as drawn (A-066). */}
      <p className="mt-2 max-w-[640px] text-[15px] leading-relaxed text-ink-soft">
        Pick a plan and change a day if you want. Put someone on it from their page. It stops the moment they answer.
      </p>

      {!creating && !picked && (
        <div className="mt-6">
          {/* Desktop: the three plans side by side. */}
          <div className="hidden gap-3 lg:grid lg:grid-cols-3">
            {READY_PLANS.map((plan) => (
              <div key={plan.id} className="flex flex-col rounded-[18px] border border-line bg-card p-5">
                <p className="text-base font-medium">{plan.name}</p>
                <p className="mt-0.5 text-[13px] text-ink-faint">{plan.who}</p>
                <ul className="mt-3 flex-1">
                  {plan.steps.map((st) => (
                    <li key={st.day} className="flex gap-3 border-t border-line-2 py-2.5 text-sm">
                      <span className="w-20 shrink-0 whitespace-nowrap font-medium tabular-nums">{dayLabel(st.day)}</span>
                      <span className="text-ink-soft">{st.label}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setPicked(plan)}
                  className="mt-3 h-10 rounded-full border px-4 text-sm font-medium"
                  style={{ borderColor: "var(--line-strong)" }}
                >
                  Use this plan
                </button>
              </div>
            ))}
          </div>

          {/* Phone: one list, one plan open (R-015). */}
          <div className="overflow-hidden rounded-[18px] border border-line bg-card lg:hidden">
            {READY_PLANS.map((plan, i) => {
              const isOpen = openPlan === plan.id;
              return (
                <div key={plan.id} className={i ? "border-t border-line-2" : ""}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenPlan(isOpen ? "" : plan.id)}
                    className="flex min-h-16 w-full items-center gap-2.5 px-4 py-2.5 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-medium">{plan.name}</span>
                      <span className="mt-0.5 block text-[13.5px] text-ink-faint">
                        {isOpen ? plan.who : plan.steps.map((st) => dayLabel(st.day)).join(" · ")}
                      </span>
                    </span>
                    <ChevronDown
                      className="h-[18px] w-[18px] shrink-0 transition-transform"
                      style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)", color: isOpen ? "var(--ink)" : "var(--ink-faint)" }}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4">
                      {plan.steps.map((st) => (
                        <div key={st.day} className="flex gap-3.5 border-t border-line-2 py-[11px]">
                          <span className="w-16 shrink-0 text-sm font-medium tabular-nums">{dayLabel(st.day)}</span>
                          <span className="text-[14.5px] text-ink-soft">{st.label}</span>
                        </div>
                      ))}
                      <button
                        onClick={() => setPicked(plan)}
                        className="mt-2 h-[50px] w-full rounded-full text-base font-semibold"
                        style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                      >
                        Use this plan
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={() => setCreating(true)}
            className="mt-2 inline-flex min-h-11 items-center text-sm text-ink-soft underline underline-offset-[3px]"
          >
            Start from scratch instead
          </button>
        </div>
      )}

      {picked && (
        <ReadyPlanEditor
          plan={picked}
          holdAll={holdAllForApproval}
          onCancel={() => setPicked(null)}
          onSaved={(seq) => {
            setSequences((prev) => [...prev, seq]);
            setPicked(null);
          }}
          onError={setError}
        />
      )}

      {/* --slate, not --coral: nothing is broken and nothing is lost. It
          is a fact about how far a plan runs on this account, said before
          the owner builds one rather than in a notification afterwards. */}
      {holdAllForApproval && (
        <div className="mt-3 rounded-[12px] p-3" style={{ backgroundColor: "var(--slate-soft)" }}>
          <p className="text-sm font-medium" style={{ color: "var(--slate)" }}>
            On the beta plan, a plan runs one step at a time.
          </p>
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--slate)" }}>
            Your account holds every follow-up for your approval, so FollowUp writes the first message of the plan,
            puts it in Today, and stops there — it won&apos;t run the later steps on its own. The plan you build
            here is what runs once holding is lifted.
          </p>
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}

      {creating && (
        <div className="mt-6">
          <WorkflowEditor
            onCancel={() => setCreating(false)}
            onSaved={(seq) => {
              setSequences((prev) => [...prev, seq]);
              setCreating(false);
            }}
            onError={setError}
          />
        </div>
      )}

      <div className="mt-6 space-y-4">
        {loaded && sequences.length === 0 && !creating && !picked && (
          <div className="box p-8 text-center">
            <WorkflowIcon className="h-6 w-6 mx-auto text-ink-soft" />
            <p className="text-sm text-ink-soft mt-3">
              No plans yet. Pick one above.
            </p>
          </div>
        )}
        {sequences.map((seq) => (
          <WorkflowCard
            key={seq.id}
            sequence={seq}
            onUpdated={(updated) => setSequences((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))}
            onDeleted={(id) => setSequences((prev) => prev.filter((s) => s.id !== id))}
            onError={setError}
          />
        ))}
      </div>
    </div>
  );
}

function WorkflowCard({
  sequence,
  onUpdated,
  onDeleted,
  onError,
}: {
  sequence: SequenceSummary;
  onUpdated: (s: SequenceSummary) => void;
  onDeleted: (id: string) => void;
  onError: (msg: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleActive() {
    setBusy(true);
    try {
      const res = await fetch(`/api/sequences/${sequence.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !sequence.active }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      onUpdated(data.sequence);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't update — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${sequence.name}"? Enrolled leads will be unenrolled.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/sequences/${sequence.id}`, { method: "DELETE" });
      const data = await res.json();
      // The server's reason, as Pause/Activate already shows: a teammate
      // is told only an admin can do this, not to try again forever.
      if (!data.success) throw new Error(data.message ?? "Couldn't delete — try again.");
      onDeleted(sequence.id);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't delete — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <WorkflowEditor
        sequence={sequence}
        onCancel={() => setEditing(false)}
        onSaved={(updated) => {
          onUpdated(updated);
          setEditing(false);
        }}
        onError={onError}
      />
    );
  }

  return (
    <div className="box p-5">
      {/* Stacks below sm, and the title column gets min-w-0.
          Side by side at 390px, three shrink-0 buttons left the title about
          110px: "Cold reactivation — winter maintenance contracts" wrapped to
          one word per line, the Active/Paused pill floated into the middle of
          it, and the delete button sat 6px past the right edge of the screen.
          A destructive control you cannot fully see is the part that made
          this a fix rather than a nicety. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg">{sequence.name}</h3>
            <span
              className="text-[13px] font-medium rounded-full px-2 py-0.5"
              style={{
                backgroundColor: sequence.active ? "var(--sage-soft)" : "var(--line)",
                color: sequence.active ? "var(--sage)" : "var(--ink-soft)",
              }}
            >
              {sequence.active ? "Active" : "Paused"}
            </span>
          </div>
          <p className="text-[13px] text-ink-soft mt-1">
            {sequence.steps.length} step{sequence.steps.length === 1 ? "" : "s"} · {sequence.enrolledCount} lead
            {sequence.enrolledCount === 1 ? "" : "s"} enrolled
          </p>
        </div>
        <div className="flex items-center gap-2 sm:shrink-0">
          <button
            onClick={toggleActive}
            disabled={busy}
            className="text-[13px] font-medium rounded-full px-2.5 py-1.5 border border-line disabled:opacity-60"
          >
            {sequence.active ? "Pause" : "Activate"}
          </button>
          <button
            onClick={() => setEditing(true)}
            disabled={busy}
            className="text-[13px] font-medium rounded-full px-2.5 py-1.5 border border-line disabled:opacity-60"
          >
            Edit
          </button>
          {/* Icon-only, so it needs a name a screen reader can read out —
              and it is the one destructive control on the card. */}
          <button
            onClick={remove}
            disabled={busy}
            aria-label={`Delete ${sequence.name}`}
            className="text-[13px] font-medium rounded-full px-2.5 py-1.5 disabled:opacity-60"
            style={{ color: "var(--coral)" }}
          >
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Two changes here, both about the same confusion.

          One: the step line used to read "3d after enrollment" / "4d later" —
          gaps between steps — while the template hint above the editor said
          "(day 3, 7, 14, 30)", which is cumulative. Two mental models for the
          same plan, on the same screen. People think about a plan in
          cumulative days ("what happens on day 7"), so that is what shows;
          the stored delayHours stay gaps because that is what the scheduler
          runs on.

          Two: the channel-fallback rule was repeated inside every step, so
          four steps meant that same clause four times, three lines each. It
          is stated once, below the list. */}
      <ol className="mt-4 space-y-1.5">
        {sequence.steps.map((step, i) => {
          const hoursIn = sequence.steps.slice(0, i + 1).reduce((sum, s) => sum + s.delayHours, 0);
          return (
            <li key={step.id} className="flex items-start gap-2.5 text-sm">
              <span
                className="mt-0.5 shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[13px] font-semibold"
                style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}
              >
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="font-medium">
                  {describeOffset(hoursIn)} ·{" "}
                  {step.action === "EMAIL"
                    ? "Email"
                    : `Move to ${STAGE_OPTIONS.find((s) => s.value === step.stageTo)?.label ?? step.stageTo}`}
                </span>
                {step.action === "EMAIL" && step.messageHint && (
                  <span className="block text-ink-soft">{step.messageHint}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      {sequence.steps.some((s) => s.action === "EMAIL") && (
        <p className="mt-3 text-[13px] text-ink-soft">
          Email steps switch to {FALLBACK_CHANNELS} instead if the lead has no email address, or hasn&apos;t replied
          to an earlier email step.
        </p>
      )}
    </div>
  );
}

function WorkflowEditor({
  sequence,
  template,
  onCancel,
  onSaved,
  onError,
}: {
  sequence?: SequenceSummary;
  // Seeds a brand-new (unsaved) workflow's fields — distinct from
  // `sequence`, which means "editing an existing one" and PATCHes instead
  // of POSTing. Only one of the two is ever passed at once.
  template?: { name: string; steps: StepDraft[] };
  onCancel: () => void;
  onSaved: (s: SequenceSummary) => void;
  onError: (msg: string | null) => void;
}) {
  const [name, setName] = useState(sequence?.name ?? template?.name ?? "");
  const [steps, setSteps] = useState<StepDraft[]>(
    sequence
      ? sequence.steps.map((s) => ({ delayHours: s.delayHours, action: s.action, stageTo: s.stageTo, messageHint: s.messageHint ?? "" }))
      : (template?.steps ?? [blankStep()])
  );
  const [saving, setSaving] = useState(false);

  function updateStep(i: number, patch: Partial<StepDraft>) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function move(i: number, dir: -1 | 1) {
    setSteps((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function save() {
    onError(null);
    setSaving(true);
    try {
      const payload = {
        name,
        steps: steps.map((s) => ({
          delayHours: s.delayHours,
          action: s.action,
          stageTo: s.action === "CHANGE_STAGE" ? s.stageTo : null,
          messageHint: s.action === "EMAIL" && s.messageHint.trim() ? s.messageHint.trim() : null,
        })),
      };
      const res = await fetch(sequence ? `/api/sequences/${sequence.id}` : "/api/sequences", {
        method: sequence ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message ?? "Couldn't save — try again.");
      onSaved(data.sequence);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="box p-5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={'Plan name, e.g. "New customer"'}
        className="w-full rounded-full border border-line bg-paper px-3 py-2 text-sm font-medium"
      />

      <div className="mt-4 space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="rounded-[12px] border border-line p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[13px] text-ink-soft">
                <span
                  className="h-5 w-5 rounded-full flex items-center justify-center text-[11px] font-semibold"
                  style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}
                >
                  {i + 1}
                </span>
                <span>{i === 0 ? "hours after enrollment" : "hours after the previous step"}</span>
                <input
                  type="number"
                  min={0}
                  max={2160}
                  value={step.delayHours}
                  onChange={(e) => updateStep(i, { delayHours: Number(e.target.value) })}
                  className="w-16 rounded-[12px] border border-line bg-paper px-2 py-1 text-center"
                />
                {/* The same number in the unit most people actually plan in,
                    so "72" is never a sum they have to do in their head. */}
                {step.delayHours >= 24 && (
                  <span>
                    = {Math.floor(step.delayHours / 24)} day{Math.floor(step.delayHours / 24) === 1 ? "" : "s"}
                    {step.delayHours % 24 !== 0 ? ` ${step.delayHours % 24}h` : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="p-1 rounded disabled:opacity-30"
                  aria-label="Move step up"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === steps.length - 1}
                  className="p-1 rounded disabled:opacity-30"
                  aria-label="Move step down"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setSteps((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={steps.length === 1}
                  className="p-1 rounded disabled:opacity-30"
                  style={{ color: "var(--coral)" }}
                  aria-label="Remove step"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-2.5 flex rounded-[12px] border border-line overflow-hidden w-fit">
              <button
                onClick={() => updateStep(i, { action: "EMAIL" })}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium"
                style={{
                  backgroundColor: step.action === "EMAIL" ? "var(--rust)" : "transparent",
                  color: step.action === "EMAIL" ? "white" : "var(--ink-soft)",
                }}
              >
                <Mail className="h-3.5 w-3.5" /> Send email
              </button>
              <button
                onClick={() => updateStep(i, { action: "CHANGE_STAGE", stageTo: step.stageTo ?? "CONTACTED" })}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium"
                style={{
                  backgroundColor: step.action === "CHANGE_STAGE" ? "var(--rust)" : "transparent",
                  color: step.action === "CHANGE_STAGE" ? "white" : "var(--ink-soft)",
                }}
              >
                <ArrowRightLeft className="h-3.5 w-3.5" /> Change stage
              </button>
            </div>

            {step.action === "EMAIL" ? (
              <>
                <input
                  value={step.messageHint}
                  onChange={(e) => updateStep(i, { messageHint: e.target.value })}
                  placeholder={'Optional — steer what this draft focuses on, e.g. "mention our case studies"'}
                  className="mt-2.5 w-full rounded-[12px] border border-line bg-paper px-3 py-1.5 text-[13px]"
                />
                <p className="mt-1.5 text-[11px] text-ink-soft">
                  Switches to {FALLBACK_CHANNELS} if this lead has no email on file, or hasn&apos;t replied by this
                  step.
                </p>
              </>
            ) : (
              <select
                value={step.stageTo ?? ""}
                onChange={(e) => updateStep(i, { stageTo: e.target.value })}
                className="mt-2.5 rounded-[12px] border border-line bg-paper px-2 py-1.5 text-[13px]"
              >
                {STAGE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={() => setSteps((prev) => [...prev, blankStep()])}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium"
        style={{ color: "var(--rust)" }}
      >
        <Plus className="h-3.5 w-3.5" /> Add step
      </button>

      <div className="mt-4 pt-4 border-t border-line flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving || !name.trim()}
          className="rounded-full px-4 py-2 text-sm font-medium disabled:opacity-60"
          style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
        >
          {saving ? "Saving…" : "Save plan"}
        </button>
        <button onClick={onCancel} disabled={saving} className="rounded-full border border-line px-4 py-2 text-sm font-medium disabled:opacity-60">
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * A ready plan, set up in days (A-044): each step is "Day N — FollowUp
 * writes: …", with the day editable and nothing else to decide. Saved as
 * an ordinary plan (email steps whose messageHint is the step's angle),
 * so it runs exactly like one built by hand.
 */
function ReadyPlanEditor({
  plan,
  holdAll,
  onCancel,
  onSaved,
  onError,
}: {
  plan: ReadyPlan;
  holdAll: boolean;
  onCancel: () => void;
  onSaved: (s: SequenceSummary) => void;
  onError: (msg: string | null) => void;
}) {
  const [name, setName] = useState(plan.name);
  const [days, setDays] = useState<number[]>(plan.steps.map((s) => s.day));
  const [saving, setSaving] = useState(false);
  const inOrder = days.every((d, i) => i === 0 || d > days[i - 1]);

  async function save() {
    onError(null);
    setSaving(true);
    try {
      const delays = toStepDelays(days);
      const res = await fetch("/api/sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          steps: plan.steps.map((st, i) => ({ delayHours: delays[i], action: "EMAIL", stageTo: null, messageHint: st.hint })),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message ?? "Couldn't save. Try again.");
      onSaved(data.sequence);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 box p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Plan name"
          className="rounded-full border border-line bg-paper px-3 py-1.5 text-sm font-medium"
        />
        <p className="text-[13px] text-ink-soft">
          {holdAll ? "Every message waits for your OK." : "It stops the moment they answer."}
        </p>
      </div>
      <ul className="mt-4 divide-y divide-line">
        {plan.steps.map((st, i) => (
          <li key={i} className="grid gap-3 py-3 sm:grid-cols-[150px_1fr] items-baseline">
            <label className="flex items-center gap-2 text-sm font-medium">
              {i === 0 && days[0] === 0 ? "Same day" : "Day"}
              {!(i === 0 && days[0] === 0) && (
                <input
                  type="number"
                  min={0}
                  max={90}
                  value={days[i]}
                  aria-label={`Day for step ${i + 1}`}
                  onChange={(e) => setDays((prev) => prev.map((d, j) => (j === i ? Number(e.target.value) : d)))}
                  className="w-16 rounded-[12px] border border-line bg-paper px-2 py-1 text-center"
                />
              )}
            </label>
            <p className="text-sm">FollowUp writes: {st.label.charAt(0).toLowerCase() + st.label.slice(1)}.</p>
          </li>
        ))}
      </ul>
      {!inOrder && <p className="mt-2 text-[13px]" style={{ color: "var(--coral)" }}>Each step needs a later day than the one before.</p>}
      <div className="mt-4 pt-4 border-t border-line flex flex-wrap items-center gap-2">
        <button
          onClick={save}
          disabled={saving || !name.trim() || !inOrder}
          className="rounded-full px-4 py-2 text-sm font-medium disabled:opacity-60"
          style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
        >
          {saving ? "Saving…" : "Save plan"}
        </button>
        <button onClick={onCancel} disabled={saving} className="rounded-full border border-line px-4 py-2 text-sm font-medium disabled:opacity-60">
          Cancel
        </button>
      </div>
    </div>
  );
}
