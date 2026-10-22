"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ScrollTitle from "@/components/app/ScrollTitle";
import type { FactLine } from "@/lib/factLines";
import type { TellState } from "@/lib/tellFollowUp";
import { exampleLine, MAX_ANSWER } from "@/lib/tellLines";

/**
 * "Tell FollowUp about your business" (A-311, built as drawn: A-312). FollowUp asks one thing at a time; the owner
 * answers in their own words; FollowUp shows what it took from the answer, and nothing is saved until "Use these".
 * The practice chat's bubbles (no avatar, no typing dots: brand principle 3), Today's quiet links.
 *
 * What was said this visit lives only on this page: what FollowUp knows lives in Settings › What FollowUp knows, and
 * where the conversation is comes from there (src/lib/tellFollowUp.ts), so leaving halfway loses nothing that was used.
 */
type Turn =
  | { kind: "asked"; question: string; answer: string; rows: FactLine[] }
  | { kind: "skipped"; question: string };

type Pending = { label: string; answer: string; rows: FactLine[] | null };

const OUTLINED = "inline-flex min-h-11 items-center rounded-full border bg-card px-[18px] text-[15px] font-medium disabled:opacity-50";
const QUIET = "inline-flex min-h-11 items-center text-[14px] text-ink-soft underline underline-offset-[3px] disabled:opacity-50";

async function post(body: unknown): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; message: string }> {
  try {
    const res = await fetch("/api/business/tell", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || !data.success) return { ok: false, message: typeof data.message === "string" ? data.message : "That didn't save. Try again." };
    return { ok: true, data };
  } catch {
    return { ok: false, message: "That didn't go through. Check your connection and try again." };
  }
}

function FollowUpSays({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-start">
      <span className="mb-1 px-1 text-[12.5px] text-ink-faint">FollowUp</span>
      <p className="max-w-[88%] whitespace-pre-wrap rounded-[18px] rounded-bl-[6px] border border-line bg-card px-3.5 py-2.5 text-[16px] leading-normal">{text}</p>
    </div>
  );
}

function YouSay({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-end">
      <span className="mb-1 px-1 text-[12.5px] text-ink-faint">You</span>
      <p className="max-w-[80%] whitespace-pre-wrap rounded-[18px] rounded-br-[6px] px-3.5 py-2.5 text-[16px] leading-snug" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
        {text}
      </p>
    </div>
  );
}

/** What FollowUp took from one answer: plain label/value rows in one white group (Settings' fact rows). */
function Took({ rows, used }: { rows: FactLine[]; used: boolean }) {
  return (
    <div>
      <p className="mb-1 px-1 text-[12.5px] text-ink-faint">{used ? "In use" : "FollowUp will use this, if it's right"}</p>
      <ul className="overflow-hidden rounded-[16px] border border-line bg-card">
        {rows.map((r, i) => (
          <li key={r.label} className={"px-3.5 py-2.5" + (i ? " border-t border-line" : "")}>
            <p className="text-[12.5px] text-ink-soft">{r.label}</p>
            <p className="mt-0.5 text-[15px] leading-snug">{r.value}</p>
          </li>
        ))}
      </ul>
      {used && <p className="mt-1.5 px-1 text-[13.5px] text-ink-soft">Saved. Change it any time in What FollowUp knows.</p>}
    </div>
  );
}

