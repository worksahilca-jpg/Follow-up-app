"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { INDUSTRIES, INDUSTRY_SHORT } from "@/lib/industries";

/**
 * /admin/train → Talk to it (A-294, founder 2026-10-18: "Add a section where I will be talking to follow up, and I will
 * be teaching it what to reply"). The founder writes as a customer and FollowUp answers the way it would for a real one,
 * as the chosen kind of business. Under each answer: Good (keep it as an example) or Teach a better reply (write what it
 * should say). Either becomes an example for every business of that kind, with Undo. A taught reply takes the answer's
 * place in the chat, so the conversation carries on from what the business would really have said.
 */

type Channel = "instagram" | "messenger" | "email";
type Turn = {
  from: "customer" | "followup";
  text: string;
  /** FollowUp's own words, kept while a taught reply stands in their place (for Undo). */
  original?: string;
  saved?: { id: string; kind: "good" | "taught" };
};

const CHANNELS: { value: Channel; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "messenger", label: "Messenger" },
  { value: "email", label: "Email" },
];
const TURNS_SENT = 24;

const pill = "inline-flex min-h-11 items-center rounded-full border px-4 text-[15px] font-medium disabled:opacity-50";
function pillStyle(on: boolean) {
  return on ? { background: "var(--accent)", color: "var(--on-accent)", borderColor: "var(--accent)" } : { borderColor: "var(--line-strong)" };
}

async function post(body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch("/api/admin/train", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, data: { message: "Couldn't reach FollowUp. Check your connection and try again." } };
  }
}

