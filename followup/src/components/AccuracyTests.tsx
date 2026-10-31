"use client";

import { useState } from "react";
import {
  compareWithBefore,
  estimateRunMicros,
  flakyOnVersion,
  priceWords,
  runToShow,
  steadyVerdict,
  type RunSummary,
  type TestHistory,
  type TestId,
} from "@/lib/testRunMath";

/**
 * /admin → "Accuracy tests". One Run button per test, so the founder gets a
 * score from his phone instead of a browser console (founder, 2026-10-12:
 * "DO IT", after being handed a console one-liner).
 *
 * Each button posts to its own admin route, which runs FollowUp's real AI on
 * invented examples with known answers and answers with a score. Nothing
 * here touches a business's data. Each route is platform-admin only and
 * refuses requests from other sites; this page sits behind the same check.
 */

/** `caseName` is the test case a failure belongs to, when the name shown adds more (qualifying adds the item). */
type Failure = { name: string; detail: string; caseName?: string };
/** One whole conversation from the conversation test, shown in full so the founder can read how FollowUp talks. */
type Chat = { name: string; ok: boolean; task: string; lines: { who: "in" | "out"; text: string }[]; next: string; detail: string };
type Outcome = { headline: string; mustBeZero?: { label: string; count: number }[]; lines: string[]; failures: Failure[]; chats?: Chat[] };

type Test = {
  id: TestId;
  title: string;
  what: string;
  route: string;
  /** Sent as JSON when set; the reply test takes { model } to write with a bigger model. */
  body?: Record<string, unknown>;
  /** What "Running…" says about the wait; about two minutes unless set. */
  takes?: string;
  read: (r: Record<string, unknown>) => Outcome;
};

const num = (v: unknown) => (typeof v === "number" ? v : 0);
const list = <T,>(v: unknown) => (Array.isArray(v) ? (v as T[]) : []);

/** The reply test's answer, read the same way for the usual model and a bigger one. */
const readReplies = (r: Record<string, unknown>): Outcome => {
  const p = (r.problems ?? {}) as Record<string, unknown>;
  const counts = [
    [num(p.unanswered), "left a question unanswered"],
    [num(p.language), "in the wrong language"],
    [num(p.shape), "broke the DM shape rules"],
    [num(p.missing_fact), "missed a fact you gave"],
    [num(p.echo), "opened with \"Noted\""],
    [num(p.pressure), "pushed or rushed them"],
    [num(p.brag), "praised you"],
    [num(p.feeling), "missed or made up a feeling"],
    [num(p.generic), "could go to anyone, or read like a bot"],
  ] as const;
  return {
    headline: `${num(r.passed)} of ${num(r.cases)} replies passed every check`,
    mustBeZero: [{ label: "invented a fact", count: num(p.invented) }],
    lines: [...counts.filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`), ...(num(r.errors) ? [`${num(r.errors)} could not be checked`] : [])],
    failures: list<{ name: string; reply: string; detail: string }>(r.failures).map((f) => ({
      name: f.name,
      detail: `${f.detail}${f.reply ? ` · Reply: "${f.reply}"` : ""}`,
    })),
  };
};

/** The conversation test's answer (src/lib/conversationEval.ts): the counts, and every conversation in full. */
const readConversations = (r: Record<string, unknown>): Outcome => {
  const p = (r.problems ?? {}) as Record<string, unknown>;
  const counts = [
    [num(p.asked_again), "asked for something they'd already said"],
    [num(p.empty_nudge), "sent a follow-up with no reason to read it"],
    [num(p.repeated), "repeated an earlier message"],
    [num(p.stopped_wrongly), "stopped a customer who only said \"not now\""],
    [num(p.expectation), "missed what the conversation needed"],
    [num(p.unanswered), "left a question unanswered"],
    [num(p.language), "in the wrong language"],
    [num(p.shape), "broke the DM shape rules"],
    [num(p.missing_fact), "missed a fact you gave"],
    [num(p.pressure), "pushed or rushed them"],
    [num(p.brag), "praised you"],
    [num(p.feeling), "missed or made up a feeling"],
    [num(p.generic), "could go to anyone, or read like a bot"],
  ] as const;
  type Raw = { name: string; task: string; lines: { who: "in" | "out"; text: string }[]; next: string; problems: string[]; detail: string; error?: string };
  const chats = list<Raw>(r.chats);
  return {
    headline: `${num(r.passed)} of ${num(r.cases)} conversations passed every check`,
    mustBeZero: [
      { label: "invented a fact", count: num(p.invented) },
      { label: "kept going after a no", count: num(p.kept_going) },
    ],
    lines: [...counts.filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`), ...(num(r.errors) ? [`${num(r.errors)} could not be checked`] : [])],
    failures: chats
      .filter((c) => c.error || c.problems.length > 0)
      .map((c) => ({ name: c.name, detail: c.error ? `couldn't run: ${c.error}` : `${c.detail}${c.next ? ` · FollowUp: "${c.next}"` : ""}` })),
    chats: chats.map((c) => ({
      name: c.name,
      ok: !c.error && c.problems.length === 0,
      task: c.task,
      lines: list<{ who: "in" | "out"; text: string }>(c.lines),
      next: c.error ? `Couldn't run: ${c.error}` : c.next,
      detail: c.detail,
    })),
  };
};

