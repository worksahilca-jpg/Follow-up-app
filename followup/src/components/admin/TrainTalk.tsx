"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { INDUSTRIES, INDUSTRY_SHORT } from "@/lib/industries";
import TrainerPanel from "@/components/admin/TrainerPanel";
import type { TrainerTurn } from "@/lib/trainer";

/**
 * /admin/train → Talk to it (A-294, founder 2026-10-18: "Add a section where I will be talking to follow up, and I will
 * be teaching it what to reply"). The founder writes as a customer and FollowUp answers the way it would for a real one,
 * as the chosen kind of business. Under each answer: Good (keep it as an example), Teach a better reply (write what it
 * should say), or Tell FollowUp what's wrong (A-297: say it your way; FollowUp turns it into a rule for that kind of
 * business and writes the answer again with it, the old one crossed out above). Examples and rules have Undo; the
 * kind's rules are listed under the chat with Change the wording and Undo.
 *
 * A-298: Claude sits beside the chat (its own tab on a phone). Once it's set up, "Ask Claude" takes the place of
 * "Tell FollowUp what's wrong": it points Claude at that answer, and the founder talks it through there.
 */

type Channel = "instagram" | "messenger" | "email";
type Rule = { id: string; trade: string; text: string; when: string };
type Before = { qualification: unknown; contactAsked: boolean };
type Turn = {
  from: "customer" | "followup";
  text: string;
  /** FollowUp's own words, kept while a taught reply stands in their place (for Undo). */
  original?: string;
  saved?: { id: string; kind: "good" | "taught" };
  /** Where things stood before this answer was written, so it can be written again from the same point. */
  before?: Before;
  /** The answer a rule replaced, shown crossed out above the new one. */
  replaced?: string;
  rule?: { id: string; text: string };
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
const solid = "inline-flex min-h-11 items-center rounded-full px-5 text-[15px] font-semibold disabled:opacity-40";
const solidStyle = { background: "var(--accent)", color: "var(--on-accent)" };
const quiet = "min-h-11 underline underline-offset-4 disabled:opacity-50";

async function post(body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch("/api/admin/train", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, data: { message: "Couldn't reach FollowUp. Check your connection and try again." } };
  }
}

