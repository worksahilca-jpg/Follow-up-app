"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mic } from "lucide-react";
import ScrollTitle from "@/components/app/ScrollTitle";
import TellTalk, { useCanRecord } from "@/components/TellTalk";
import type { FactLine } from "@/lib/factLines";
import type { Playback, PlaybackRow, TellState, TellTopic } from "@/lib/tellFollowUp";
import { exampleLine, MAX_ANSWER } from "@/lib/tellLines";
import { talkLength } from "@/lib/tellTalk";

/**
 * "Tell FollowUp about your business", a 5-minute meeting (A-311, A-314). FollowUp asks what a consultant would ask,
 * one thing at a time, each question worded from what the owner already said (A-313); the owner only answers. Nothing
 * pops up between answers (R-139). At the end, one play-back of the whole business: FollowUp's read, what it will tell
 * customers in the owner's words (each with Edit), how it will use it, what it still doesn't know, a box for anything
 * wrong or missing, and one "Looks right". Nothing is quoted to a customer before that.
 *
 * The practice chat's bubbles (no avatar, no typing dots: brand principle 3), Today's quiet links. What was said this
 * visit lives only on this page; what FollowUp took from it waits on the server (the meeting's draft), so leaving
 * halfway loses nothing.
 *
 * "Rather talk?" (A-318): the same meeting said out loud (src/components/TellTalk.tsx), ending in the same play-back,
 * with what was said and what the talk didn't cover.
 */
type Exchange = { q: string; a: string };

/** One question of the meeting: what was said about it, and the question itself when it was skipped. */
type Turn = { exchanges: Exchange[]; skipped?: string };

/** The question being answered: what was said so far, and `dig` once FollowUp asked once more (A-313). */
type Pending = { label: string; exchanges: Exchange[]; dig: TellTopic | null };

const QUIET = "inline-flex min-h-11 items-center text-[14px] text-ink-soft underline underline-offset-[3px] disabled:opacity-50";
const OUTLINED = "inline-flex min-h-11 items-center rounded-full border bg-card px-[18px] text-[15px] font-medium disabled:opacity-50";
const SECTION = "px-1 text-[13px] font-semibold text-ink-soft";

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