const TESTS: Test[] = [
  {
    id: "email-check",
    title: "Is this a customer? Emails",
    what: "About 100 made-up emails. Real customers must come in; pitches, newsletters and friends are set aside.",
    route: "/api/admin/classifier-eval",
    read: (r) => {
      const total = num(r.passed) + num(r.failed) + num(r.errors);
      return {
        headline: `${num(r.passed)} of ${total} right`,
        lines: num(r.errors) ? [`${num(r.errors)} could not be checked`] : [],
        failures: list<{ name: string; expected: string; got: string; reason: string }>(r.failures).map((f) => ({
          name: f.name,
          detail: `should be ${f.expected}, got ${f.got}${f.reason ? `: ${f.reason}` : ""}`,
        })),
      };
    },
  },
  {
    id: "dm-check",
    title: "Is this a customer? Instagram and Messenger",
    what: "About 30 made-up first messages. Enquiries must come in; friends, jokes and pitches are set aside.",
    route: "/api/admin/dm-judge-eval",
    read: (r) => ({
      headline: `${num(r.right)} of ${num(r.cases)} right`,
      mustBeZero: [{ label: "customers set aside", count: num(r.customersSetAside) }],
      lines: [`${num(r.chatsLetThrough)} chats let through that weren't customers`],
      failures: list<{ name: string; expected: string; got: string; reason: string }>(r.failures).map((f) => ({
        name: f.name,
        detail: `should be ${f.expected}, got ${f.got}${f.reason ? `: ${f.reason}` : ""}`,
      })),
    }),
  },
  {
    id: "qualifying",
    title: "Qualifying a realtor's customer",
    what: "58 made-up chats, buyers and sellers. Where, when, money, agent, viewing: known only when the customer said it, then sorted into Ready, Warm, Later or Has an agent.",
    route: "/api/admin/qualification-eval",
    read: (r) => {
      const items = (r.items ?? {}) as Record<string, unknown>;
      return {
        headline: `${num(items.right)} of ${num(items.total)} answers right`,
        mustBeZero: [{ label: "made up", count: num(items.madeUp) }],
        lines: [
          `${num(items.missed)} missed`,
          `Labels right: ${num((r.sorting as Record<string, unknown> | undefined)?.right)} of ${num((r.sorting as Record<string, unknown> | undefined)?.total)}`,
          `Ready / Warm / Later right in ${num(r.tierRight)} of ${num(r.tierTotal)} chats`,
          ...(num(r.errors) ? [`${num(r.errors)} could not be checked`] : []),
        ],
        failures: list<{ name: string; item: string; expected: string; got: string; detail: string }>(r.failures).map((f) => ({
          name: `${f.name} · ${f.item}`,
          caseName: f.name,
          detail: `should be ${f.expected}, got ${f.got}${f.detail ? `: ${f.detail}` : ""}`,
        })),
      };
    },
  },
  {
    id: "replies",
    title: "Replies on Instagram and Messenger",
    what: "20 made-up realtor DMs, written by GPT-5.5, the AI live replies use. Each reply must answer every question, invent nothing, match their language, and sound like a person who read it: no pushing, no bragging.",
    route: "/api/admin/reply-eval",
    read: readReplies,
  },
  {
    id: "conversations",
    title: "Whole conversations: follow-ups, objections and \"no\"",
    what: "About 40 made-up realtor chats: follow-ups after they go quiet, \"just browsing\", \"is this a bot?\", long chats, and the \"no\" that must stop everything. On top of the reply checks: never ask again what they said, never an empty \"just checking in\", never keep going after a no. Every chat comes back in full to read.",
    route: "/api/admin/conversation-eval",
    takes: "Takes about four minutes. Keep this page open.",
    read: readConversations,
  },
  {
    id: "replies-gpt-5.4-mini",
    title: "Same replies, written by the small AI (GPT-5.4-mini)",
    what: "The same 20 DMs, written by the AI replies used before Oct 29 and checked the same way, to compare with the row above. It costs about a tenth as much per reply. Nothing customers get changes.",
    route: "/api/admin/reply-eval",
    body: { model: "gpt-5.4-mini" },
    read: readReplies,
  },
  {
    id: "replies-gpt-5.4",
    title: "Same replies, written by the middle AI (GPT-5.4)",
    what: "The same 20 DMs again, written by OpenAI's middle model. It costs about a third as much per reply. Nothing customers get changes.",
    route: "/api/admin/reply-eval",
    body: { model: "gpt-5.4" },
    read: readReplies,
  },
];