function day(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TrainTalk({
  rules = [],
  claudeReady = false,
  trainer = [],
}: {
  rules?: Rule[];
  claudeReady?: boolean;
  trainer?: TrainerTurn[];
}) {
  const router = useRouter();
  const [view, setView] = useState<"talk" | "claude">("talk");
  const [focus, setFocus] = useState<number | null>(null);
  const claudeInput = useRef<HTMLTextAreaElement>(null);
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
  const [coaching, setCoaching] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [rewording, setRewording] = useState<string | null>(null);
  const [wording, setWording] = useState("");
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
    setCoaching(null);
    setFocus(null);
    setError(null);
  }

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    const next: Turn[] = [...turns, { from: "customer", text }];
    const before: Before = { qualification, contactAsked };
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
    setTurns([...next, { from: "followup", text: String(data.reply ?? ""), before }]);
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
    setTurns((ts) => ts.map((t, j) => (j !== i ? t : { ...t, text: t.original ?? t.text, original: undefined, saved: undefined })));
    router.refresh();
  }

  /** "Tell FollowUp what's wrong" (A-297): the founder's words become a rule, and the answer is written again. */
  async function coach(i: number) {
    const words = note.trim();
    if (!words || busy) return;
    const turn = turns[i];
    const last = i === turns.length - 1;
    setBusy(true);
    setError(null);
    const { ok, data } = await post({
      action: "coach",
      trade,
      channel,
      context: turns.slice(0, i - 1).slice(-TURNS_SENT).map((t) => ({ from: t.from, text: t.text })),
      customerSaid: turns[i - 1].text,
      followUpReply: turn.text,
      note: words,
      qualification: turn.before?.qualification ?? null,
      contactAsked: turn.before?.contactAsked ?? false,
    });
    setBusy(false);
    if (!ok) {
      setError(String(data.message ?? "That didn't work. Try again."));
      return;
    }
    const rule = data.rule as { id: string; text: string };
    const reply = typeof data.reply === "string" && data.reply ? data.reply : null;
    setTurns((ts) =>
      ts.map((t, j) =>
        j !== i ? t : reply ? { ...t, replaced: t.text, text: reply, rule, saved: undefined, original: undefined } : { ...t, rule }
      )
    );
    // Rewriting the newest answer changes where the conversation stands; an earlier one leaves it as it is.
    if (reply && last) {
      setQualification(data.qualification ?? null);
      setContactAsked(Boolean(data.contactAsked));
    }
    if (!reply && data.message) setError(String(data.message));
    setCoaching(null);
    setNote("");
    router.refresh();
  }

  async function undoRule(id: string) {
    setBusy(true);
    const { ok } = await post({ action: "rule-undo", id });
    setBusy(false);
    if (!ok) {
      setError("That didn't undo. Try again.");
      return;
    }
    setTurns((ts) => ts.map((t) => (t.rule?.id === id ? { ...t, rule: undefined } : t)));
    router.refresh();
  }

  async function saveWording(id: string) {
    const text = wording.trim();
    if (!text || busy) return;
    setBusy(true);
    const { ok } = await post({ action: "rule-edit", id, text });
    setBusy(false);
    if (!ok) {
      setError("That didn't save. Try again.");
      return;
    }
    setTurns((ts) => ts.map((t) => (t.rule?.id === id ? { ...t, rule: { id, text } } : t)));
    setRewording(null);
    router.refresh();
  }

  const short = INDUSTRY_SHORT[trade];
  const kindRules = rules.filter((r) => r.trade === trade);

  function wordingBox(id: string) {
    return (
      <div className="mt-2">
        <label htmlFor={`rule-wording-${id}`} className="sr-only">
          The rule, in your words
        </label>
        <textarea
          id={`rule-wording-${id}`}
          value={wording}
          onChange={(e) => setWording(e.target.value)}
          rows={2}
          maxLength={300}
          className="w-full rounded-xl border bg-card px-3.5 py-2.5 text-[15px] leading-relaxed"
          style={{ borderColor: "var(--line-strong)" }}
        />
        <div className="mt-2 flex items-center gap-3">
          <button type="button" onClick={() => saveWording(id)} disabled={!wording.trim() || busy} className={solid} style={solidStyle}>
            Save
          </button>
          <button type="button" onClick={() => setRewording(null)} className={`${quiet} text-ink-soft`}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div role="group" aria-label="Show" className="mb-5 grid grid-cols-2 rounded-full p-1 text-[15px] lg:hidden" style={{ background: "var(--card-2)" }}>
        {(["talk", "claude"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className="min-h-10 rounded-full font-medium"
            style={view === v ? { background: "var(--card)", boxShadow: "0 1px 2px rgba(0,0,0,.08)" } : { color: "var(--ink-soft)" }}
          >
            {v === "talk" ? "Talk to it" : "Claude"}
          </button>
        ))}
      </div>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-8">
      <div className={view === "claude" ? "hidden lg:block" : ""}>
      <p className="text-ink-soft">You write as the customer. Keep the good answers, and tell FollowUp what’s wrong with the rest.</p>

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
              {t.replaced && (
                <div className="mb-3">
                  <p className="mb-1 text-[12.5px] text-ink-faint">FollowUp, before</p>
                  <p className="max-w-[86%] whitespace-pre-wrap break-words rounded-[18px_18px_18px_4px] border border-line px-3.5 py-2.5 text-ink-faint line-through">
                    {t.replaced}
                  </p>
                </div>
              )}
              <p className="mb-1 text-[12.5px] text-ink-faint">
                {t.saved?.kind === "taught" ? "What it should say" : t.replaced ? "FollowUp, with your rule" : "FollowUp"}
              </p>
              <p className="max-w-[86%] whitespace-pre-wrap break-words rounded-[18px_18px_18px_4px] border border-line px-3.5 py-2.5">{t.text}</p>

              {t.rule && (
                <div className="mt-3 max-w-[86%] border-l-2 pl-3" style={{ borderColor: "var(--ink)" }}>
                  <p className="text-[12.5px] text-ink-faint">FollowUp’s new rule · {short}</p>
                  {rewording === t.rule.id ? (
                    wordingBox(t.rule.id)
                  ) : (
                    <>
                      <p className="mt-1 font-semibold">{t.rule.text}</p>
                      <p className="mt-1 text-[13.5px] text-ink-soft">
                        Every {short} business answers this way now.{" "}
                        <button type="button" onClick={() => undoRule(t.rule!.id)} disabled={busy} className={quiet}>
                          Undo
                        </button>
                        {" · "}
                        <button
                          type="button"
                          onClick={() => {
                            setRewording(t.rule!.id);
                            setWording(t.rule!.text);
                          }}
                          disabled={busy}
                          className={quiet}
                        >
                          Change the wording
                        </button>
                      </p>
                    </>
                  )}
                </div>
              )}

              {t.saved ? (
                <p className="mt-1.5 text-[13.5px] text-ink-soft">
                  {t.saved.kind === "good" ? "Kept as a good answer." : "Taught."} {short} businesses answer like this now.{" "}
                  <button type="button" onClick={() => undo(i)} disabled={busy} className={quiet}>
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
                    <button type="button" onClick={() => keep(i, better.trim())} disabled={!better.trim() || busy} className={solid} style={solidStyle}>
                      Save
                    </button>
                    <button type="button" onClick={() => setTeaching(null)} className={`${quiet} text-ink-soft`}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : coaching === i ? (
                <div className="mt-2.5 max-w-[86%]">
                  <label htmlFor={`talk-wrong-${i}`} className="mb-1 block text-[12.5px] text-ink-faint">
                    What’s wrong with this reply? Say it your way.
                  </label>
                  <textarea
                    id={`talk-wrong-${i}`}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    maxLength={1500}
                    autoFocus
                    placeholder="Too cold. Ask which listing they saw and offer a call."
                    className="w-full rounded-xl border bg-card px-3.5 py-2.5 text-[15px] leading-relaxed"
                    style={{ borderColor: "var(--line-strong)" }}
                  />
                  <div className="mt-2 flex items-center gap-3">
                    <button type="button" onClick={() => coach(i)} disabled={!note.trim() || busy} className={solid} style={solidStyle}>
                      {busy ? "Fixing…" : "Fix it"}
                    </button>
                    <button type="button" onClick={() => setCoaching(null)} className={`${quiet} text-ink-soft`}>
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
                      setCoaching(null);
                      setBetter(t.text);
                    }}
                    disabled={busy}
                    className={pill}
                    style={pillStyle(false)}
                  >
                    Teach a better reply
                  </button>
                  {claudeReady ? (
                    <button
                      type="button"
                      onClick={() => {
                        setFocus(i);
                        setTeaching(null);
                        setView("claude");
                        requestAnimationFrame(() => claudeInput.current?.focus());
                      }}
                      aria-pressed={focus === i}
                      className={pill}
                      style={focus === i ? pillStyle(true) : { borderColor: "var(--ink)" }}
                    >
                      Ask Claude
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setCoaching(i);
                        setTeaching(null);
                        setNote("");
                      }}
                      disabled={busy}
                      className={pill}
                      style={{ borderColor: "var(--ink)" }}
                    >
                      Tell FollowUp what’s wrong
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          )
        )}
        {busy && (turns[turns.length - 1]?.from === "customer" || coaching !== null) && (
          <p role="status" className="text-ink-soft">
            {coaching !== null ? "FollowUp is writing the rule and the reply again…" : "FollowUp is writing…"}
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

      <section className="mt-8 border-t border-line pt-5" aria-labelledby="talk-rules">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="talk-rules" className="text-lg font-semibold">
            Your rules for {short}
          </h2>
          <span className="text-sm text-ink-soft">
            {kindRules.length} {kindRules.length === 1 ? "rule" : "rules"}
          </span>
        </div>
        {kindRules.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">None yet. Under any reply, tap “Tell FollowUp what’s wrong” and say it your way.</p>
        ) : (
          <>
            <p className="mt-1.5 text-sm text-ink-soft">Every {short} business follows these. They’re saved for good; nothing is forgotten.</p>
            <ul className="mt-3">
              {kindRules.map((r) => (
                <li key={r.id} className="border-t border-line py-3">
                  {rewording === r.id ? (
                    wordingBox(r.id)
                  ) : (
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                      <div className="min-w-0">
                        <p className="break-words">{r.text}</p>
                        <p className="mt-1 text-[12.5px] text-ink-faint">{day(r.when)}</p>
                      </div>
                      <div className="flex gap-3 text-sm text-ink-soft">
                        <button
                          type="button"
                          onClick={() => {
                            setRewording(r.id);
                            setWording(r.text);
                          }}
                          disabled={busy}
                          className={quiet}
                        >
                          Change
                        </button>
                        <button type="button" onClick={() => undoRule(r.id)} disabled={busy} className={quiet}>
                          Undo
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      </div>
      <div className={view === "talk" ? "hidden lg:block" : ""}>
        <TrainerPanel
          ref={claudeInput}
          ready={claudeReady}
          initial={trainer}
          rules={rules}
          trade={trade}
          channel={channel}
          turns={turns.map((t) => ({ from: t.from, text: t.text }))}
          focus={focus}
          onClearFocus={() => setFocus(null)}
        />
      </div>
      </div>
    </div>
  );
}
