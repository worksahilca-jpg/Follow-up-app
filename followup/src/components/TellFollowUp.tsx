"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mic } from "lucide-react";
import { scrollPageTop } from "@/lib/scrollTop";
import ScrollTitle from "@/components/app/ScrollTitle";
import TellTalk, { useCanRecord } from "@/components/TellTalk";
import { BrandTile } from "@/components/brandLogos";
import type { FactLine } from "@/lib/factLines";
import type { Playback, PlaybackRow, TellState, TellTopic } from "@/lib/tellFollowUp";
import { exampleLine, MAX_ANSWER } from "@/lib/tellLines";
import { talkLength } from "@/lib/tellTalk";
import { fromLine, siteName, type ReadSource, type SiteNote } from "@/lib/siteRead";

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
 *
 * Before the first question (A-328), FollowUp asks for the business's website once, and reads the owner's own Instagram
 * posts too when Instagram is connected; the meeting then asks only what that didn't answer, and the play-back says
 * where each line came from.
 */
type Exchange = { q: string; a: string };

/** One question of the meeting: what was said about it, and the question itself when it was skipped. */
type Turn = { exchanges: Exchange[]; skipped?: string };

/** The question being answered: what was said so far, and `dig` once FollowUp asked once more (A-313). */
type Pending = { label: string; exchanges: Exchange[]; dig: TellTopic | null };

const QUIET = "inline-flex min-h-11 items-center text-[14px] text-ink-soft underline underline-offset-[3px] disabled:opacity-50";
const OUTLINED = "inline-flex min-h-11 items-center rounded-full border bg-card px-[18px] text-[15px] font-medium disabled:opacity-50";
const SECTION = "px-1 text-[13px] font-semibold text-ink-soft";

/** FollowUp's ask before the questions (A-328), kept on screen once answered or skipped. */
const SITE_ASK = "Before the questions: does your business have a website? Paste the link, and the questions skip whatever it already answers.";
/** Under a line of the play-back: where it came from (A-328). */
const SOURCE: Record<ReadSource | "said", string> = { website: "From your website", instagram: "From your Instagram", said: "You said" };

/** The website step, from the page (A-328). */
export type TellSite = {
  /** Ask for the website before the first question: once, never on "Answer them now". */
  ask: boolean;
  /** Instagram's handle when it's connected ("" when the handle isn't known), else null. */
  instagram: string | null;
  /** How many of the meeting's questions what was read already answered. */
  readCount: number;
  /** What was read before this visit (setup's line), when the owner hasn't answered anything since. */
  readSaid: string | null;
};

/** The website step once done: the link the owner gave (null for Instagram alone) and the line on what was read. */
type SiteTurn = { said: string | null; asked: boolean; line: string };

/** The one question before a site that doesn't look like this business's is read (A-332). */
type SiteCheck = { line: string; site: string };