const dollars = (micros: number) => `$${(micros / 1_000_000).toFixed(2)}`;

/** A saved time in the reader's own clock. The server renders it in its own, so the browser's wins quietly. */
function When({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
    </time>
  );
}

/** A saved result read the way a fresh one is; a result saved by an older version that no longer reads shows nothing. */
function readSaved(test: Test, result: unknown): Outcome | null {
  if (!result || typeof result !== "object") return null;
  try {
    return test.read(result as Record<string, unknown>);
  } catch {
    return null;
  }
}

type Mode = "all" | "failed" | "recheck";

/** A quiet text button: the secondary actions under a result (one outlined button per row is the main one). */
function QuietButton({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="min-h-[44px] text-left text-sm font-medium underline underline-offset-4 disabled:opacity-60">
      {children}
    </button>
  );
}

function kindWords(r: RunSummary): string {
  if (r.kind === "recheck") return `checked ${new Set(r.ran.map((n) => n.replace(/ · try \d+$/, ""))).size} failures twice more`;
  if (r.kind === "only") return `only ${r.cases} that failed`;
  return `all ${r.cases}`;
}

function TestRow({ test, total, history }: { test: Test; total: number; history: TestHistory }) {
  const first = runToShow(history.runs);
  const [runs, setRuns] = useState<RunSummary[]>(history.runs);
  const [shownId, setShownId] = useState<string | null>(first?.id ?? null);
  const [outcome, setOutcome] = useState<Outcome | null>(() => (history.shown ? readSaved(test, history.shown.result) : null));
  const [busy, setBusy] = useState<Mode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unsaved, setUnsaved] = useState(false);

  const shown = runs.find((r) => r.id === shownId) ?? null;
  const recheck = shown ? (runs.find((r) => r.kind === "recheck" && r.recheckOf === shown.id) ?? null) : null;
  const steady = recheck ? steadyVerdict(recheck) : null;
  const change = shown ? compareWithBefore(shown, runs) : null;
  const flaky = new Set([...flakyOnVersion(runs, shown?.version ?? null), ...(steady ? [...steady.passedOnRetry, ...steady.flaky] : [])]);
  const failedNames = shown?.failed ?? [];
  const priceAll = priceWords(estimateRunMicros(test.id, runs, total, total));

  async function run(mode: Mode) {
    if (mode !== "all" && (!shown || failedNames.length === 0)) return;
    setBusy(mode);
    setError(null);
    const ask = mode === "failed" ? { only: failedNames } : mode === "recheck" ? { only: failedNames, repeat: 2, recheckOf: shown?.id } : {};
    try {
      const res = await fetch(test.route, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...test.body, ...ask }) });
      const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok || !body) {
        setError(typeof body?.message === "string" ? body.message : `The test stopped (error ${res.status}). Try again in a minute.`);
        return;
      }
      const saved = (body.saved ?? null) as RunSummary | null;
      if (saved) setRuns((rs) => [saved, ...rs]);
      // A recheck changes the verdict on the run it checked; the run shown stays.
      if (mode === "recheck") {
        if (!saved) setError("The recheck finished but couldn't be kept, so its verdict isn't shown. Try again in a minute.");
        return;
      }
      setOutcome(test.read(body));
      setShownId(saved?.id ?? null);
      setUnsaved(!saved);
    } catch {
      setError("The test didn't finish. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  const failures = outcome?.failures ?? [];
  const earlier = runs.filter((r) => r.id !== shown?.id);

  return (
    <div className="flex flex-col gap-3 border-t border-line px-5 py-4 first:border-t-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">{test.title}</p>
          <p className="text-sm text-ink-soft mt-0.5">{test.what}</p>
        </div>
        <button
          type="button"
          onClick={() => run("all")}
          disabled={busy !== null}
          className="shrink-0 rounded-full border border-ink px-4 min-h-[44px] text-sm font-medium disabled:opacity-60"
        >
          {busy === "all" ? "Running…" : shown || outcome ? "Run again" : "Run"}
          <span className="block text-xs font-normal text-ink-soft">{priceAll}</span>
        </button>
      </div>

      {busy && (
        <p className="text-sm text-ink-soft">
          {busy === "all" ? (test.takes ?? "Takes about two minutes. Keep this page open.") : "Takes a minute or two. Keep this page open."}
        </p>
      )}
      {error && (
        <p className="text-sm" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}

      {outcome && (
        <div className="flex flex-col gap-1.5 text-sm" aria-live="polite">
          <p className="text-xs text-ink-soft tabular-nums">
            {shown ? (
              <>
                {shown.kind === "only" ? "Only the ones that failed, run " : "Run "}
                <When iso={shown.createdAt} />
                {shown.costMicros != null ? ` · cost ${dollars(shown.costMicros)}` : ""}
                {shown.version ? ` · version ${shown.version}` : ""}
              </>
            ) : unsaved ? (
              "This run finished but couldn't be kept: it will be gone after a refresh."
            ) : null}
          </p>
          <p className="text-base font-medium tabular-nums">{outcome.headline}</p>
          {outcome.mustBeZero?.map((z) => (
            <p key={z.label} className="tabular-nums" style={{ color: z.count === 0 ? "var(--sage)" : "var(--coral)" }}>
              {z.count} {z.label} (should be 0)
            </p>
          ))}
          {outcome.lines.map((line) => (
            <p key={line} className="text-ink-soft tabular-nums">
              {line}
            </p>
          ))}

          {change && (change.nowPassing.length > 0 || change.nowFailing.length > 0) && (
            <details className="mt-1">
              <summary className="cursor-pointer text-ink-soft">
                Since <When iso={change.before.createdAt} />: {change.nowPassing.length} now pass{change.nowPassing.length === 1 ? "es" : ""}, {change.nowFailing.length} now fail
                {change.nowFailing.length === 1 ? "s" : ""}
              </summary>
              <ul className="mt-2 flex flex-col gap-1">
                {change.nowPassing.map((n) => (
                  <li key={`p-${n}`} className="break-words">
                    <span style={{ color: "var(--sage)" }}>Now passes: </span>
                    {n}
                  </li>
                ))}
                {change.nowFailing.map((n) => (
                  <li key={`f-${n}`} className="break-words">
                    <span style={{ color: "var(--coral)" }}>Now fails: </span>
                    {n}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {change && change.nowPassing.length === 0 && change.nowFailing.length === 0 && (
            <p className="text-ink-soft">
              The same cases passed and failed as on <When iso={change.before.createdAt} />.
            </p>
          )}

          {steady && shown && (
            <div className="mt-1 flex flex-col gap-0.5">
              <p className="font-medium tabular-nums">
                Checked twice more: {shown.kind === "full" ? `${shown.passed + steady.passedOnRetry.length} of ${shown.cases} pass the 2-of-3 rule. ` : ""}
                {steady.stillFailing.length} failed again
                {steady.passedOnRetry.length > 0 ? `, ${steady.passedOnRetry.length} passed both times` : ""}.
              </p>
              <p className="text-ink-soft">
                A case counts as failing only when it fails at least 2 times of 3. One that passed both extra times counts as passing and is marked
                flaky: the AI or its checker varies on it, so look before fixing.
              </p>
            </div>
          )}

          {failures.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-ink-soft">See what went wrong ({failures.length})</summary>
              <ul className="mt-2 flex flex-col gap-2">
                {failures.map((f, i) => {
                  const name = f.caseName ?? f.name;
                  const steadyNote = steady?.passedOnRetry.includes(name) ? "passed both extra times" : steady?.stillFailing.includes(name) ? "failed again" : null;
                  return (
                    <li key={`${f.name}-${i}`} className="rounded-lg bg-card-2 px-3 py-2">
                      <span className="font-medium">{f.name}</span>
                      {(flaky.has(name) || steadyNote) && (
                        <span className="text-ink-soft">
                          {" "}
                          · {[flaky.has(name) ? "flaky" : null, steadyNote].filter(Boolean).join(", ")}
                        </span>
                      )}
                      <span className="block text-ink-soft break-words">{f.detail}</span>
                    </li>
                  );
                })}
              </ul>
            </details>
          )}
          {outcome.chats && outcome.chats.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-ink-soft">Read every conversation ({outcome.chats.length})</summary>
              <ul className="mt-2 flex flex-col gap-3">
                {outcome.chats.map((c, i) => (
                  <li key={`${c.name}-${i}`} className="rounded-lg bg-card-2 px-3 py-3 flex flex-col gap-1.5">
                    <p className="font-medium">{c.name}</p>
                    <p style={{ color: c.ok ? "var(--sage)" : "var(--coral)" }}>{c.ok ? "Passed" : c.detail || "Didn't pass"}</p>
                    {c.lines.map((l, j) => (
                      <p key={j} className="break-words">
                        <span className="text-ink-soft">{l.who === "in" ? "Customer: " : "Realtor: "}</span>
                        {l.text}
                      </p>
                    ))}
                    <p className="break-words">
                      <span className="text-ink-soft">FollowUp ({c.task.toLowerCase()}): </span>
                      {c.next}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {shown && failedNames.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-x-5">
              <QuietButton onClick={() => run("failed")} disabled={busy !== null}>
                {busy === "failed" ? "Running…" : `Run only the ${failedNames.length} that failed (${priceWords(estimateRunMicros(test.id, runs, total, failedNames.length))})`}
              </QuietButton>
              {!recheck && (
                <QuietButton onClick={() => run("recheck")} disabled={busy !== null}>
                  {busy === "recheck" ? "Checking…" : `Check them twice more (${priceWords(estimateRunMicros(test.id, runs, total, failedNames.length, 2))})`}
                </QuietButton>
              )}
            </div>
          )}
        </div>
      )}

      {earlier.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-ink-soft min-h-[44px] flex items-center">Earlier runs ({earlier.length})</summary>
          <ul className="mt-1 flex flex-col gap-1 tabular-nums">
            {earlier.map((r) => (
              <li key={r.id} className="text-ink-soft">
                <When iso={r.createdAt} /> · {kindWords(r)} · {r.passed} passed{r.costMicros != null ? ` · ${dollars(r.costMicros)}` : ""}
                {r.version ? ` · ${r.version}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** The tests as one list; /admin/tests gives it its title, loads each test's saved runs and counts its cases. */
export default function AccuracyTests({ history, totals }: { history: Record<TestId, TestHistory>; totals: Record<TestId, number> }) {
  return (
    <div className="box overflow-hidden">
      {TESTS.map((t) => (
        <TestRow key={t.id} test={t} total={totals[t.id]} history={history[t.id] ?? { runs: [], shown: null }} />
      ))}
    </div>
  );
}
