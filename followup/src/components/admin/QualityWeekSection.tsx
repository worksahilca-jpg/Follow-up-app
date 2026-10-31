import type { QualityWeek } from "@/lib/qualityWeek";

/**
 * Admin → Usage → "This week with real customers" (night plan A6 + C2 + E3): how FollowUp's drafts fared with real
 * owners, what it learned, and what the AI cost. Counts only, every business together (src/lib/qualityWeek.ts).
 */

const dollars = (micros: number) => `$${(micros / 1_000_000).toFixed(2)}`;
const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "–");

export default function QualityWeekSection({ week }: { week: QualityWeek | null }) {
  return (
    <section id="quality" className="mt-10 scroll-mt-6">
      <h2 className="font-display text-xl">This week with real customers</h2>
      <p className="text-sm text-ink-soft mt-1">
        How FollowUp&apos;s drafts did with real owners in the last 7 days, what it learned, and what the AI cost. Numbers
        only. Also emailed to you on Monday mornings.
      </p>
      {!week ? (
        <p className="mt-4 box p-5 text-sm text-ink-soft">Couldn&apos;t read this week&apos;s numbers. Try again in a minute.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-6">
          {week.ai.newModels.length > 0 && (
            <p className="box p-5 text-sm" style={{ color: "var(--coral)" }}>
              A new AI model version answered this week: {week.ai.newModels.join(", ")}. OpenAI changed it; run the accuracy tests to
              check nothing got worse.
            </p>
          )}
          <div className="box overflow-hidden overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-ink-soft">
                  <th className="px-5 py-3 font-normal">Drafts, by what produced them</th>
                  <th className="px-3 py-3 text-right font-normal">Sent</th>
                  <th className="px-3 py-3 text-right font-normal">As written</th>
                  <th className="px-3 py-3 text-right font-normal">Changed</th>
                  <th className="px-3 py-3 text-right font-normal">Typed</th>
                  <th className="px-5 py-3 text-right font-normal">Not sent</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {week.sends.length === 0 ? (
                  <tr className="border-t border-line-2">
                    <td className="px-5 py-3 text-ink-soft" colSpan={6}>
                      Nothing sent to real customers this week.
                    </td>
                  </tr>
                ) : (
                  [...week.sends, week.total].map((r) => (
                    <tr key={r.label} className={`border-t border-line-2 ${r.label === "All" ? "font-medium" : ""}`}>
                      <td className="px-5 py-3">{r.label}</td>
                      <td className="px-3 py-3 text-right">{r.sent}</td>
                      <td className="px-3 py-3 text-right">
                        {r.asWritten} <span className="text-ink-soft">({pct(r.asWritten, r.asWritten + r.edited)})</span>
                      </td>
                      <td className="px-3 py-3 text-right">{r.edited}</td>
                      <td className="px-3 py-3 text-right">{r.typed}</td>
                      <td className="px-5 py-3 text-right">{r.notSent}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="box p-5 text-sm flex flex-col gap-1">
              <p className="font-medium">What FollowUp learned</p>
              <p className="text-ink-soft tabular-nums">
                {week.learned.factsLearned} facts from sent replies, {week.learned.factsApproved} OK&apos;d by owners; {week.learned.factsTold} told
                by owners.
              </p>
              {week.learned.lessons.length > 0 ? (
                <p className="text-ink-soft tabular-nums">Train: {week.learned.lessons.map((l) => l.what).join(", ")}.</p>
              ) : (
                <p className="text-ink-soft">No rules or examples changed on Train.</p>
              )}
            </div>
            <div className="box p-5 text-sm flex flex-col gap-1">
              <p className="font-medium">The AI</p>
              <p className="text-ink-soft tabular-nums">
                For customers: {week.ai.realCalls} calls, {dollars(week.ai.realCostMicros)}. Tests and practice: {week.ai.testCalls} calls,{" "}
                {dollars(week.ai.testCostMicros)}. {week.ai.failedCalls} failed.
              </p>
              <p className="text-ink-soft tabular-nums">
                Accuracy test runs: {week.tests.runs}, {dollars(week.tests.costMicros)}.
              </p>
              {week.ai.models.length > 0 && (
                <p className="text-ink-soft break-words">Answered by: {week.ai.models.map((m) => `${m.model} (${m.calls})`).join(", ")}.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