async function post(body: unknown, url = "/api/business/tell"): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; message: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
  site,
}: {
  initial: TellState;
  first: TellTopic | null;
  again: boolean;
  doneHref: string;
  site: TellSite;
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
  // The website step (A-328): asked first, the Instagram tick, what's being read, and the line once it's read.
  const [askSite, setAskSite] = useState(site.ask);
  const [readInstagram, setReadInstagram] = useState(true);
  const [reading, setReading] = useState<string | null>(null);
  const [siteTurn, setSiteTurn] = useState<SiteTurn | null>(site.readSaid ? { said: null, asked: false, line: site.readSaid } : null);
  const [siteSkipped, setSiteSkipped] = useState(false);
  const [siteCheck, setSiteCheck] = useState<SiteCheck | null>(null);
  const [readCount, setReadCount] = useState(site.readCount);
  const [showRead, setShowRead] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const remaining = state.open.filter((l) => !setAside.includes(l));
  // What the website and Instagram answered isn't asked, so the counter counts only the rest (A-328).
  const total = Math.max(1, state.topics.length - readCount);
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
  const siteDone = Boolean(siteTurn?.asked) || siteSkipped;
  useEffect(() => {
    if (turns.length > 0 || pending || siteDone) end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [turns.length, pending, siteDone]);

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
    if (back) scrollPageTop();
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

  /**
   * "Read it": FollowUp reads the website (and the posts, when ticked), then asks only what's left (A-328). A site that
   * doesn't look like this business's comes back as one question first (A-332); "Yes, that's mine" reads it with `mine`.
   */
  async function readSite(mine = false) {
    const link = text.trim();
    const withInstagram = site.instagram !== null && readInstagram;
    if (busy || (!link && !withInstagram)) return;
    setBusy(true);
    setError(null);
    setSiteCheck(null);
    setReading(link);
    const r = await post({ action: "read", ...(link ? { url: link } : {}), instagram: withInstagram, again, ...(mine ? { mine: true } : {}) }, "/api/business/tell/read");
    setBusy(false);
    setReading(null);
    // The link stays in the box, so the owner can fix it or skip.
    if (!r.ok) return setError(r.message);
    if (r.data.check && typeof r.data.check === "object") {
      const c = r.data.check as { line?: unknown; site?: unknown };
      setSiteCheck({ line: typeof c.line === "string" ? c.line : "Is that your website?", site: typeof c.site === "string" ? c.site : link });
      return;
    }
    setAskSite(false);
    setText("");
    setReadCount(typeof r.data.readCount === "number" ? r.data.readCount : 0);
    setSiteTurn({ said: link || null, asked: true, line: typeof r.data.line === "string" ? r.data.line : "" });
    moveOn(r.data);
  }

  /** "No website, skip this": not asked again. */
  async function skipSite() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await post({ action: "skip" }, "/api/business/tell/read");
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setAskSite(false);
    setSiteSkipped(true);
    setText("");
    focusBox();
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
    scrollPageTop();
  }

  /** "Answer them now": back to typing, at the first question the talk didn't cover. The draft keeps the talk. */
  function typeTheRest() {
    const next = state.topics.find((t) => t.label === state.open[0]) ?? null;
    setTalked(false);
    setPlayback(null);
    setTopic(next);
    scrollPageTop();
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
    scrollPageTop();
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
        {playback?.site && (
          <>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-soft">
              {fromLine(playback.site, playback.rows.filter((r) => r.from === "said").length)} ·{" "}
              <button type="button" onClick={() => setShowRead((v) => !v)} aria-expanded={showRead} className="text-ink underline underline-offset-[3px]">
                {showRead ? "Hide what it read" : "See what it read"}
              </button>
            </p>
            {showRead && <WhatItRead site={playback.site} />}
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
                          <>
                            <p className="mt-0.5 text-[15px] leading-snug">{v}</p>
                            {/* Where it came from, once something was read (A-328). An edit makes it the owner's. */}
                            {playback.site && row.from && (
                              <p className="mt-0.5 text-[12.5px] text-ink-faint">{v !== row.value ? "You changed it" : SOURCE[row.from]}</p>
                            )}
                          </>
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
        {/* No counter while it asks for the website: that isn't one of the questions. */}
        {!askSite && (
          <span className="mt-2 shrink-0 whitespace-nowrap text-[13px] text-ink-soft">
            {position} of {total}
          </span>
        )}
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
        {/* The website step (A-328): the ask, the link, and one plain line on what was read (not a bubble, A-313). */}
        {(askSite || siteSkipped || siteTurn?.asked) && <FollowUpSays text={SITE_ASK} />}
        {askSite && reading === null && (
          <>
            <p className="-mt-2 px-1 text-[13.5px] text-ink-faint">{exampleLine("e.g. yourwebsite.ca")}</p>
            {site.instagram !== null && (
              <label htmlFor="tell-instagram" className="flex cursor-pointer items-start gap-3 rounded-[16px] border border-line bg-card px-3.5 py-3">
                <input
                  id="tell-instagram"
                  type="checkbox"
                  checked={readInstagram}
                  onChange={(e) => setReadInstagram(e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 accent-[var(--ink)]"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-2 text-[15px] font-medium">
                    <BrandTile brand="instagram" />
                    Also read your Instagram posts
                  </span>
                  <span className="text-[13.5px] leading-snug text-ink-soft">
                    {site.instagram ? `@${site.instagram}, already connected.` : "Already connected."} Only your own posts and bio,
                    never comments or messages.
                  </span>
                </span>
              </label>
            )}
          </>
        )}
        {reading !== null && (
          <>
            {reading && <YouSay text={reading} />}
            <p className="px-1 text-[14px] text-ink-faint">
              {reading ? `FollowUp is reading ${siteName(reading.includes("://") ? reading : `https://${reading}`)}…` : "FollowUp is reading your Instagram posts…"}
            </p>
          </>
        )}
        {/* The site doesn't look like this business's (A-332): one question, then "Yes, that's mine" reads it, "No" keeps the link in the box to fix. */}
        {siteCheck && !busy && (
          <>
            <YouSay text={siteCheck.site} />
            <FollowUpSays text={siteCheck.line} />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
              <button type="button" onClick={() => void readSite(true)} disabled={busy} className={OUTLINED} style={{ borderColor: "var(--line-strong)" }}>
                Yes, that&apos;s mine
              </button>
              <button
                type="button"
                onClick={() => {
                  setSiteCheck(null);
                  focusBox();
                }}
                disabled={busy}
                className={QUIET}
              >
                No, wrong link
              </button>
            </div>
          </>
        )}
        {siteSkipped && <p className="-mt-2 px-1 text-[13.5px] text-ink-faint">Skipped.</p>}
        {siteTurn && (
          <>
            {siteTurn.said && <YouSay text={siteTurn.said} />}
            {siteTurn.line && <p className="px-1 text-[14.5px] leading-relaxed text-ink-soft">{siteTurn.line}</p>}
          </>
        )}

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

        {!pending && !askSite && <FollowUpSays text={topic.question} />}
        {!pending && !askSite && example && <p className="-mt-2 px-1 text-[13.5px] text-ink-faint">{example}</p>}
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
          void (askSite ? readSite() : send());
        }}
      >
        <label htmlFor="tell-answer" className="sr-only">
          {askSite ? "Your website link" : "Your answer"}
        </label>
        <input
          id="tell-answer"
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={askSite ? 200 : MAX_ANSWER}
          placeholder={askSite ? "Your website link…" : "Answer in your own words…"}
          autoComplete="off"
          {...(askSite ? { inputMode: "url" as const, autoCapitalize: "none", autoCorrect: "off", spellCheck: false } : {})}
          className="min-h-10 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-faint"
        />
        <button
          type="submit"
          disabled={busy || (askSite ? !text.trim() && !(site.instagram !== null && readInstagram) : !text.trim())}
          className="min-h-10 shrink-0 rounded-full px-[18px] text-[15px] font-medium disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--on-accent)" }}
        >
          {/* No link, Instagram ticked: it reads the posts alone, and says so. */}
          {askSite ? (busy ? "Reading…" : text.trim() || site.instagram === null || !readInstagram ? "Read it" : "Read Instagram") : "Send"}
        </button>
      </form>
      {errorLine}
      <div className="mt-2 flex items-center justify-between px-1">
        {askSite ? (
          <button type="button" onClick={() => void skipSite()} disabled={busy} className={QUIET}>
            No website, skip this
          </button>
        ) : (
          <button type="button" onClick={() => void skip()} disabled={busy} className={QUIET}>
            Skip this one
          </button>
        )}
        <Link href={doneHref} className={QUIET}>
          Finish later
        </Link>
      </div>
    </div>
  );
}

/** "See what it read" (A-328): the owner's own pages, as people say them, and how many posts. Plain text, not links. */
function WhatItRead({ site }: { site: SiteNote }) {
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-[16px] border border-line bg-card px-3.5 py-3 text-[14.5px] leading-relaxed text-ink-soft">
      {site.url && site.pages.length > 0 && (
        <div>
          <p>
            {site.pages.length === 1 ? "1 page" : `${site.pages.length} pages`} of {siteName(site.url)}:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {site.pages.map((p) => (
              <li key={p} className="break-all">
                {p.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "")}
              </li>
            ))}
          </ul>
        </div>
      )}
      {site.posts > 0 && <p>Your last {site.posts === 1 ? "Instagram post" : `${site.posts} Instagram posts`}.</p>}
      <p className="text-[13px] text-ink-faint">Only what anyone can see. Nothing from comments or messages.</p>
    </div>
  );
}

/** "Hours and Languages", "Hours, Payment and Languages". */
function listed(labels: readonly string[]): string {
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}
