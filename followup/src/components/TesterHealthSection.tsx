import type { Check, CheckState, TesterHealthReport } from "@/lib/testerHealth";
import { WINDOW_DAYS } from "@/lib/testerHealth";

// "Is it working for them?" (founder, 2026-09-28): the five checks each
// tester must pass before FollowUp grows past a handful of businesses.
// Same box, type and rhythm as "Who reaches first value" above it. State
// dots use the approved state colours (A-029); what needs the founder is
// bold, everything else soft (A-029's refinement). The phone gets each
// tester's score and the one thing to help with next (R-015).

const DOT: Record<CheckState, string> = {
  ok: "var(--state-sent)",
  no: "var(--state-needs)",
  not_yet: "var(--state-checked)",
};

const GRID = "grid-cols-[minmax(0,11rem)_3.5rem_repeat(5,minmax(0,1fr))_3rem]";
const COLUMNS = ["Email and Meta", "Inbox checked", "Drafts as written", "Learning", "Won back"] as const;

function CheckCell({ check }: { check: Check }) {
  return (
    <span className="flex items-start gap-2 min-w-0">
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: DOT[check.state] }} aria-hidden />
      <span className={`text-sm ${check.state === "no" ? "font-semibold" : "text-ink-soft"}`}>
        <span className="sr-only">{check.state === "ok" ? "Passing: " : check.state === "no" ? "Needs you: " : "Not yet: "}</span>
        {check.text}
      </span>
    </span>
  );
}

export default function TesterHealthSection({ report }: { report: TesterHealthReport }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl">Is it working for them?</h2>
      <p className="text-sm text-ink-soft mt-1">
        Five checks per tester. Grow past a handful of businesses once every tester passes all five. Drafts and customers
        count the last {WINDOW_DAYS} days.
      </p>

      {report.testers.length === 0 ? (
        <div className="mt-4 box p-5 text-sm text-ink-soft">No testers yet. This fills as you add them below.</div>
      ) : (
        <>
          <p className="mt-4 text-base sm:text-lg max-w-3xl">{report.summary}</p>

          {/* Desktop: every check, side by side. */}
          <div className="mt-4 box overflow-hidden overflow-x-auto hidden sm:block">
            <div className="min-w-[56rem]">
              <div className={`grid ${GRID} gap-4 px-5 py-3 border-b border-line text-xs font-medium text-ink-soft`}>
                <span>Tester</span>
                <span className="text-right">Score</span>
                {COLUMNS.map((c) => (
                  <span key={c}>{c}</span>
                ))}
                <span aria-hidden />
              </div>
              {report.testers.map((t) => (
                <div key={t.id} className={`grid ${GRID} gap-4 px-5 py-3 border-b border-line last:border-0 items-start`}>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium truncate">{t.name}</span>
                    <span className="block text-xs text-ink-soft truncate">{t.business ?? t.email}</span>
                  </span>
                  <span className="text-right font-display text-xl tabular-nums">
                    {t.score}
                    <span className="text-sm text-ink-soft">/5</span>
                  </span>
                  <CheckCell check={t.checks.connected} />
                  <CheckCell check={t.checks.inbox} />
                  <CheckCell check={t.checks.drafts} />
                  <CheckCell check={t.checks.learning} />
                  <CheckCell check={t.checks.wonBack} />
                  <a href={`mailto:${t.email}`} className="text-right text-sm font-medium underline underline-offset-2">
                    Email
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Phone: the score and the one thing to help with next. */}
          <div className="mt-4 box overflow-hidden sm:hidden">
            {report.testers.map((t) => (
              <div key={t.id} className="flex items-start justify-between gap-4 px-5 py-3 border-b border-line last:border-0">
                <span className="min-w-0">
                  <span className="block text-sm font-medium truncate">{t.name}</span>
                  <span className={`block text-xs ${t.next ? "text-ink" : "text-ink-soft"}`}>{t.next ?? "All five passing"}</span>
                </span>
                <span className="font-display text-xl tabular-nums shrink-0">
                  {t.score}
                  <span className="text-sm text-ink-soft">/5</span>
                </span>
              </div>
            ))}
          </div>

          <p className="mt-3 text-xs text-ink-soft">
            Inbox checked: the last successful look at their Gmail or Outlook, within 30 minutes. It shows FollowUp is
            watching, not that nothing was ever missed. Drafts as written: at least half of the replies sent from a FollowUp
            draft went out unedited, counted once 3 have been sent. Won back: a customer replied to a message FollowUp sent
            on its own. Nothing here is sent to testers.
          </p>
        </>
      )}
    </section>
  );
}
