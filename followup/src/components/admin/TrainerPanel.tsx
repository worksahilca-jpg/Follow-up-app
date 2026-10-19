"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { INDUSTRY_SHORT } from "@/lib/industries";
import type { TrainerCard, TrainerTurn } from "@/lib/trainer";

/**
 * "Claude on the Train page" (A-298): the column beside Talk to it (its own tab on a phone). The founder talks to
 * Claude about the test chat; Claude answers with words and cards: a rule it proposes (Save rule), a rule it saved,
 * changed or removed (Undo), and replies it tested. No avatar, no typing dots (S-13): a plain line while it works.
 */

type Rule = { id: string; trade: string; text: string; when: string };
type Turn = { from: "customer" | "followup"; text: string };

const shortOf = (trade: string) => INDUSTRY_SHORT[trade as keyof typeof INDUSTRY_SHORT] ?? trade;
const solid = "inline-flex min-h-11 items-center rounded-full px-5 text-[15px] font-semibold disabled:opacity-40";
const solidStyle = { background: "var(--accent)", color: "var(--on-accent)" };
const quiet = "min-h-11 underline underline-offset-4 disabled:opacity-50";

async function post(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, data: { message: "Couldn't reach FollowUp. Check your connection and try again." } };
  }
}

type Props = {
  ready: boolean;
  initial: TrainerTurn[];
  rules: Rule[];
  trade: string;
  channel: "instagram" | "messenger" | "email";
  turns: Turn[];
  focus: number | null;
  onClearFocus: () => void;
};

