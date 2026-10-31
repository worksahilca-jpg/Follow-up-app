"use client";

import { useState } from "react";
import { caseOutcomes, priceWords, type TestId } from "@/lib/testRunMath";
import type { RuleArea, RuleWithTests } from "@/lib/rulebook";

/**
 * Admin → Rulebook: the rules by area, each with why it exists, an example, where it lives, and one button that runs
 * only its tests (the same routes as Accuracy tests, with "only these cases"), price first. Night plan B1 + B3.
 */

type Area = { id: RuleArea; title: string; what: string };
type Rule = RuleWithTests & { price: number };

const ROUTE: Partial<Record<TestId, string>> = {
  conversations: "/api/admin/conversation-eval",
  replies: "/api/admin/reply-eval",
  qualifying: "/api/admin/qualification-eval",
  "email-check": "/api/admin/classifier-eval",
  "dm-check": "/api/admin/dm-judge-eval",
};

const WORD: Partial<Record<TestId, [string, string]>> = {
  conversations: ["conversation", "conversations"],
  replies: ["reply", "replies"],
  qualifying: ["qualifying chat", "qualifying chats"],
  "email-check": ["email", "emails"],
  "dm-check": ["first DM", "first DMs"],
};

const count = (test: TestId, n: number) => `${n} ${(WORD[test] ?? [test, test])[n === 1 ? 0 : 1]}`;
const fileName = (path: string) => path.split("/").pop() ?? path;

type Outcome = { passed: number; total: number; failed: { test: TestId; name: string }[]; error?: string };

function RuleRow({ rule }: { rule: Rule }) {
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const tests = Object.entries(rule.tests) as [TestId, string[]][];
  const total = tests.reduce((n, [, names]) => n + names.length, 0);

  async function run() {
    setRunning(true);
    const out: Outcome = { passed: 0, total: 0, failed: [] };
    try {
      // One test at a time: each is a few minutes at most, and a rate limit on one would slow the next.
      for (const [test, names] of tests) {
        const route = ROUTE[test];
        if (!route) continue;
        const res = await fetch(route, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ only: names }) });
        const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        if (!res.ok || !body) {
          out.error = typeof body?.message === "string" ? body.message : `A test stopped (error ${res.status}). Try again in a minute.`;
          break;
        }
        for (const o of caseOutcomes(test, body, names)) {
          out.total += 1;
          if (o.ok) out.passed += 1;
          else out.failed.push({ test, name: o.name });
        }
      }
    } catch {
      out.error = "The tests didn't finish. Check your connection and try again.";
    } finally {
      setOutcome(out);
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-line px-5 py-4 first:border-t-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex flex-col gap-1">
          <p className="font-medium">{rule.name}</p>
          <p className="text-sm text-ink-soft">{rule.why}</p>
          {rule.good && (
            <p className="text-sm">
              <span style={{ color: "var(--sage)" }}>Right: </span>
              {rule.good}
            </p>
          )}
          {rule.bad && (
            <p className="text-sm">
              <span style={{ color: "var(--coral)" }}>Wrong: </span>
              {rule.bad}
            </p>
          )}
          <p className="text-xs text-ink-soft">
            Lives in {[...new Set(rule.where.map((w) => fileName(w.file)))].join(", ")} · Tests: {tests.map(([t, names]) => count(t, names.length)).join(", ")}
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="shrink-0 rounded-full border border-ink px-4 min-h-[44px] text-sm font-medium disabled:opacity-60"
        >
          {running ? "Running…" : `Run its ${total} test${total === 1 ? "" : "s"}`}
          <span className="block text-xs font-normal text-ink-soft">{priceWords(rule.price)}</span>
        </button>
      </div>
      {running && <p className="text-sm text-ink-soft">A few minutes at most. Keep this page open.</p>}
      {outcome && !running && (
        <div className="flex flex-col gap-1 text-sm" aria-live="polite">
          {outcome.total > 0 && (
            <p className="font-medium tabular-nums" style={{ color: outcome.passed === outcome.total ? "var(--sage)" : undefined }}>
              {outcome.passed} of {outcome.total} passed
            </p>
          )}
          {outcome.failed.map((f) => (
            <p key={`${f.test}-${f.name}`} className="text-ink-soft break-words">
              <span style={{ color: "var(--coral)" }}>Failed: </span>
              {f.name} ({(WORD[f.test] ?? [f.test])[0]})
            </p>
          ))}
          {outcome.failed.length > 0 && <p className="text-ink-soft">Read what went wrong on Accuracy tests, where every run is kept.</p>}
          {outcome.error && (
            <p style={{ color: "var(--coral)" }}>{outcome.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function RulebookList({ areas, rules }: { areas: Area[]; rules: Rule[] }) {
  return (
    <div className="flex flex-col gap-12">
      {areas.map((a) => {
        const inArea = rules.filter((r) => r.area === a.id);
        if (!inArea.length) return null;
        return (
          <section key={a.id} className="flex flex-col gap-3">
            <div>
              <h2 className="text-xl font-semibold">{a.title}</h2>
              <p className="text-sm text-ink-soft">
                {a.what} {inArea.length} rule{inArea.length === 1 ? "" : "s"}.
              </p>
            </div>
            <div className="box overflow-hidden">
              {inArea.map((r) => (
                <RuleRow key={r.id} rule={r} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
