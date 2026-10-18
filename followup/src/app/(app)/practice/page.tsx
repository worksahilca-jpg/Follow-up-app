"use client";

/**
 * "Practise with FollowUp" (A-288). The owner writes as a customer and FollowUp answers here, the way it would answer
 * a real one (POST /api/practice/reply runs the real reply path). Under each answer, one line says what would really
 * happen to it. Nothing is stored or sent; the conversation lives in this page and "Start over" clears it.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ScrollTitle from "@/components/app/ScrollTitle";

type Turn = { from: "customer" | "followup"; text: string; sends?: boolean; reason?: string | null };

export default function PracticePage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [qualification, setQualification] = useState<unknown>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (turns.length) end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns.length, busy]);

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    const next: Turn[] = [...turns, { from: "customer", text }];
    setTurns(next);
    setDraft("");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/practice/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turns: next.map(({ from, text }) => ({ from, text })), qualification }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message ?? "FollowUp couldn't answer just now. Try again.");
      setTurns([...next, { from: "followup", text: data.reply, sends: data.verdict?.sends, reason: data.verdict?.reason ?? null }]);
      setQualification(data.qualification ?? null);
    } catch (err) {
      // Give the message back so it can be sent again.
      setTurns(turns);
      setDraft(text);
      setError(err instanceof Error ? err.message : "FollowUp couldn't answer just now. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    setTurns([]);
    setQualification(null);
    setDraft("");
    setError(null);
  }

  return (
    <div className="max-w-[640px] pb-10">
      <ScrollTitle title="Practise" />
      <Link href="/settings#replies-out" className="inline-flex min-h-11 items-center text-[14px] text-ink-faint hover:text-ink">
        ‹ Sending replies
      </Link>
      <div className="flex items-start justify-between gap-3">
        <h1 className="title-serif ios-title1">Practise with FollowUp</h1>
        <span className="mt-2 shrink-0 whitespace-nowrap rounded-full border px-[9px] text-[12px] font-semibold leading-[22px] text-ink-soft" style={{ borderColor: "var(--line-strong)" }}>
          Nothing is sent
        </span>
      </div>
      <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">
        Write the way a customer would. FollowUp answers the way it would answer them, with what it knows about your business, your free hours and your rules.
      </p>

      <div className="mt-6 flex flex-col gap-4" aria-live="polite">
        {turns.length === 0 && (
          <p className="text-[14px] text-ink-faint">For example: &ldquo;Hi, is the 3 bed on Elm Street still available?&rdquo;</p>
        )}
        {turns.map((t, i) =>
          t.from === "customer" ? (
            <div key={i} className="flex flex-col items-end">
              <span className="mb-1 px-1 text-[12.5px] text-ink-faint">You, as a customer</span>
              <p className="max-w-[80%] whitespace-pre-wrap rounded-[18px] rounded-br-[6px] px-3.5 py-2.5 text-[16px] leading-snug" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
                {t.text}
              </p>
            </div>
          ) : (
            <div key={i} className="flex flex-col items-start">
              <span className="mb-1 px-1 text-[12.5px] text-ink-faint">FollowUp</span>
              <p className="max-w-[88%] whitespace-pre-wrap rounded-[18px] rounded-bl-[6px] border border-line bg-card px-3.5 py-2.5 text-[16px] leading-normal">{t.text}</p>
              <p className="mt-1.5 flex items-center gap-1.5 px-1 text-[13.5px] text-ink-soft">
                <span aria-hidden className="inline-block h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: t.sends ? "var(--ink)" : "var(--state-needs)" }} />
                {t.sends ? "Would go out by itself" : `Would wait for you: ${t.reason ?? "you check it first"}`}
              </p>
            </div>
          ),
        )}
        {busy && <p className="px-1 text-[14px] text-ink-faint">FollowUp is writing…</p>}
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
        <label htmlFor="practice-message" className="sr-only">
          Write as a customer
        </label>
        <input
          id="practice-message"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={1500}
          placeholder="Write as a customer…"
          autoComplete="off"
          className="min-h-10 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-faint"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
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
      {turns.length > 0 && (
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={startOver} className="min-h-11 text-[14px] text-ink-soft underline underline-offset-[3px]">
            Start over
          </button>
        </div>
      )}
    </div>
  );
}
