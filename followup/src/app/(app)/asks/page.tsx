"use client";

/**
 * "What FollowUp asks" (A-302, approved 2026-10-20 as drawn: "yes build it"). Settings › Sending replies.
 *
 * With the owner's own questions: "Made from your words", one numbered group in their order with a grip to drag
 * (and Move up / Move down for anyone who can't drag, WCAG 2.5.7), FollowUp's additions tagged "Added" and why, what
 * FollowUp won't ask in writing under "For your call", their words with "Change your words", and "Use FollowUp's order
 * instead". Without them: the question from Today's card, and FollowUp's own order underneath.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ScrollTitle from "@/components/app/ScrollTitle";
import type { AskPlan, AskStep } from "@/lib/askPlan";

type Order = { key: string; label: string; question: string }[];
type Data = { realtor: boolean; isAdmin: boolean; plan: AskPlan | null; followUpOrder: Order };

const BOX = "overflow-hidden rounded-[16px] border border-line bg-card";
const LABEL = "mb-2 px-1 text-[14px] text-ink-faint";
const SAVE = "h-11 rounded-full bg-ink px-6 text-[14.5px] font-medium text-paper disabled:opacity-60";
const QUIET = "inline-flex min-h-11 items-center text-[14px] text-ink-soft underline underline-offset-2";
const EXAMPLE = "e.g. First their down payment and if they've talked to a lender. Then which areas they want, and when they want to move.";

/** Why FollowUp added each of its own (askPlan.ts finishPlan). */
const WHY_ADDED: Record<string, string> = {
  timing: "when they'll move tells it how soon to follow up",
  financing: "the lender question shows who is ready",
  agent: "it stops if they already have an agent",
};

async function post(body: unknown): Promise<{ ok: true; plan: AskPlan | null } | { ok: false; message: string }> {
  try {
    const res = await fetch("/api/business/ask-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string; plan?: AskPlan | null };
    if (!res.ok || !data.success) return { ok: false, message: data.message ?? "That didn't save. Try again." };
    return { ok: true, plan: data.plan ?? null };
  } catch {
    return { ok: false, message: "That didn't save. Check your connection and try again." };
  }
}

function Num({ n }: { n: number }) {
  return (
    <span aria-hidden="true" className="mt-px flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-card-2 text-[13px] font-semibold">
      {n}
    </span>
  );
}

function Grip() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M5 9h14M5 15h14" />
    </svg>
  );
}

