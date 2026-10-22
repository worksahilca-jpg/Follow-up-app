"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ScrollTitle from "@/components/app/ScrollTitle";
import type { FactLine } from "@/lib/factLines";
import type { TellState, TellTopic } from "@/lib/tellFollowUp";
import { exampleLine, MAX_ANSWER } from "@/lib/tellLines";

/**
 * "Tell FollowUp about your business" (A-311, built as drawn: A-312). FollowUp asks one thing at a time; the owner
 * answers in their own words; FollowUp shows what it took from the answer, and nothing is saved until "Use these".
 * The practice chat's bubbles (no avatar, no typing dots: brand principle 3), Today's quiet links.
 *
 * Like a conversation (A-313): each question comes from the server worded for this business, and when an answer can't
 * help a customer ("depends on the site") FollowUp asks once more and says why, before showing what it took.
 *
 * What was said this visit lives only on this page: what FollowUp knows lives in Settings › What FollowUp knows, and
 * where the conversation is comes from there (src/lib/tellFollowUp.ts), so leaving halfway loses nothing that was used.
 */
type Exchange = { q: string; a: string };

type Turn = { kind: "asked"; exchanges: Exchange[]; rows: FactLine[] } | { kind: "skipped"; exchanges: Exchange[]; question: string };

/**
 * The question being answered: what was said so far (the question and answer, then FollowUp's one more question and
 * its answer), `dig` once FollowUp asked once more, and `rows` once it shows what it took from `answer`.
 */
type Pending = { label: string; exchanges: Exchange[]; dig: TellTopic | null; rows: FactLine[] | null; answer: string };

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

/** What was said about one question: FollowUp's question, the owner's answer, and FollowUp's one more question if any. */
function Said({ exchanges }: { exchanges: Exchange[] }) {
  return (
    <>
      {exchanges.map((e, i) => (
        <div key={i} className="flex flex-col gap-4">
          <FollowUpSays text={e.q} />
          <YouSay text={e.a} />
        </div>
      ))}
    </>
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

export default function TellFollowUp({
  initial,
  first,
  again,
  doneHref,
}: {
  initial: TellState;
  first: TellTopic | null;
  again: boolean;
  doneHref: string;
}) {
  const [state, setState] = useState(initial);
  // The question to answer now, worded for this business by the server (A-313); null when there is nothing left.
  const [topic, setTopic] = useState<TellTopic | null>(first);
  // Skipped on this visit: with `again`, a question skipped before is open, so skipping it again must still move on.
  const [setAside, setSetAside] = useState<string[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [reading, setReading] = useState(false);
  const [retry, setRetry] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const remaining = state.open.filter((l) => !setAside.includes(l));
  const total = state.topics.length;
  const position = Math.min(total, Math.max(1, total - remaining.length + 1));
  // The box takes an answer to the question, or to FollowUp's one more question; not while it shows what it took.
  const canAnswer = !busy && (!pending || (Boolean(pending.dig) && !pending.rows));

  // Each new step comes into view, as a chat does; the first question is already on screen.
  useEffect(() => {
    if (turns.length > 0 || pending) end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [turns.length, pending]);

  function focusBox() {
    // After the box is enabled again, on the next frame.
    requestAnimationFrame(() => input.current?.focus());
  }

  /** The conversation moved on: where it is now, and the next question as the server worded it. */
  function moveOn(data: Record<string, unknown>) {
    if (data.state) setState(data.state as TellState);
    setTopic((data.next as TellTopic | null | undefined) ?? null);
    setRetry(false);
    setError(null);
    focusBox();
  }

  async function send() {
    const answer = draft.trim();
    if (!topic || !answer || !canAnswer) return;
    const before = pending;
    // A first answer, or the answer to FollowUp's one more question (read with the first, never dug into again).
    const q = before?.dig ? before.dig.question : topic.question;
    const exchanges = [...(before?.dig ? before.exchanges : []), { q, a: answer }];
    const next: Pending = { label: topic.label, exchanges, dig: before?.dig ?? null, rows: null, answer };
    setPending(next);
    setDraft("");
    setBusy(true);
    setReading(true);
    setError(null);
    const r = await post({
      action: "read",
      topic: topic.label,
      answer,
      question: q,
      ...(before?.dig ? { previous: before.exchanges[0]?.a, dug: true } : {}),
    });
    setBusy(false);
    setReading(false);
    if (!r.ok) {
      setPending(before);
      setDraft(answer);
      setError(r.message);
      return;
    }
    if (r.data.dig) {
      setPending({ ...next, dig: r.data.dig as TellTopic });
      focusBox();
      return;
    }
    setPending({ ...next, rows: (r.data.rows as FactLine[]) ?? [] });
  }

  async function use() {
    if (!topic || !pending?.rows || busy) return;
    setBusy(true);
    setError(null);
    const r = await post({ action: "use", topic: pending.label, answer: pending.answer, rows: pending.rows, again, setAside });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setTurns((t) => [...t, { kind: "asked", exchanges: pending.exchanges, rows: pending.rows ?? [] }]);
    setPending(null);
    moveOn(r.data);
  }

  /** "Not right": nothing is saved; their words go back in the box to say it another way. */
  function notRight() {
    if (!pending) return;
    setDraft(pending.answer);
    setPending(null);
    setRetry(true);
    setError(null);
    focusBox();
  }

  async function skip() {
    if (!topic || busy || pending?.rows) return;
    const aside = [...setAside, topic.label];
    setBusy(true);
    setError(null);
    const r = await post({ action: "skip", topic: topic.label, again, setAside: aside });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setTurns((t) => [...t, { kind: "skipped", exchanges: pending?.exchanges ?? [], question: pending?.dig?.question ?? topic.question }]);
    setSetAside(aside);
    setPending(null);
    setDraft("");
    moveOn(r.data);
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
        {/* Short, so the phone's top bar keeps room for the logo (A-313). */}
        <ScrollTitle title="Tell FollowUp" />
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
      <ScrollTitle title="Tell FollowUp" />
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
              <Said exchanges={t.exchanges} />
              <Took rows={t.rows} used />
            </div>
          ) : (
            <div key={i} className="flex flex-col gap-4">
              <Said exchanges={t.exchanges} />
              <div className="flex flex-col gap-2">
                <FollowUpSays text={t.question} />
                <p className="px-1 text-[13.5px] text-ink-faint">Skipped.</p>
              </div>
            </div>
          )
        )}

        {!pending && <FollowUpSays text={topic.question} />}
        {!pending && (retry || example) && (
          <p className="-mt-2 px-1 text-[13.5px] text-ink-faint">{retry ? "Say it another way, or skip this one." : example}</p>
        )}
        {pending && <Said exchanges={pending.exchanges} />}
        {/* FollowUp's one more question, while it waits for the answer (A-313). */}
        {pending?.dig && !pending.rows && !reading && pending.exchanges.length === 1 && (
          <>
            <FollowUpSays text={pending.dig.question} />
            {exampleLine(pending.dig.example) && <p className="-mt-2 px-1 text-[13.5px] text-ink-faint">{exampleLine(pending.dig.example)}</p>}
          </>
        )}
        {reading && <p className="px-1 text-[14px] text-ink-faint">FollowUp is reading your answer…</p>}
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
          disabled={Boolean(pending?.rows)}
          className="min-h-10 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-faint disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!canAnswer || !draft.trim()}
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
        <button type="button" onClick={() => void skip()} disabled={busy || Boolean(pending?.rows)} className={QUIET}>
          Skip this one
        </button>
        <Link href={doneHref} className={QUIET}>
          Finish later
        </Link>
      </div>
    </div>
  );
}
