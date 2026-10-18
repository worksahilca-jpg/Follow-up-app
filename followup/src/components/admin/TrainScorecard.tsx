"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * /admin/train → Scorecard (A-292). One moment at a time: what the customer wrote, what the business said, and what
 * FollowUp would say for the same moment as that kind of business (the real reply writer, replayed). The founder picks
 * which is better. The score at the top is how often FollowUp matched or beat the business.
 */

type Verdict = "followup" | "same" | "agent";
type Turn = { from: "customer" | "agent"; text: string };
type Example = { id: string; trade: string; channel: string; context: Turn[]; customerSaid: string; reply: string; followUpReply: string | null };
type Scored = Record<Verdict, number>;

const CHANNEL: Record<string, string> = { email: "Email", instagram: "Instagram", whatsapp: "WhatsApp", text: "Text" };

async function post(body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch("/api/admin/train", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, data: { message: "Couldn't reach FollowUp. Check your connection and try again." } };
  }
}

export default function TrainScorecard({ scored, total }: { scored: Scored; total: number }) {
  const router = useRouter();
  const [example, setExample] = useState<Example | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "done" | "error">(total > 0 ? "loading" : "done");
  const [error, setError] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);

  const judged = scored.followup + scored.same + scored.agent;
  const matched = scored.followup + scored.same;

  // Shows the answer to "score": the next moment, or why there isn't one.
  const show = useCallback(({ ok, data }: { ok: boolean; data: Record<string, unknown> }) => {
    setShowContext(false);
    if (!ok) {
      setState("error");
      setError(String(data.message ?? "FollowUp couldn't write this one."));
      return;
    }
    const ex = data.example as Example | null;
    setError(null);
    setExample(ex);
    setState(ex ? "ready" : "done");
  }, []);

  async function next() {
    setState("loading");
    show(await post({ action: "score" }));
  }

  useEffect(() => {
    if (total > 0) post({ action: "score" }).then(show);
  }, [show, total]);

  async function vote(verdict: Verdict) {
    if (!example) return;
    setState("loading");
    const { ok, data } = await post({ action: "vote", id: example.id, verdict });
    if (!ok) {
      setState("error");
      setError(String(data.message ?? "That didn't save. Try again."));
      return;
    }
    router.refresh();
    await next();
  }

  async function reset() {
    if (!window.confirm("Clear every answer and score again from the start? FollowUp writes each reply again with today's rules.")) return;
    await post({ action: "reset" });
    router.refresh();
    await next();
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      <section className="rounded-2xl border border-line p-5">
        {judged === 0 ? (
          <p className="text-ink-soft">{total === 0 ? "Add a conversation first. The scorecard fills as you judge each moment." : "Nothing judged yet. Start below."}</p>
        ) : (
          <>
            <p className="text-[40px] font-semibold leading-none tracking-[-0.02em] tabular-nums">
              {matched} <span className="text-xl font-medium text-ink-soft">of {judged}</span>
            </p>
            <p className="mt-2 text-sm text-ink-soft">times FollowUp matched or beat the business</p>
            <div className="mt-4 flex h-2 overflow-hidden rounded-full" style={{ background: "var(--card-2)" }} aria-hidden>
              <span style={{ width: `${(scored.followup / judged) * 100}%`, background: "var(--ink)" }} />
              <span style={{ width: `${(scored.same / judged) * 100}%`, background: "var(--ink-faint)" }} />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-soft">
              <span className="tabular-nums">
                FollowUp better {scored.followup} · Same {scored.same} · Business better {scored.agent}
              </span>
              <button type="button" onClick={reset} className="min-h-11 underline underline-offset-4">
                Score again from the start
              </button>
            </div>
          </>
        )}
      </section>

      {state === "loading" && (
        <p role="status" className="text-ink-soft">
          FollowUp is writing its reply…
        </p>
      )}
      {state === "error" && (
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p style={{ color: "var(--coral)" }}>{error}</p>
          <button type="button" onClick={next} className="min-h-11 underline underline-offset-4">
            Try again
          </button>
        </div>
      )}
      {state === "done" && total > 0 && <p className="text-ink-soft">Every moment is judged. Add another conversation to keep going.</p>}

      {state === "ready" && example && (
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">Moment {judged + 1} of {total}</h2>
            <span className="text-sm text-ink-soft">{example.trade} · {CHANNEL[example.channel] ?? example.channel}</span>
          </div>

          {example.context.length > 0 && (
            <button type="button" onClick={() => setShowContext((v) => !v)} className="mt-2 min-h-11 text-sm text-ink-soft underline underline-offset-4">
              {showContext ? "Hide what came before" : `Show what came before (${example.context.length})`}
            </button>
          )}
          {showContext && (
            <ol className="mt-1 mb-2">
              {example.context.map((t, i) => (
                <li key={i} className="flex gap-3 py-1.5 text-sm">
                  <span className="w-16 shrink-0 text-ink-soft">{t.from === "agent" ? "Business" : "Customer"}</span>
                  <span className="min-w-0 whitespace-pre-wrap break-words text-ink-soft">{t.text}</span>
                </li>
              ))}
            </ol>
          )}

          <p className="mt-3 text-sm text-ink-soft">The customer wrote</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-[17px]">{example.customerSaid}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line p-4">
              <p className="text-sm text-ink-soft">The business said</p>
              <p className="mt-1.5 whitespace-pre-wrap break-words">{example.reply}</p>
            </div>
            <div className="rounded-xl border border-line p-4">
              <p className="text-sm text-ink-soft">FollowUp would say</p>
              <p className="mt-1.5 whitespace-pre-wrap break-words">{example.followUpReply}</p>
            </div>
          </div>

          <p className="mt-5 text-sm text-ink-soft" id="train-which">Which is better?</p>
          <div role="group" aria-labelledby="train-which" className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["followup", "FollowUp better"],
                ["same", "Same"],
                ["agent", "Business better"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => vote(v)}
                className="inline-flex min-h-11 items-center rounded-full border px-4 text-[15px] font-medium"
                style={{ borderColor: "var(--line-strong)" }}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
