"use client";

import { useState } from "react";

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

type Failure = { name: string; detail: string };
/** One whole conversation from the conversation test, shown in full so the founder can read how FollowUp talks. */
type Chat = { name: string; ok: boolean; task: string; lines: { who: "in" | "out"; text: string }[]; next: string; detail: string };
type Outcome = { headline: string; mustBeZero?: { label: string; count: number }[]; lines: string[]; failures: Failure[]; chats?: Chat[] };

type Test = {
  id: string;
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

type State = { status: "idle" } | { status: "running" } | { status: "done"; outcome: Outcome } | { status: "error"; message: string };

function TestRow({ test }: { test: Test }) {
  const [state, setState] = useState<State>({ status: "idle" });

  async function run() {
    setState({ status: "running" });
    try {
      const res = await fetch(
        test.route,
        test.body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(test.body) } : { method: "POST" }
      );
      const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok || !body) {
        setState({ status: "error", message: typeof body?.message === "string" ? body.message : `The test stopped (error ${res.status}). Try again in a minute.` });
        return;
      }
      setState({ status: "done", outcome: test.read(body) });
    } catch {
      setState({ status: "error", message: "The test didn't finish. Check your connection and try again." });
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-line px-5 py-4 first:border-t-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">{test.title}</p>
          <p className="text-sm text-ink-soft mt-0.5">{test.what}</p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={state.status === "running"}
          className="shrink-0 rounded-full border border-ink px-4 min-h-[44px] text-sm font-medium disabled:opacity-60"
        >
          {state.status === "running" ? "Running…" : state.status === "idle" ? "Run" : "Run again"}
        </button>
      </div>

      {state.status === "running" && <p className="text-sm text-ink-soft">{test.takes ?? "Takes about two minutes. Keep this page open."}</p>}
      {state.status === "error" && (
        <p className="text-sm" style={{ color: "var(--coral)" }}>
          {state.message}
        </p>
      )}
      {state.status === "done" && (
        <div className="flex flex-col gap-1.5 text-sm" aria-live="polite">
          <p className="text-base font-medium tabular-nums">{state.outcome.headline}</p>
          {state.outcome.mustBeZero?.map((z) => (
            <p key={z.label} className="tabular-nums" style={{ color: z.count === 0 ? "var(--sage)" : "var(--coral)" }}>
              {z.count} {z.label} (should be 0)
            </p>
          ))}
          {state.outcome.lines.map((line) => (
            <p key={line} className="text-ink-soft tabular-nums">
              {line}
            </p>
          ))}
          {state.outcome.failures.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-ink-soft">See what went wrong ({state.outcome.failures.length})</summary>
              <ul className="mt-2 flex flex-col gap-2">
                {state.outcome.failures.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="rounded-lg bg-card-2 px-3 py-2">
                    <span className="font-medium">{f.name}</span>
                    <span className="block text-ink-soft break-words">{f.detail}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {state.outcome.chats && state.outcome.chats.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-ink-soft">Read every conversation ({state.outcome.chats.length})</summary>
              <ul className="mt-2 flex flex-col gap-3">
                {state.outcome.chats.map((c, i) => (
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
        </div>
      )}
    </div>
  );
}

/** The tests as one list; /admin/tests gives it its title and the sentence about what it does. */
export default function AccuracyTests() {
  return (
    <div className="box overflow-hidden">
      {TESTS.map((t) => (
        <TestRow key={t.id} test={t} />
      ))}
    </div>
  );
}
