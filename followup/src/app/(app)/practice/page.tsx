"use client";

/**
 * "How FollowUp talks to your customers" (A-288). The owner writes as a customer and FollowUp answers here, the way it would answer
 * a real one (POST /api/practice/reply runs the real reply path). Under each answer, one line says what would really
 * happen to it. Nothing is stored or sent; the conversation lives in this page and "Start over" clears it.
 * "Your customer writes from" (A-289) picks the channel: Instagram and Messenger answer as short DMs with tap buttons,
 * Email as an email. Changing it starts the conversation over, because a real one happens in one place.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ScrollTitle from "@/components/app/ScrollTitle";

type Turn = { from: "customer" | "followup"; text: string; sends?: boolean; reason?: string | null; buttons?: string[] };
type Channel = "email" | "instagram" | "messenger";

const CHANNELS: { value: Channel; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "instagram", label: "Instagram" },
  { value: "messenger", label: "Messenger" },
];

export default function PracticePage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [qualification, setQualification] = useState<unknown>(null);
  const [channel, setChannel] = useState<Channel>("email");
  const [contactAsked, setContactAsked] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (turns.length) end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns.length, busy]);

  async function send(said?: string) {
    const text = (said ?? draft).trim();
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
        body: JSON.stringify({ turns: next.map(({ from, text }) => ({ from, text })), qualification, channel, contactAsked }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message ?? "FollowUp couldn't answer just now. Try again.");
      setTurns([...next, { from: "followup", text: data.reply, sends: data.verdict?.sends, reason: data.verdict?.reason ?? null, buttons: data.buttons ?? [] }]);
      setQualification(data.qualification ?? null);
      setContactAsked(Boolean(data.contactAsked));
    } catch (err) {
      // Give the message back so it can be sent again.
      setTurns(turns);
      if (said === undefined) setDraft(text);
      setError(err instanceof Error ? err.message : "FollowUp couldn't answer just now. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    setTurns([]);
    setQualification(null);
    setContactAsked(false);
    setDraft("");
    setError(null);
  }

  return (
    <div className="max-w-[640px] pb-10">
      <ScrollTitle title="Try it yourself" />
      <Link href="/settings#replies-out" className="inline-flex min-h-11 items-center text-[14px] text-ink-faint hover:text-ink">
        ‹ Sending replies
      </Link>
      <div className="flex items-start justify-between gap-3">
        <h1 className="title-serif ios-title1">How FollowUp talks to your customers</h1>
        <span className="mt-2 shrink-0 whitespace-nowrap rounded-full border px-[9px] text-[12px] font-semibold leading-[22px] text-ink-soft" style={{ borderColor: "var(--line-strong)" }}>
          Nothing is sent
        </span>
      </div>
      <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">
        Write the way a customer would. FollowUp answers the way it would answer them, with what it knows about your business, your free hours and your rules.
      </p>

      <div className="mt-5">
        <p id="practice-channel" className="mb-2 text-[14px] text-ink-soft">
          Your customer writes from
        </p>
        <div role="group" aria-labelledby="practice-channel" className="flex flex-wrap gap-2">
          {CHANNELS.map((c) => {
            const on = c.value === channel;
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={on}
                disabled={busy}
                onClick={() => {
                  if (on) return;
                  setChannel(c.value);
                  startOver();
                }}
                className="min-h-11 rounded-full border px-[18px] text-[15px] font-medium disabled:opacity-50"
                style={on ? { background: "var(--accent)", color: "var(--on-accent)", borderColor: "var(--accent)" } : { borderColor: "var(--line-strong)" }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[13.5px] text-ink-faint">Website forms and your CRM answer like Email.</p>
      </div>

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
              {/* A DM's tap buttons. Only the newest reply's can be tapped, as in the real chat; a tap answers as the customer. */}
              {!!t.buttons?.length && i === turns.length - 1 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {t.buttons.map((b) => (
                    <button
                      key={b}
                      type="button"
                      disabled={busy}
                      onClick={() => void send(b)}
                      className="min-h-11 rounded-full border bg-card px-3.5 text-[14px] disabled:opacity-50"
                      style={{ borderColor: "var(--line-strong)" }}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}
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
          placeholder={channel === "email" ? "Write as a customer…" : `Write as a customer on ${CHANNELS.find((c) => c.value === channel)?.label}…`}
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
