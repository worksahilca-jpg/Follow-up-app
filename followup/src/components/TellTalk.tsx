"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic } from "lucide-react";
import ScrollTitle from "@/components/app/ScrollTitle";
import type { Playback, TellState } from "@/lib/tellFollowUp";
import { MAX_TALK_SECONDS, MIN_TALK_SECONDS, talkClock } from "@/lib/tellTalk";

/**
 * "Talk to FollowUp about your business" (A-318): the 5-minute meeting said out loud. Ready (what to mention, one big
 * microphone), talking (a timer, the same list, Done talking), then the words go to the server, which writes them down
 * and answers with the meeting's own play-back. The recording only ever lives in this page's memory until it is sent.
 */

/** Whether this browser can record at all; checked after the page loads, never on the server. */
export function canRecord(): boolean {
  return typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

const noop = () => () => {};

/** Whether this browser can record: false while rendering on the server, then the browser's answer. */
export function useCanRecord(): boolean {
  return useSyncExternalStore(noop, canRecord, () => false);
}

/** The recording kinds to ask for, best first: phones and computers each take one of these. */
const KINDS = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

const QUIET = "inline-flex min-h-11 items-center text-[14px] text-ink-soft underline underline-offset-[3px] disabled:opacity-50";
const SECTION = "px-1 text-[13px] font-semibold text-ink-soft";

type Phase = "ready" | "talking" | "writing";

/** Why the microphone didn't start, said with what to do. */
function micProblem(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "The microphone is off for FollowUp. Turn it on in your browser's settings for this site, or type instead.";
  }
  if (name === "NotFoundError") return "FollowUp can't find a microphone on this device. Type instead.";
  return "FollowUp couldn't start the microphone. Try again, or type instead.";
}