export default function TellFollowUp({ initial, again, doneHref }: { initial: TellState; again: boolean; doneHref: string }) {
  const [state, setState] = useState(initial);
  // Skipped on this visit: with `again`, a question skipped before is open, so skipping it again must still move on.
  const [setAside, setSetAside] = useState<string[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [retry, setRetry] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const remaining = state.open.filter((l) => !setAside.includes(l));
  const topic = remaining.length > 0 ? state.topics.find((t) => t.label === remaining[0]) ?? null : null;
  const total = state.topics.length;
  const position = Math.min(total, total - remaining.length + 1);

  // Each new step comes into view, as a chat does; the first question is already on screen.
  useEffect(() => {
    if (turns.length > 0 || pending) end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [turns.length, pending]);

  function nextQuestion() {
    setRetry(false);
    setError(null);
    // After the box is enabled again, on the next frame.
    requestAnimationFrame(() => input.current?.focus());
  }

  async function send() {
    const answer = draft.trim();
    if (!topic || !answer || busy) return;
    setBusy(true);
    setError(null);
    setPending({ label: topic.label, answer, rows: null });
    setDraft("");
    const r = await post({ action: "read", topic: topic.label, answer });
    setBusy(false);
    if (!r.ok) {
      setPending(null);
      setDraft(answer);
      setError(r.message);
      return;
    }
    setPending({ label: topic.label, answer, rows: (r.data.rows as FactLine[]) ?? [] });
  }

  async function use() {
    if (!topic || !pending?.rows || busy) return;
    setBusy(true);
    setError(null);
    const r = await post({ action: "use", topic: pending.label, answer: pending.answer, rows: pending.rows, again });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setTurns((t) => [...t, { kind: "asked", question: topic.question, answer: pending.answer, rows: pending.rows ?? [] }]);
    setPending(null);
    if (r.data.state) setState(r.data.state as TellState);
    nextQuestion();
  }

  /** "Not right": nothing is saved; their words go back in the box to say it another way. */
  function notRight() {
    if (!pending) return;
    setDraft(pending.answer);
    setPending(null);
    setRetry(true);
    setError(null);
    requestAnimationFrame(() => input.current?.focus());
  }

  async function skip() {
    if (!topic || busy) return;
    setBusy(true);
    setError(null);
    const r = await post({ action: "skip", topic: topic.label, again });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setTurns((t) => [...t, { kind: "skipped", question: topic.question }]);
    setSetAside((s) => [...s, topic.label]);
    setDraft("");
    if (r.data.state) setState(r.data.state as TellState);
    nextQuestion();
  }

  const back = (
    <Link href="/settings#business" className="inline-flex min-h-11 items-center text-[14px] text-ink-faint hover:text-ink">
      ‹ What FollowUp knows
    </Link>
  );

  if (!topic) {
    const known = state.facts;
    const skipped = state.skipped.length;
    return (
      <div className="max-w-[640px] pb-10">
        <ScrollTitle title="Tell FollowUp about your business" />
        {back}
        <p className="mt-2 text-[13px] text-ink-soft">Tell FollowUp about your business</p>
        <h1 className="title-serif ios-title1 mt-1">
          {known.length === 0 ? "FollowUp will learn as you go." : `FollowUp knows ${known.length} ${known.length === 1 ? "thing" : "things"} about your business.`}
        </h1>
        {known.length > 0 && (
          <ul className="mt-5 overflow-hidden rounded-[16px] border border-line bg-card">
            {known.map((f, i) => (
              <li key={f.label} className={"px-3.5 py-2.5" + (i ? " border-t border-line" : "")}>
                <p className="text-[12.5px] text-ink-soft">{f.label}</p>
                <p className="mt-0.5 text-[15px] leading-snug">{f.value}</p>
              </li>
            ))}
          </ul>
        )}
        {skipped > 0 && (
          <p className="mt-4 text-[14.5px] leading-relaxed text-ink-soft">
            You skipped {skipped}. If a customer asks about {skipped === 1 ? "it" : "one of them"}, FollowUp will ask you then.{" "}
            {!again && (
              <Link href="/tell?again=1" className="underline underline-offset-[3px]">
                Answer {skipped === 1 ? "it" : "them"} now
              </Link>
            )}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href={doneHref} className="inline-flex h-12 items-center rounded-full bg-ink px-8 text-[15px] font-medium text-paper">
            Done
          </Link>
          <span className="text-[13px] text-ink-soft">Change any of these in Settings › What FollowUp knows.</span>
        </div>
      </div>
    );
  }

  const example = exampleLine(topic.example);
  return (
    <div className="max-w-[640px] pb-10">
      <ScrollTitle title="Tell FollowUp about your business" />
      {back}
      <div className="flex items-start justify-between gap-3">
        <h1 className="title-serif ios-title1">Tell FollowUp about your business</h1>
        <span className="mt-2 shrink-0 whitespace-nowrap text-[13px] text-ink-soft">
          {position} of {total}
        </span>
      </div>
      <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">
        It asks what a new assistant would ask, one thing at a time. Answer in your own words. You check what it took from
        each answer before it&apos;s used, and it never makes up the rest.
      </p>

      <div className="mt-6 flex flex-col gap-4" aria-live="polite">
        {turns.map((t, i) =>
          t.kind === "asked" ? (
            <div key={i} className="flex flex-col gap-4">
              <FollowUpSays text={t.question} />
              <YouSay text={t.answer} />
              <Took rows={t.rows} used />
            </div>
          ) : (
            <div key={i} className="flex flex-col gap-2">
              <FollowUpSays text={t.question} />
              <p className="px-1 text-[13.5px] text-ink-faint">Skipped.</p>
            </div>
          )
        )}

        <FollowUpSays text={topic.question} />
        {!pending && (retry || example) && (
          <p className="-mt-2 px-1 text-[13.5px] text-ink-faint">{retry ? "Say it another way, or skip this one." : example}</p>
        )}
        {pending && <YouSay text={pending.answer} />}
        {pending && !pending.rows && <p className="px-1 text-[14px] text-ink-faint">FollowUp is reading your answer…</p>}
        {pending?.rows && (
          <div>
            <Took rows={pending.rows} used={false} />
            <div className="mt-2 flex items-center gap-4 px-1">
              <button type="button" onClick={() => void use()} disabled={busy} className={OUTLINED} style={{ borderColor: "var(--line-strong)" }}>
                {busy ? "Saving…" : pending.rows.length === 1 ? "Use this" : "Use these"}
              </button>
              <button type="button" onClick={notRight} disabled={busy} className={QUIET}>
                Not right
              </button>
            </div>
          </div>
        )}
        <div ref={end} />
      </div>

      <form
        className="mt-6 flex items-center gap-2 rounded-full border bg-card py-1.5 pl-4 pr-1.5"
        style={{ borderColor: "var(--line-strong)" }}
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label htmlFor="tell-answer" className="sr-only">
          Your answer
        </label>
        <input
          id="tell-answer"
          ref={input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_ANSWER}
          placeholder="Answer in your own words…"
          autoComplete="off"
          disabled={Boolean(pending)}
          className="min-h-10 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-faint disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || Boolean(pending) || !draft.trim()}
          className="min-h-10 shrink-0 rounded-full px-[18px] text-[15px] font-medium disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--on-accent)" }}
        >
          Send
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 px-1 text-[14px]" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between px-1">
        <button type="button" onClick={() => void skip()} disabled={busy || Boolean(pending)} className={QUIET}>
          Skip this one
        </button>
        <Link href={doneHref} className={QUIET}>
          Finish later
        </Link>
      </div>
    </div>
  );
}