/** Label/value rows in one white group (Settings' fact rows). */
function FactList({ rows }: { rows: FactLine[] }) {
  return (
    <ul className="overflow-hidden rounded-[16px] border border-line bg-card">
      {rows.map((f, i) => (
        <li key={f.label} className={"px-3.5 py-2.5" + (i ? " border-t border-line" : "")}>
          <p className="text-[12.5px] text-ink-soft">{f.label}</p>
          <p className="mt-0.5 text-[15px] leading-snug">{f.value}</p>
        </li>
      ))}
    </ul>
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
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The end of the meeting (A-314): the play-back, the owner's edits on it (label → their words; "" leaves a new line
  // out), and what was saved on "Looks right".
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [loadingPlayback, setLoadingPlayback] = useState(!first && initial.draft.length > 0);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{ label: string; value: string } | null>(null);
  const [correction, setCorrection] = useState("");
  const [saved, setSaved] = useState<FactLine[] | null>(null);
  // Talking instead of typing (A-318): offered once the page knows this browser can record; `talked` once a talk was
  // played back on this visit, so its play-back shows even with questions still open.
  const canTalk = useCanRecord();
  const [talking, setTalking] = useState(false);
  const [talked, setTalked] = useState(false);
  const [showWords, setShowWords] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const remaining = state.open.filter((l) => !setAside.includes(l));
  const total = state.topics.length;
  const position = Math.min(total, Math.max(1, total - remaining.length + 1));
  const last = remaining.length <= 1;

  // Coming back to a meeting whose questions are all answered: straight to the play-back.
  useEffect(() => {
    if (!loadingPlayback) return;
    let gone = false;
    void post({ action: "playback", again }).then((r) => {
      if (gone) return;
      setLoadingPlayback(false);
      if (r.ok) setPlayback((r.data.playback as Playback | null) ?? null);
      else setError(r.message);
    });
    return () => {
      gone = true;
    };
  }, [loadingPlayback, again]);

  // Each new step comes into view, as a chat does; the first question is already on screen.
  useEffect(() => {
    if (turns.length > 0 || pending) end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [turns.length, pending]);

  function focusBox() {
    // After the box is enabled again, on the next frame.
    requestAnimationFrame(() => input.current?.focus());
  }

  /** The meeting moved on: the next question as the server worded it, or the play-back when none is left. */
  function moveOn(data: Record<string, unknown>) {
    if (data.state) setState(data.state as TellState);
    const next = (data.next as TellTopic | null | undefined) ?? null;
    setTopic(next);
    setError(null);
    if (next) return focusBox();
    const back = (data.playback as Playback | null | undefined) ?? null;
    setPlayback(back);
    if (back) window.scrollTo({ top: 0 });
  }

  async function send() {
    const answer = text.trim();
    if (!topic || !answer || busy) return;
    const before = pending;
    // A first answer, or the answer to FollowUp's one more question (read with the first, never dug into again).
    const q = before?.dig ? before.dig.question : topic.question;
    const exchanges = [...(before?.dig ? before.exchanges : []), { q, a: answer }];
    setPending({ label: topic.label, exchanges, dig: before?.dig ?? null });
    setText("");
    setBusy(true);
    setError(null);
    const r = await post({
      action: "answer",
      topic: topic.label,
      answer,
      question: q,
      ...(before?.dig ? { previous: before.exchanges[0]?.a, dug: true } : {}),
      again,
      setAside,
    });
    setBusy(false);
    if (!r.ok) {
      setPending(before);
      setText(answer);
      setError(r.message);
      return;
    }
    if (r.data.dig) {
      setPending({ label: topic.label, exchanges, dig: r.data.dig as TellTopic });
      focusBox();
      return;
    }
    setTurns((t) => [...t, { exchanges }]);
    setPending(null);
    moveOn(r.data);
  }

  async function skip() {
    if (!topic || busy) return;
    const aside = [...setAside, topic.label];
    setBusy(true);
    setError(null);
    const r = await post({ action: "skip", topic: topic.label, again, setAside: aside });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setTurns((t) => [...t, { exchanges: pending?.exchanges ?? [], skipped: pending?.dig?.question ?? topic.question }]);
    setSetAside(aside);
    setPending(null);
    setText("");
    moveOn(r.data);
  }

  /** "Anything wrong or missing?": FollowUp takes it in, and plays the business back again. */
  async function correct() {
    const said = correction.trim();
    if (!said || busy) return;
    setBusy(true);
    setError(null);
    const r = await post({ action: "correct", text: said, again });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    if (r.data.state) setState(r.data.state as TellState);
    setPlayback((r.data.playback as Playback | null) ?? playback);
    setCorrection("");
  }

  /** The talk was written down and read: its play-back, the same as the typed meeting's end. */
  function talkDone(data: { state: TellState; playback: Playback | null }) {
    setState(data.state);
    setPlayback(data.playback);
    setTalking(false);
    setTalked(true);
    setError(null);
    window.scrollTo({ top: 0 });
  }

  /** "Answer them now": back to typing, at the first question the talk didn't cover. The draft keeps the talk. */
  function typeTheRest() {
    const next = state.topics.find((t) => t.label === state.open[0]) ?? null;
    setTalked(false);
    setPlayback(null);
    setTopic(next);
    window.scrollTo({ top: 0 });
  }

  function value(row: PlaybackRow): string {
    return edits[row.label] ?? row.value;
  }

  function saveEdit() {
    if (!editing || !playback) return;
    const row = playback.rows.find((r) => r.label === editing.label);
    const words = editing.value.replace(/\s+/g, " ").trim();
    // A line already in use is removed in Settings; here it can only get new words.
    if (!row || (!words && !row.fresh)) return;
    setEdits((e) => ({ ...e, [row.label]: words }));
    setEditing(null);
  }

  /** "Looks right": the meeting's lines, with the owner's edits, are used from now on. */
  async function confirm() {
    if (!playback || busy) return;
    setBusy(true);
    setError(null);
    const list = Object.entries(edits).map(([label, v]) => ({ label, value: v }));
    const r = await post({ action: "confirm", edits: list, again });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setSaved(playback.rows.map((row) => ({ label: row.label, value: value(row) })).filter((f) => f.value));
    window.scrollTo({ top: 0 });
  }

  const back = (
    <Link href="/settings#business" className="inline-flex min-h-11 items-center text-[14px] text-ink-faint hover:text-ink">
      ‹ What FollowUp knows
    </Link>
  );
  const errorLine = error && (
    <p role="alert" className="mt-2 px-1 text-[14px]" style={{ color: "var(--coral)" }}>
      {error}
    </p>
  );

  // Talking instead of typing (A-318).
  if (talking) {
    return <TellTalk topics={state.topics.map((t) => t.label)} again={again} onBack={() => setTalking(false)} onDone={talkDone} />;
  }

  // After "Looks right".
  if (saved) {
    return (
      <div className="max-w-[640px] pb-10">
        <ScrollTitle title="Tell FollowUp" />
        {back}
        <p className="mt-2 text-[13px] text-ink-soft">Tell FollowUp about your business</p>
        <h1 className="title-serif ios-title1 mt-1">
          FollowUp knows {saved.length} {saved.length === 1 ? "thing" : "things"} about your business.
        </h1>
        <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">It uses them in your replies from now on, in your words.</p>
        {saved.length > 0 && (
          <div className="mt-5">
            <FactList rows={saved} />
          </div>
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

  // The end of the meeting: the whole business, played back once (A-314); after a talk, even with questions open.
  if ((!topic || (talked && playback)) && (playback || loadingPlayback)) {
    const notSaid = talked ? state.open : [];
    return (
      <div className="max-w-[640px] pb-10">
        <ScrollTitle title="Tell FollowUp" />
        {back}
        <p className="mt-2 text-[13px] text-ink-soft">Tell FollowUp about your business</p>
        <h1 className="title-serif ios-title1 mt-1">Here&apos;s your business, as FollowUp understands it.</h1>
        {playback?.talk && (
          <>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-soft">
              From what you said · {talkLength(playback.talk.seconds)} ·{" "}
              <button type="button" onClick={() => setShowWords((v) => !v)} aria-expanded={showWords} className="text-ink underline underline-offset-[3px]">
                {showWords ? "Hide what you said" : "Read what you said"}
              </button>
            </p>
            {showWords && (
              <p className="mt-3 whitespace-pre-wrap rounded-[16px] border border-line bg-card px-3.5 py-3 text-[15px] leading-relaxed text-ink-soft">
                {playback.talk.text}
              </p>
            )}
          </>
        )}
        {loadingPlayback || !playback ? (
          <p className="mt-6 px-1 text-[15px] text-ink-faint">FollowUp is putting it together…</p>
        ) : (
          <>
            {playback.read && (
              <section className="mt-6 flex flex-col gap-2" aria-labelledby="tell-read">
                <h2 id="tell-read" className={SECTION}>
                  FollowUp&apos;s read
                </h2>
                <p className="rounded-[16px] border border-line bg-card px-3.5 py-3 text-[16px] leading-relaxed">{playback.read}</p>
              </section>
            )}

            <section className="mt-6 flex flex-col gap-2" aria-labelledby="tell-rows">
              <h2 id="tell-rows" className={SECTION}>
                What it will tell customers, in your words
              </h2>
              <ul className="overflow-hidden rounded-[16px] border border-line bg-card">
                {playback.rows.map((row, i) => {
                  const v = value(row);
                  const open = editing?.label === row.label;
                  return (
                    <li key={row.label} className={"flex items-center justify-between gap-3 px-3.5 py-2.5" + (i ? " border-t border-line" : "")}>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] text-ink-soft">{row.label}</p>
                        {open ? (
                          <form
                            className="mt-1 flex flex-col gap-2"
                            onSubmit={(e) => {
                              e.preventDefault();
                              saveEdit();
                            }}
                          >
                            <label htmlFor="tell-edit" className="sr-only">
                              {row.label}
                            </label>
                            <textarea
                              id="tell-edit"
                              value={editing.value}
                              onChange={(e) => setEditing({ label: row.label, value: e.target.value })}
                              maxLength={200}
                              rows={2}
                              autoFocus
                              className="w-full rounded-[12px] border bg-paper px-3 py-2 text-[15px] leading-snug outline-none"
                              style={{ borderColor: "var(--line-strong)" }}
                            />
                            <div className="flex items-center gap-4">
                              <button type="submit" disabled={!editing.value.trim() && !row.fresh} className={OUTLINED} style={{ borderColor: "var(--line-strong)" }}>
                                {!editing.value.trim() ? "Leave it out" : "Save"}
                              </button>
                              <button type="button" onClick={() => setEditing(null)} className={QUIET}>
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : v ? (
                          <p className="mt-0.5 text-[15px] leading-snug">{v}</p>
                        ) : (
                          <p className="mt-0.5 text-[15px] leading-snug text-ink-faint">Left out.</p>
                        )}
                      </div>
                      {!open && (
                        <button
                          type="button"
                          onClick={() => setEditing({ label: row.label, value: v })}
                          className="-my-1 inline-flex min-h-11 shrink-0 items-center px-1 text-[13.5px] text-ink-soft underline underline-offset-[3px]"
                          aria-label={`Edit ${row.label}`}
                        >
                          Edit
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {playback.uses.length > 0 && (
              <section className="mt-6 flex flex-col gap-2" aria-labelledby="tell-uses">
                <h2 id="tell-uses" className={SECTION}>
                  How FollowUp will use it
                </h2>
                <ul className="flex flex-col gap-2 px-1">
                  {playback.uses.map(([when, what]) => (
                    <li key={when} className="text-[15px] leading-snug">
                      <span className="font-semibold">{when}:</span> <span className="text-ink-soft">{what}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {notSaid.length > 0 && (
              <section className="mt-6 flex flex-col gap-2" aria-labelledby="tell-not-said">
                <h2 id="tell-not-said" className={SECTION}>
                  Not in what you said
                </h2>
                <p className="px-1 text-[14.5px] leading-relaxed text-ink-soft">
                  {listed(notSaid)}.{" "}
                  <button type="button" onClick={typeTheRest} className="text-ink underline underline-offset-[3px]">
                    Answer {notSaid.length === 1 ? "it" : "them"} now
                  </button>
                </p>
              </section>
            )}

            {playback.skipped.length > 0 && (
              <section className="mt-6 flex flex-col gap-2" aria-labelledby="tell-later">
                <h2 id="tell-later" className={SECTION}>
                  Still to learn
                </h2>
                <p className="px-1 text-[14.5px] leading-relaxed text-ink-soft">
                  You skipped {listed(playback.skipped)}. If a customer asks, FollowUp asks you then.{" "}
                  {!again && (
                    <Link href="/tell?again=1" className="text-ink underline underline-offset-[3px]">
                      Answer {playback.skipped.length === 1 ? "it" : "them"} now
                    </Link>
                  )}
                </p>
              </section>
            )}

            <section className="mt-7 flex flex-col gap-2" aria-labelledby="tell-fix">
              <h2 id="tell-fix" className={SECTION}>
                Anything wrong or missing?
              </h2>
              <form
                className="flex items-center gap-2 rounded-full border bg-card py-1.5 pl-4 pr-1.5"
                style={{ borderColor: "var(--line-strong)" }}
                onSubmit={(e) => {
                  e.preventDefault();
                  void correct();
                }}
              >
                <label htmlFor="tell-correct" className="sr-only">
                  Anything wrong or missing?
                </label>
                <input
                  id="tell-correct"
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                  maxLength={MAX_ANSWER}
                  placeholder="In your own words…"
                  autoComplete="off"
                  className="min-h-10 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-faint"
                />
                <button
                  type="submit"
                  disabled={busy || !correction.trim()}
                  className="min-h-10 shrink-0 rounded-full border bg-card px-[18px] text-[15px] font-medium disabled:opacity-50"
                  style={{ borderColor: "var(--line-strong)" }}
                >
                  {busy && correction.trim() ? "Reading…" : "Send"}
                </button>
              </form>
            </section>

            {errorLine}
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
              <button
                type="button"
                onClick={() => void confirm()}
                disabled={busy || Boolean(editing)}
                className="inline-flex h-12 items-center rounded-full bg-ink px-8 text-[15px] font-medium text-paper disabled:opacity-60"
              >
                {busy && !correction.trim() ? "Saving…" : "Looks right"}
              </button>
              <Link href={doneHref} className={QUIET}>
                Finish later
              </Link>
            </div>
            <p className="mt-3 px-1 text-[13px] leading-normal text-ink-soft">
              Nothing is quoted to a customer until you tap Looks right. Change anything later in Settings › What FollowUp knows.
            </p>
          </>
        )}
        {(loadingPlayback || !playback) && errorLine}
      </div>
    );
  }

  // Nothing left to ask and nothing waiting: what FollowUp knows.
  if (!topic) {
    const known = state.facts;
    const skipped = state.skipped.length;
    return (
      <div className="max-w-[640px] pb-10">
        <ScrollTitle title="Tell FollowUp" />
        {back}
        <p className="mt-2 text-[13px] text-ink-soft">Tell FollowUp about your business</p>
        <h1 className="title-serif ios-title1 mt-1">
          {known.length === 0 ? "FollowUp will learn as you go." : `FollowUp knows ${known.length} ${known.length === 1 ? "thing" : "things"} about your business.`}
        </h1>
        {known.length > 0 && (
          <div className="mt-5">
            <FactList rows={known} />
          </div>
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

  // The meeting.
  const example = exampleLine(topic.example);
  return (
    <div className="max-w-[640px] pb-10">
      {/* Short, so the phone's top bar keeps room for the logo (A-313). */}
      <ScrollTitle title="Tell FollowUp" />
      {back}
      <div className="flex items-start justify-between gap-3">
        <h1 className="title-serif ios-title1">Tell FollowUp about your business</h1>
        <span className="mt-2 shrink-0 whitespace-nowrap text-[13px] text-ink-soft">
          {position} of {total}
        </span>
      </div>
      <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">
        A 5-minute meeting so FollowUp gets to know your business. It asks what a consultant would ask, one thing at a time;
        just answer in your own words. At the end it shows you what it understood, and nothing is used until you say it&apos;s
        right.
      </p>
      {/* Talk instead (A-318): only where this browser can record. */}
      {canTalk && (
        <button
          type="button"
          onClick={() => setTalking(true)}
          disabled={busy}
          className={OUTLINED + " mt-4 gap-2"}
          style={{ borderColor: "var(--line-strong)" }}
        >
          <Mic aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
          Rather talk? Talk for 2 minutes
        </button>
      )}

      <div className="mt-6 flex flex-col gap-4" aria-live="polite">
        {turns.map((t, i) => (
          <div key={i} className="flex flex-col gap-4">
            <Said exchanges={t.exchanges} />
            {t.skipped && (
              <div className="flex flex-col gap-2">
                <FollowUpSays text={t.skipped} />
                <p className="px-1 text-[13.5px] text-ink-faint">Skipped.</p>
              </div>
            )}
          </div>
        ))}

        {!pending && <FollowUpSays text={topic.question} />}
        {!pending && example && <p className="-mt-2 px-1 text-[13.5px] text-ink-faint">{example}</p>}
        {pending && <Said exchanges={pending.exchanges} />}
        {/* FollowUp's one more question, while it waits for the answer (A-313). */}
        {pending?.dig && !busy && pending.exchanges.length === 1 && (
          <>
            <FollowUpSays text={pending.dig.question} />
            {exampleLine(pending.dig.example) && <p className="-mt-2 px-1 text-[13.5px] text-ink-faint">{exampleLine(pending.dig.example)}</p>}
          </>
        )}
        {busy && pending && (
          <p className="px-1 text-[14px] text-ink-faint">{last ? "FollowUp is putting it together…" : "FollowUp is reading your answer…"}</p>
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
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_ANSWER}
          placeholder="Answer in your own words…"
          autoComplete="off"
          className="min-h-10 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-faint"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="min-h-10 shrink-0 rounded-full px-[18px] text-[15px] font-medium disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--on-accent)" }}
        >
          Send
        </button>
      </form>
      {errorLine}
      <div className="mt-2 flex items-center justify-between px-1">
        <button type="button" onClick={() => void skip()} disabled={busy} className={QUIET}>
          Skip this one
        </button>
        <Link href={doneHref} className={QUIET}>
          Finish later
        </Link>
      </div>
    </div>
  );
}

/** "Hours and Languages", "Hours, Payment and Languages". */
function listed(labels: readonly string[]): string {
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}