/** The box where the owner writes what they ask: on the empty page, and for "Change your words". */
function WordsForm({ initial, onSaved, onCancel }: { initial: string; onSaved: (plan: AskPlan) => void; onCancel?: () => void }) {
  const [words, setWords] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const value = words.trim();
  async function save() {
    setBusy(true);
    setError(null);
    const r = await post({ words: value });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    if (r.plan) onSaved(r.plan);
  }
  return (
    <div className="px-4 py-3.5">
      <label htmlFor="ask-words" className="block text-[16px] font-semibold">
        What do you ask a new buyer, and in what order?
      </label>
      <p className="mt-1 text-[14px] leading-snug text-ink-soft">Write it the way you&apos;d tell a new assistant, or tap the mic on your keyboard and say it.</p>
      <textarea
        id="ask-words"
        rows={5}
        maxLength={600}
        value={words}
        onChange={(e) => setWords(e.target.value)}
        placeholder={EXAMPLE}
        className="mt-3 w-full rounded-[14px] border border-line bg-paper px-3.5 py-2.5 text-[16px] leading-normal"
      />
      {error && (
        <p className="mt-2 text-[13.5px]" role="alert" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
      <div className="mt-3 flex items-center gap-4">
        <button type="button" disabled={busy || !value} onClick={() => void save()} className={SAVE}>
          {busy ? "Saving…" : "Save"}
        </button>
        {onCancel && (
          <button type="button" disabled={busy} onClick={onCancel} className="h-11 px-1 text-[14px] text-ink-soft underline underline-offset-2">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export default function WhatFollowUpAsks() {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  // Kept after "Use FollowUp's order instead", so the owner's words are one Save away from coming back.
  const [lastWords, setLastWords] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/business/ask-plan")
      .then((r) => r.json())
      .then((d) => (d?.success ? setData(d as Data) : setFailed(true)))
      .catch(() => setFailed(true));
  }, []);

  const plan = data?.plan ?? null;
  const setPlan = (next: AskPlan | null) => setData((d) => (d ? { ...d, plan: next } : d));

  async function switchToFollowUpOrder() {
    setError(null);
    const r = await post({ clear: true });
    if (!r.ok) return setError(r.message);
    setLastWords(plan?.words ?? "");
    setEditing(false);
    setPlan(null);
  }

  return (
    <div className="max-w-[640px]">
      {/* Phone: one step up. Computer: Settings' tree is the left column (A-257), so the page only says where it sits. */}
      <Link href="/settings#replies-out" className="inline-flex min-h-11 items-center text-[13px] text-ink-faint hover:text-ink lg:hidden">
        ← Sending replies
      </Link>
      <p className="hidden items-center text-[13px] text-ink-faint lg:flex">
        Settings
        <span aria-hidden="true" className="mx-1.5">
          ›
        </span>
        <span className="text-ink-soft">Sending replies</span>
      </p>
      <ScrollTitle title="What FollowUp asks" />
      <h1 className="title-serif ios-title1 mt-2">What FollowUp asks</h1>

      {failed && <p className="mt-4 text-[15px] text-ink-soft">This didn&apos;t load. Refresh the page to try again.</p>}
      {data && !data.realtor && <p className="mt-4 text-[15px] text-ink-soft">This is for realtors for now.</p>}

      {data?.realtor && plan && (
        <PlanView
          // A new plan (new words) starts the list again; a new order is the list's own doing.
          key={plan.madeAt}
          plan={plan}
          isAdmin={data.isAdmin}
          onPlan={setPlan}
          editing={editing}
          onEdit={setEditing}
          onFollowUpOrder={() => void switchToFollowUpOrder()}
          error={error}
        />
      )}

      {data?.realtor && !plan && (
        <>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
            A new buyer is asked these, one or two at a time. Tell FollowUp what you ask instead, and it will ask yours.
          </p>
          {data.isAdmin ? (
            <div className={BOX + " mt-5"}>
              <WordsForm initial={lastWords} onSaved={setPlan} />
            </div>
          ) : (
            <p className="mt-3 text-[14px] text-ink-soft">Only an admin can change these.</p>
          )}
          <p className={LABEL + " mt-7"}>FollowUp&apos;s order</p>
          <ol className={BOX}>
            {data.followUpOrder.map((s, i) => (
              <li key={s.key} className={"flex items-start gap-3 px-4 py-3" + (i ? " border-t border-line-2" : "")}>
                <Num n={i + 1} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-medium">{s.label}</span>
                  <span className="mt-0.5 block text-[14px] leading-snug text-ink-soft">“{s.question}”</span>
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

function PlanView({
  plan,
  isAdmin,
  onPlan,
  editing,
  onEdit,
  onFollowUpOrder,
  error: outerError,
}: {
  plan: AskPlan;
  isAdmin: boolean;
  onPlan: (p: AskPlan) => void;
  editing: boolean;
  onEdit: (on: boolean) => void;
  onFollowUpOrder: () => void;
  error: string | null;
}) {
  const [steps, setSteps] = useState<AskStep[]>(plan.steps);
  const [error, setError] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const drag = useRef<{ key: string; y: number; moved: boolean; before: AskStep[] } | null>(null);
  const [status, setStatus] = useState("");
  // The order as it stands when a drag ends: read after the last move has rendered.
  const current = useRef(steps);
  useEffect(() => {
    current.current = steps;
  }, [steps]);

  async function saveOrder(next: AskStep[], before: AskStep[]) {
    if (next.map((s) => s.key).join() === before.map((s) => s.key).join()) return;
    setError(null);
    const r = await post({ order: next.map((s) => s.key) });
    if (!r.ok || !r.plan) {
      setSteps(before);
      setError(r.ok ? "That didn't save. Try again." : r.message);
      return;
    }
    onPlan(r.plan);
  }

  function move(key: string, by: number) {
    const from = steps.findIndex((s) => s.key === key);
    const to = from + by;
    if (from < 0 || to < 0 || to >= steps.length) return;
    const next = [...steps];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setSteps(next);
    setStatus(`${next[to].label}, now number ${to + 1} of ${next.length}.`);
    void saveOrder(next, steps);
  }

  // Dragging by the grip: the row follows the finger past the middle of its neighbours. A tap without a drag opens
  // Move up / Move down instead, so it never needs a drag (WCAG 2.5.7).
  function onDown(e: React.PointerEvent, key: string) {
    if (!isAdmin) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { key, y: e.clientY, moved: false, before: steps };
  }
  function onMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.abs(e.clientY - d.y) < 6) return;
    if (!d.moved) {
      d.moved = true;
      setDragging(d.key);
      setMoving(null);
    }
    setSteps((cur) => {
      const others = cur.filter((s) => s.key !== d.key);
      const at = others.filter((s) => {
        const r = rows.current.get(s.key)?.getBoundingClientRect();
        return r ? r.top + r.height / 2 < e.clientY : false;
      }).length;
      const next = [...others.slice(0, at), cur.find((s) => s.key === d.key)!, ...others.slice(at)];
      return next.map((s) => s.key).join() === cur.map((s) => s.key).join() ? cur : next;
    });
  }
  function onUp(key: string) {
    const d = drag.current;
    drag.current = null;
    setDragging(null);
    if (!d) return;
    if (!d.moved) {
      setMoving((m) => (m === key ? null : key));
      return;
    }
    void saveOrder(current.current, d.before);
  }

  const added = steps.filter((s) => s.added);
  const addedNames = added.map((s) => s.label);
  const addedLine =
    added.length > 0
      ? `FollowUp added ${addedNames.length > 1 ? `${addedNames.slice(0, -1).join(", ")} and ${addedNames[addedNames.length - 1]}` : addedNames[0]}: ` +
        added.map((s) => WHY_ADDED[s.key]).filter(Boolean).join(", and ") +
        "."
      : null;

  return (
    <>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
        Made from your words. FollowUp asks one or two at a time, in this order.{isAdmin ? " Drag to change it." : ""}
      </p>
      <p className="sr-only" aria-live="polite">
        {status}
      </p>
      <ol className={BOX + " mt-5"} aria-label="Questions, in the order FollowUp asks them">
        {steps.map((s, i) => (
          <li
            key={s.key}
            ref={(el) => {
              if (el) rows.current.set(s.key, el);
              else rows.current.delete(s.key);
            }}
            className={"px-4 py-3" + (i ? " border-t border-line-2" : "") + (dragging === s.key ? " bg-card-2" : "")}
          >
            <div className="flex items-start gap-3">
              <Num n={i + 1} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[16px] font-medium">{s.label}</span>
                  {s.added && (
                    <span className="rounded-full border px-[7px] text-[12px] font-semibold leading-[18px] text-ink-soft" style={{ borderColor: "var(--line-strong)" }}>
                      Added
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-[14px] leading-snug text-ink-soft">“{s.question}”</span>
              </span>
              {isAdmin && (
                <button
                  type="button"
                  aria-label={`Move ${s.label}`}
                  aria-expanded={moving === s.key}
                  onPointerDown={(e) => onDown(e, s.key)}
                  onPointerMove={onMove}
                  onPointerUp={() => onUp(s.key)}
                  onPointerCancel={() => {
                    drag.current = null;
                    setDragging(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                      e.preventDefault();
                      move(s.key, e.key === "ArrowUp" ? -1 : 1);
                    } else if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setMoving((m) => (m === s.key ? null : s.key));
                    }
                  }}
                  className="-my-2 -mr-2 flex h-11 w-11 shrink-0 cursor-grab touch-none items-center justify-center text-ink-faint hover:text-ink"
                >
                  <Grip />
                </button>
              )}
            </div>
            {moving === s.key && (
              <div className="ml-[38px] mt-1 flex gap-5">
                <button type="button" disabled={i === 0} onClick={() => move(s.key, -1)} className={QUIET + " disabled:no-underline disabled:opacity-50"}>
                  Move up
                </button>
                <button type="button" disabled={i === steps.length - 1} onClick={() => move(s.key, 1)} className={QUIET + " disabled:no-underline disabled:opacity-50"}>
                  Move down
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>
      {(error || outerError) && (
        <p className="mt-2 px-1 text-[13.5px]" role="alert" style={{ color: "var(--coral)" }}>
          {error ?? outerError}
        </p>
      )}
      {addedLine && <p className="mt-2.5 px-1 text-[13.5px] leading-[1.45] text-ink-faint">{addedLine}</p>}

      {plan.forCall.length > 0 && (
        <>
          <p className={LABEL + " mt-7"}>For your call</p>
          <ul className={BOX}>
            {plan.forCall.map((name, i) => (
              <li key={name} className={"px-4 py-3" + (i ? " border-t border-line-2" : "")}>
                <span className="block text-[16px] font-medium">{name}</span>
                <span className="mt-0.5 block text-[14px] leading-snug text-ink-soft">FollowUp doesn&apos;t ask this in a message. Ask it on your call.</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className={LABEL + " mt-7"}>Your words</p>
      <div className={BOX}>
        {editing ? (
          <WordsForm
            initial={plan.words}
            onSaved={(p) => {
              onEdit(false);
              onPlan(p);
            }}
            onCancel={() => onEdit(false)}
          />
        ) : (
          <>
            <p className="px-4 py-3 text-[15px] leading-[1.45]">“{plan.words}”</p>
            {isAdmin && (
              <button type="button" onClick={() => onEdit(true)} className="flex min-h-12 w-full items-center border-t border-line-2 px-4 text-left text-[15px] hover:bg-card-2">
                Change your words
              </button>
            )}
          </>
        )}
      </div>
      {isAdmin && !editing && (
        <button type="button" onClick={onFollowUpOrder} className={QUIET + " mt-2 px-1"}>
          Use FollowUp&apos;s order instead
        </button>
      )}
    </>
  );
}
