"use client";

import { useEffect, useState } from "react";
import { MAX_EXAMPLE_TEXT } from "@/lib/ownerExampleLines";

/**
 * One practice reply a day on Today (A-330, src/lib/dailyPractice.ts). Drawn and approved 2026-10-27 ("yes build
 * it"): a made-up customer's message, the reply FollowUp would write, and Looks right / Change it / Not now. A change
 * is kept the way "Write it better" keeps one (A-290), so the next real reply reads it.
 *
 * The reply is written after the page shows (it takes a few seconds), and kept for this tab so a reload shows the same
 * one. Nothing is sent. If FollowUp can't write one, the card stays out of the way.
 */
type Props = { name: string; text: string };

type Phase = "loading" | "ready" | "editing" | "saved" | "right" | "gone";

const PILL_BLACK = "h-11 rounded-full bg-ink px-6 text-[14.5px] font-medium text-paper disabled:opacity-60";
const PILL_LINE = "h-11 rounded-full border border-line-strong bg-card px-5 text-[14.5px] text-ink hover:bg-card-2 disabled:opacity-60";
const LINK = "h-11 px-1 text-[14px] text-ink-soft underline underline-offset-2 disabled:opacity-60";

function cacheKey(text: string): string {
  return `fu:practice:${new Date().toISOString().slice(0, 10)}:${text}`;
}

async function post(url: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !data.success) throw new Error(typeof data.message === "string" ? data.message : "Couldn't save that. Try again.");
  return data;
}

export default function PracticeCard({ name, text }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [reply, setReply] = useState("");
  const [mine, setMine] = useState("");
  const [exampleId, setExampleId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // The reply kept for this tab, or a fresh one. Either way it arrives after the first paint.
    const load = async (): Promise<string> => {
      try {
        const kept = sessionStorage.getItem(cacheKey(text));
        if (kept) return kept;
      } catch {
        // A private window without storage writes it again; nothing else changes.
      }
      const data = await post("/api/practice/daily", { step: "reply" });
      const written = typeof data.reply === "string" ? data.reply.trim() : "";
      try {
        if (written) sessionStorage.setItem(cacheKey(text), written);
      } catch {
        // As above.
      }
      return written;
    };
    load()
      .then((written) => {
        if (cancelled) return;
        if (!written) return setPhase("gone");
        setReply(written);
        setPhase("ready");
      })
      .catch(() => {
        if (!cancelled) setPhase("gone");
      });
    return () => {
      cancelled = true;
    };
  }, [text]);

  async function done(next: Phase) {
    setBusy(true);
    setError(null);
    try {
      await post("/api/practice/daily", { step: "done" });
      setPhase(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const words = mine.trim();
    if (!words || busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await post("/api/practice/teach", { channel: "email", customerSaid: text, reply: words });
      setExampleId(typeof data.id === "string" ? data.id : null);
      await post("/api/practice/daily", { step: "done" });
      setMine(words);
      setPhase("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!exampleId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/practice/teach?id=${encodeURIComponent(exampleId)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Couldn't undo that. Try again.");
      setExampleId(null);
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't undo that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "gone") return null;

  const errorLine = error && (
    <p className="mt-2 text-[13px]" role="alert" style={{ color: "var(--coral)" }}>
      {error}
    </p>
  );

  if (phase === "saved") {
    return (
      <section className="mt-5 box p-4 sm:p-5 max-w-[640px]" role="status">
        <p className="text-[15px] leading-snug text-balance">Saved. FollowUp will answer like this from now on.</p>
        <p className="mt-2 text-[14px] leading-snug text-ink-soft whitespace-pre-line">“{mine}”</p>
        {errorLine}
        <div className="mt-3">
          <button type="button" disabled={busy} onClick={() => void undo()} className={LINK}>
            Undo
          </button>
        </div>
      </section>
    );
  }

  if (phase === "right") {
    return (
      <section className="mt-5 box p-4 sm:p-5 max-w-[640px]" role="status">
        <p className="text-[15px] leading-snug">Thanks. FollowUp will keep answering like this.</p>
        <p className="mt-1 text-[14px] text-ink-soft">Another one tomorrow, on a quiet day.</p>
      </section>
    );
  }

  return (
    <section className="mt-5 box p-4 sm:p-5 max-w-[640px]" aria-labelledby="practice-customer">
      <p className="text-[12.5px] text-ink-soft">Practice · a made-up customer · nothing is sent</p>
      <h2 id="practice-customer" className="mt-1 text-[17px] font-semibold leading-snug tracking-[-0.01em]">
        “{text}”
      </h2>
      {phase === "editing" ? (
        <>
          <label htmlFor="practice-mine" className="mt-3 block text-[13.5px] text-ink-soft">
            What would you say?
          </label>
          <textarea
            id="practice-mine"
            rows={5}
            maxLength={MAX_EXAMPLE_TEXT}
            value={mine}
            onChange={(e) => setMine(e.target.value)}
            className="mt-1.5 w-full rounded-[14px] border border-line bg-paper px-3.5 py-2.5 text-[16px] leading-normal"
          />
          {errorLine}
          <div className="mt-3 flex items-center gap-4">
            <button type="button" disabled={busy || !mine.trim()} onClick={() => void save()} className={PILL_BLACK}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button type="button" disabled={busy} onClick={() => setPhase("ready")} className={LINK}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-[13.5px] leading-normal text-ink-soft">How FollowUp would answer {name}. Is this how you&apos;d say it?</p>
          {phase === "loading" ? (
            <p className="mt-3 rounded-[14px] border border-line bg-paper px-3.5 py-2.5 text-[15px] leading-normal text-ink-faint" aria-live="polite">
              Writing how FollowUp would answer…
            </p>
          ) : (
            <p className="mt-3 rounded-[14px] border border-line bg-paper px-3.5 py-2.5 text-[16px] leading-normal whitespace-pre-line">{reply}</p>
          )}
          {errorLine}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <button type="button" disabled={busy || phase === "loading"} onClick={() => void done("right")} className={PILL_BLACK}>
              Looks right
            </button>
            <button
              type="button"
              disabled={busy || phase === "loading"}
              onClick={() => {
                setMine(reply);
                setError(null);
                setPhase("editing");
              }}
              className={PILL_LINE}
            >
              Change it
            </button>
            <button type="button" disabled={busy} onClick={() => void done("gone")} className={LINK}>
              Not now
            </button>
          </div>
        </>
      )}
    </section>
  );
}