export default function TellTalk({
  topics,
  again,
  onBack,
  onDone,
}: {
  /** The meeting's questions, by name: "Things to mention". */
  topics: string[];
  again: boolean;
  /** Back to typing, where the meeting was. */
  onBack: () => void;
  /** The server wrote it down and read it: the meeting's play-back. */
  onDone: (data: { state: TellState; playback: Playback | null }) => void;
}) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  // Start over: the recording that just stopped is thrown away instead of sent.
  const discard = useRef(false);

  function release() {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }

  // Leaving the page mid-talk switches the microphone off and sends nothing.
  useEffect(
    () => () => {
      discard.current = true;
      if (recorder.current?.state === "recording") recorder.current.stop();
      release();
    },
    []
  );

  async function start() {
    setError(null);
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setError(micProblem(err));
      return;
    }
    stream.current = media;
    const kind = KINDS.find((k) => MediaRecorder.isTypeSupported(k));
    let rec: MediaRecorder;
    try {
      // 32 kbps is plenty for a voice and keeps five minutes near 1 MB.
      rec = new MediaRecorder(media, { ...(kind ? { mimeType: kind } : {}), audioBitsPerSecond: 32_000 });
    } catch (err) {
      release();
      setError(micProblem(err));
      return;
    }
    chunks.current = [];
    discard.current = false;
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };
    // The clock starts when the recording really does.
    rec.onstart = () => {
      startedAt.current = Date.now();
    };
    rec.onstop = () => {
      const seconds = startedAt.current ? (Date.now() - startedAt.current) / 1000 : 0;
      const blob = new Blob(chunks.current, { type: rec.mimeType || kind || "audio/webm" });
      chunks.current = [];
      release();
      if (discard.current) return;
      if (seconds < MIN_TALK_SECONDS) {
        setPhase("ready");
        setError("That was too short. Talk a little longer, then tap Done talking.");
        return;
      }
      void send(blob, seconds);
    };
    recorder.current = rec;
    startedAt.current = 0;
    setElapsed(0);
    rec.start(1000);
    setPhase("talking");
    ticker.current = setInterval(() => {
      if (!startedAt.current) return;
      const s = (Date.now() - startedAt.current) / 1000;
      setElapsed(s);
      // Five minutes is the most FollowUp takes: it stops by itself and writes down what was said.
      if (s >= MAX_TALK_SECONDS && recorder.current?.state === "recording") recorder.current.stop();
    }, 250);
  }

  function done() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  function startOver() {
    discard.current = true;
    if (recorder.current?.state === "recording") recorder.current.stop();
    release();
    setElapsed(0);
    setPhase("ready");
  }

  async function send(blob: Blob, seconds: number) {
    setPhase("writing");
    const body = new FormData();
    body.append("audio", blob, "talk");
    body.append("seconds", String(Math.round(seconds)));
    body.append("again", again ? "1" : "0");
    try {
      const res = await fetch("/api/business/tell/talk", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok || !data.success) {
        setPhase("ready");
        setError(typeof data.message === "string" ? data.message : "That didn't go through. Try again, or type instead.");
        return;
      }
      onDone({ state: data.state as TellState, playback: (data.playback as Playback | null) ?? null });
    } catch {
      setPhase("ready");
      setError("That didn't go through. Check your connection and try again.");
    }
  }

  const mention = (
    <section className="mt-6 flex flex-col gap-2" aria-labelledby="talk-mention">
      <h2 id="talk-mention" className={SECTION}>
        Things to mention
      </h2>
      <ul className="overflow-hidden rounded-[16px] border border-line bg-card">
        {topics.map((t, i) => (
          <li key={t} className={"px-3.5 py-2.5 text-[15px] leading-snug" + (i ? " border-t border-line" : "")}>
            {t}
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <div className="max-w-[640px] pb-10">
      <ScrollTitle title="Tell FollowUp" />
      <button type="button" onClick={onBack} disabled={phase !== "ready"} className="inline-flex min-h-11 items-center text-[14px] text-ink-faint hover:text-ink disabled:opacity-50">
        ‹ Tell FollowUp
      </button>
      <p className="mt-2 text-[13px] text-ink-soft">Tell FollowUp about your business</p>
      <h1 className="title-serif ios-title1 mt-1">Talk about your business</h1>

      {phase === "ready" && (
        <>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">
            Talk for 2 or 3 minutes, the way you&apos;d brief a new assistant. FollowUp writes it down and shows you what it understood.
            Nothing is used until you say it&apos;s right.
          </p>
          {mention}
          <div className="mt-8 flex flex-col items-center text-center">
            <button
              type="button"
              onClick={() => void start()}
              aria-label="Start talking"
              className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-ink text-paper"
            >
              <Mic aria-hidden className="h-8 w-8" strokeWidth={2} />
            </button>
            <p className="mt-3 text-[16px] font-semibold">Start talking</p>
            <p className="mt-1.5 text-[14px] text-ink-soft">FollowUp keeps the words, never your voice.</p>
          </div>
          {error && (
            <p role="alert" className="mt-4 text-center text-[14px]" style={{ color: "var(--coral)" }}>
              {error}
            </p>
          )}
          <div className="mt-4 flex justify-center">
            <button type="button" onClick={onBack} className={QUIET}>
              Rather type? Answer one question at a time
            </button>
          </div>
        </>
      )}

      {phase === "talking" && (
        <>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">Say it the way you&apos;d say it to a person. Pause as long as you like.</p>
          <div className="mt-7 flex flex-col items-center">
            <p className="text-[44px] font-semibold leading-none tabular-nums" aria-label={`Recording, ${talkClock(elapsed)}`}>
              {talkClock(elapsed)}
            </p>
            <p className="mt-3 flex items-center gap-2 text-[14.5px] text-ink-soft">
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: "var(--coral)" }} />
              Listening
            </p>
          </div>
          {mention}
          <div className="mt-7 flex flex-col items-center gap-2">
            <button type="button" onClick={done} className="inline-flex h-12 items-center rounded-full bg-ink px-8 text-[15px] font-medium text-paper">
              Done talking
            </button>
            <button type="button" onClick={startOver} className={QUIET}>
              Start over
            </button>
          </div>
        </>
      )}

      {phase === "writing" && (
        <p className="mt-6 px-1 text-[15px] text-ink-faint" aria-live="polite">
          FollowUp is writing down what you said…
        </p>
      )}
    </div>
  );
}