const TrainerPanel = forwardRef<HTMLTextAreaElement, Props>(function TrainerPanel(
  { ready, initial, rules, trade, channel, turns, focus, onClearFocus },
  inputRef
) {
  const router = useRouter();
  const [talk, setTalk] = useState<TrainerTurn[]>(initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Rules saved from a card in this visit, by "trade|text", until the page's rules catch up.
  const [savedHere, setSavedHere] = useState<Record<string, string>>({});
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [talk.length, busy]);

  const kindRules = rules.filter((r) => r.trade === trade).length;
  const focused = focus !== null ? turns[focus] : undefined;

  async function send() {
    const message = draft.trim();
    if (!message || busy) return;
    setTalk((t) => [...t, { id: `local-${t.length}`, role: "founder", text: message, cards: [], when: new Date().toISOString() }]);
    setDraft("");
    setBusy(true);
    setError(null);
    const { ok, data } = await post("/api/admin/trainer", { action: "ask", message, trade, channel, turns: turns.slice(-48), focus });
    setBusy(false);
    if (!ok) {
      setError(String(data.message ?? "Claude couldn't answer just now. Try again."));
      return;
    }
    const turn = data.turn as TrainerTurn;
    setTalk((t) => [...t, turn]);
    onClearFocus();
    if (turn.cards.some((c) => c.kind === "saved" || c.kind === "changed" || c.kind === "removed")) router.refresh();
  }

  function isSaved(c: Extract<TrainerCard, { kind: "proposal" }>): string | null {
    const key = `${c.trade}|${c.text}`;
    if (savedHere[key]) return savedHere[key];
    return rules.find((r) => r.trade === c.trade && r.text === c.text)?.id ?? null;
  }

  async function saveProposal(c: Extract<TrainerCard, { kind: "proposal" }>) {
    setBusy(true);
    setError(null);
    const { ok, data } = c.replacesId
      ? await post("/api/admin/train", { action: "rule-edit", id: c.replacesId, text: c.text })
      : await post("/api/admin/train", { action: "rule-add", trade: c.trade, text: c.text });
    setBusy(false);
    if (!ok) {
      setError(String(data.message ?? "That didn't save. Try again."));
      return;
    }
    const id = c.replacesId ?? String((data.rule as { id?: string } | undefined)?.id ?? "");
    setSavedHere((s) => ({ ...s, [`${c.trade}|${c.text}`]: id }));
    router.refresh();
  }

  async function undo(id: string, key?: string) {
    setBusy(true);
    const { ok } = await post("/api/admin/train", { action: "rule-undo", id });
    setBusy(false);
    if (!ok) {
      setError("That didn't undo. It may be gone already.");
      return;
    }
    if (key) setSavedHere((s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== key)));
    setTalk((t) => t.map((x) => ({ ...x, cards: x.cards.map((c) => (c.kind === "saved" && c.id === id ? { ...c, kind: "removed" as const } : c)) })));
    router.refresh();
  }

  function card(c: TrainerCard, i: number) {
    if (c.kind === "proposal") {
      const saved = isSaved(c);
      return (
        <div key={i} className="rounded-xl border bg-paper px-3.5 py-3" style={{ borderColor: "var(--line-strong)" }}>
          <p className="text-[12.5px] text-ink-faint">
            {c.replacesId ? "New wording" : "New rule"} · {shortOf(c.trade)}
          </p>
          {c.replacesText && <p className="mt-1 text-[14px] text-ink-faint line-through">{c.replacesText}</p>}
          <p className="mt-1 font-semibold">{c.text}</p>
          {saved ? (
            <p className="mt-2 text-[13.5px] text-ink-soft">
              Saved. Every {shortOf(c.trade)} business answers this way now.{" "}
              {!c.replacesId && (
                <button type="button" onClick={() => undo(saved, `${c.trade}|${c.text}`)} disabled={busy} className={quiet}>
                  Undo
                </button>
              )}
            </p>
          ) : (
            <div className="mt-2.5 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => saveProposal(c)} disabled={busy} className={solid} style={solidStyle}>
                {c.replacesId ? "Save new wording" : "Save rule"}
              </button>
              <span className="text-[13.5px] text-ink-soft">Or tell Claude what to change.</span>
            </div>
          )}
        </div>
      );
    }
    if (c.kind === "test") {
      return (
        <div key={i} className="border-t border-line pt-2 text-[14px] first:border-t-0 first:pt-0">
          <p className="text-ink-soft">“{c.customer}”</p>
          <p className="mt-0.5">{c.reply}</p>
        </div>
      );
    }
    const verb = c.kind === "saved" ? "Saved" : c.kind === "changed" ? "Changed" : "Removed";
    return (
      <p key={i} className="text-[14px] text-ink-soft">
        {verb} · {shortOf(c.trade)}: <span className={c.kind === "removed" ? "line-through" : "text-ink"}>{c.text}</span>{" "}
        {c.kind === "saved" && (
          <button type="button" onClick={() => undo(c.id)} disabled={busy} className={quiet}>
            Undo
          </button>
        )}
      </p>
    );
  }

  /** Tests are shown together as one list; everything else in the order Claude made it. */
  function cards(list: TrainerCard[]) {
    const tests = list.filter((c) => c.kind === "test");
    const rest = list.filter((c) => c.kind !== "test");
    return (
      <>
        {tests.length > 0 && (
          <div className="mt-2.5 rounded-xl border border-line bg-paper px-3.5 py-3">
            <p className="mb-2 text-[12.5px] text-ink-faint">
              {tests.length === 1 ? "FollowUp’s answer in a test" : `FollowUp’s answers in ${tests.length} tests`}
            </p>
            <div className="flex flex-col gap-2">{tests.map(card)}</div>
          </div>
        )}
        {rest.length > 0 && <div className="mt-2.5 flex flex-col gap-2.5">{rest.map(card)}</div>}
      </>
    );
  }

  return (
    <section aria-labelledby="claude-title" className="flex min-h-0 flex-col rounded-2xl border border-line bg-card lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)]">
      <div className="border-b border-line px-5 pb-3.5 pt-4">
        <h2 id="claude-title" className="text-lg font-semibold">
          Claude
        </h2>
        <p className="mt-0.5 text-[13.5px] text-ink-soft">
          Knows the plan, your {kindRules} {shortOf(trade)} {kindRules === 1 ? "rule" : "rules"} and what you told it before. Changes rules
          only when you say yes.
        </p>
      </div>

      <div className="flex min-h-[18rem] flex-1 flex-col gap-4 overflow-y-auto px-5 py-4" aria-live="polite">
        {!ready && (
          <p className="text-[14px] text-ink-soft">
            Claude isn’t set up yet. Add the Anthropic key and the model name in Vercel, and it starts working here.
          </p>
        )}
        {ready && talk.length === 0 && (
          <p className="text-[14px] text-ink-soft">
            Under any answer in the chat, tap “Ask Claude” and say what’s wrong, your way. Or just ask it something.
          </p>
        )}
        {talk.map((t) =>
          t.role === "founder" ? (
            <p key={t.id} className="max-w-[88%] self-end whitespace-pre-wrap break-words rounded-[16px_16px_4px_16px] px-3.5 py-2.5" style={{ background: "var(--card-2)" }}>
              {t.text}
            </p>
          ) : (
            <div key={t.id} className="min-w-0">
              <p className="mb-1 text-[12.5px] text-ink-faint">Claude</p>
              <p className="whitespace-pre-wrap break-words">{t.text}</p>
              {cards(t.cards)}
            </div>
          )
        )}
        {busy && (
          <p role="status" className="text-[14px] text-ink-soft">
            Claude is working on it. Testing replies can take up to a minute.
          </p>
        )}
        {error && (
          <p role="alert" className="text-[14px]" style={{ color: "var(--coral)" }}>
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
        className="border-t border-line px-4 pb-4 pt-3"
      >
        {focused && (
          <p className="mb-2 flex items-start gap-2 text-[13px] text-ink-soft">
            <span className="min-w-0 flex-1 truncate">About: “{focused.text}”</span>
            <button type="button" onClick={onClearFocus} className="shrink-0 underline underline-offset-4">
              Remove
            </button>
          </p>
        )}
        <label htmlFor="claude-draft" className="sr-only">
          Tell Claude what’s wrong
        </label>
        <div className="flex items-end gap-2 rounded-2xl border border-line-strong bg-paper py-1.5 pl-3.5 pr-1.5 focus-within:border-ink">
          <textarea
            id="claude-draft"
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={3}
            maxLength={4000}
            disabled={!ready}
            placeholder={ready ? "Tell Claude what’s wrong…" : "Claude isn’t set up yet"}
            className="min-w-0 flex-1 resize-none bg-transparent py-1.5 text-[16px] leading-snug"
            // The box around it shows focus (focus-within); the global outline is unlayered, so only inline beats it.
            style={{ outline: "none", background: "transparent" }}
          />
          <button
            type="submit"
            disabled={!ready || !draft.trim() || busy}
            className="min-h-10 shrink-0 rounded-full px-[18px] text-[15px] font-medium disabled:opacity-50"
            style={solidStyle}
          >
            Send
          </button>
        </div>
      </form>
    </section>
  );
});

export default TrainerPanel;