export default function TrainTalk() {
  const router = useRouter();
  const [trade, setTrade] = useState<(typeof INDUSTRIES)[number]>("Real estate");
  const [channel, setChannel] = useState<Channel>("instagram");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [qualification, setQualification] = useState<unknown>(null);
  const [contactAsked, setContactAsked] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teaching, setTeaching] = useState<number | null>(null);
  const [better, setBetter] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (turns.length) end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns.length, busy]);

  function startOver() {
    setTurns([]);
    setQualification(null);
    setContactAsked(false);
    setConversationId(null);
    setTeaching(null);
    setError(null);
  }

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    const next: Turn[] = [...turns, { from: "customer", text }];
    setTurns(next);
    setDraft("");
    setBusy(true);
    setError(null);
    const { ok, data } = await post({
      action: "talk",
      trade,
      channel,
      turns: next.slice(-TURNS_SENT).map((t) => ({ from: t.from, text: t.text })),
      qualification,
      contactAsked,
    });
    setBusy(false);
    if (!ok) {
      setError(String(data.message ?? "FollowUp couldn't answer just now. Try again."));
      return;
    }
    setTurns([...next, { from: "followup", text: String(data.reply ?? "") }]);
    setQualification(data.qualification ?? null);
    setContactAsked(Boolean(data.contactAsked));
  }

  /** Keep FollowUp's answer at `i` (taught = null) or what it should have said. */
  async function keep(i: number, taught: string | null) {
    const before = turns.slice(0, i - 1);
    const turn = turns[i];
    setBusy(true);
    setError(null);
    const { ok, data } = await post({
      action: "teach",
      conversationId,
      trade,
      channel,
      context: before.slice(-8).map((t) => ({ from: t.from, text: t.text })),
      customerSaid: turns[i - 1].text,
      followUpReply: turn.original ?? turn.text,
      taught,
    });
    setBusy(false);
    if (!ok) {
      setError(String(data.message ?? "That didn't save. Try again."));
      return;
    }
    setConversationId(String(data.conversationId));
    const id = String(data.id);
    setTurns((ts) =>
      ts.map((t, j) =>
        j !== i ? t : taught ? { ...t, original: t.original ?? t.text, text: taught, saved: { id, kind: "taught" } } : { ...t, saved: { id, kind: "good" } }
      )
    );
    setTeaching(null);
    setBetter("");
    router.refresh();
  }

  async function undo(i: number) {
    const saved = turns[i].saved;
    if (!saved) return;
    setBusy(true);
    await post({ action: "untrain", id: saved.id });
    setBusy(false);
    setTurns((ts) => ts.map((t, j) => (j !== i ? t : { from: t.from, text: t.original ?? t.text })));
    router.refresh();
  }

  const short = INDUSTRY_SHORT[trade];

  return (
    <div className="mt-6">
      <p className="text-ink-soft">You write as the customer. Keep the good answers, teach it the ones it gets wrong.</p>

      <p className="mt-4 text-sm text-ink-soft" id="talk-trade">Kind of business</p>
      <div role="group" aria-labelledby="talk-trade" className="mt-2 flex flex-wrap gap-2">
        {INDUSTRIES.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={trade === t}
            onClick={() => {
              if (t !== trade) {
                setTrade(t);
                startOver();
              }
            }}
            className={pill}
            style={pillStyle(trade === t)}
          >
            {INDUSTRY_SHORT[t]}
          </button>
        ))}
      </div>

      <p className="mt-4 text-sm text-ink-soft" id="talk-channel">Customer writes from</p>
      <div role="group" aria-labelledby="talk-channel" className="mt-2 flex flex-wrap gap-2">
        {CHANNELS.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-pressed={channel === c.value}
            onClick={() => {
              if (c.value !== channel) {
                setChannel(c.value);
                startOver();
              }
            }}
            className={pill}
            style={pillStyle(channel === c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-4" aria-live="polite">
        {turns.map((t, i) =>
          t.from === "customer" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[78%] whitespace-pre-wrap break-words rounded-[18px_18px_4px_18px] px-3.5 py-2.5" style={{ background: "var(--card-2)" }}>
                {t.text}
              </p>
            </div>
          ) : (
            <div key={i}>
              <p className="mb-1 text-[12.5px] text-ink-faint">{t.saved?.kind === "taught" ? "What it should say" : "FollowUp"}</p>
              <p className="max-w-[86%] whitespace-pre-wrap break-words rounded-[18px_18px_18px_4px] border border-line px-3.5 py-2.5">{t.text}</p>

              {t.saved ? (
                <p className="mt-1.5 text-[13.5px] text-ink-soft">
                  {t.saved.kind === "good" ? "Kept as a good answer." : "Taught."} {short} businesses answer like this now.{" "}
                  <button type="button" onClick={() => undo(i)} disabled={busy} className="min-h-11 underline underline-offset-4 disabled:opacity-50">
                    Undo
                  </button>
                </p>
              ) : teaching === i ? (
                <div className="mt-2.5 max-w-[86%]">
                  <label htmlFor={`talk-better-${i}`} className="mb-1 block text-[12.5px] text-ink-faint">
                    What it should say
                  </label>
                  <textarea
                    id={`talk-better-${i}`}
                    value={better}
                    onChange={(e) => setBetter(e.target.value)}
                    rows={3}
                    autoFocus
                    className="w-full rounded-xl border bg-card px-3.5 py-2.5 text-[15px] leading-relaxed"
                    style={{ borderColor: "var(--line-strong)" }}
                  />
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => keep(i, better.trim())}
                      disabled={!better.trim() || busy}
                      className="inline-flex min-h-11 items-center rounded-full px-5 text-[15px] font-semibold disabled:opacity-40"
                      style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                    >
                      Save
                    </button>
                    <button type="button" onClick={() => setTeaching(null)} className="min-h-11 text-ink-soft underline underline-offset-4">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : i > 0 && turns[i - 1].from === "customer" ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => keep(i, null)} disabled={busy} className={pill} style={pillStyle(false)}>
                    Good
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTeaching(i);
                      setBetter(t.text);
                    }}
                    disabled={busy}
                    className={pill}
                    style={pillStyle(false)}
                  >
                    Teach a better reply
                  </button>
                </div>
              ) : null}
            </div>
          )
        )}
        {busy && turns[turns.length - 1]?.from === "customer" && (
          <p role="status" className="text-ink-soft">
            FollowUp is writing…
          </p>
        )}
        {error && (
          <p role="alert" style={{ color: "var(--coral)" }}>
            {error}
          </p>
        )}
        <div ref={end} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="mt-6 flex items-center gap-2 rounded-full border bg-card py-1.5 pl-4 pr-1.5"
        style={{ borderColor: "var(--line-strong)" }}
      >
        <label htmlFor="talk-draft" className="sr-only">
          Write as the customer
        </label>
        <input
          id="talk-draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write as the customer…"
          maxLength={1500}
          className="min-w-0 flex-1 bg-transparent text-[16px] outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim() || busy || turns.length >= TURNS_SENT * 2}
          className="min-h-10 shrink-0 rounded-full px-[18px] text-[15px] font-medium disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--on-accent)" }}
        >
          Send
        </button>
      </form>
      {turns.length > 0 && (
        <button type="button" onClick={startOver} className="mt-2 min-h-11 text-sm text-ink-soft underline underline-offset-4">
          Start over
        </button>
      )}
    </div>
  );
}
