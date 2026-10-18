import { INDUSTRIES, INDUSTRY_SHORT } from "@/lib/industries";
import { OWN_MODEL_AT } from "@/lib/training";

/**
 * /admin/train → Scorecard: how close each kind of business is to a model of its own (founder, 2026-10-18: "I want
 * different models to be trained for different niches"). One row per kind: a thin charcoal bar and "N of 500". At 500
 * good examples a kind gets its own model, tried on the Scorecard before it answers real customers.
 */
export default function TrainProgress({ counts }: { counts: Record<string, number> }) {
  const closest = [...INDUSTRIES].sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))[0];
  const any = (counts[closest] ?? 0) > 0;
  return (
    <section className="mt-6 rounded-2xl border border-line px-5 pt-4 pb-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Each kind&apos;s own model</h2>
        {any && <span className="text-sm text-ink-soft">{INDUSTRY_SHORT[closest]} is closest</span>}
      </div>
      <p className="mt-1 mb-2.5 text-sm text-ink-soft">
        At {OWN_MODEL_AT} good examples, a kind of business gets a model of its own, tried here first.
      </p>
      <ul>
        {INDUSTRIES.map((t) => {
          const n = counts[t] ?? 0;
          return (
            <li key={t} className="grid grid-cols-[minmax(0,8.5rem)_1fr_5.5rem] items-center gap-3.5 border-t border-line py-2.5">
              <span className={n ? "font-medium" : "text-ink-soft"}>{INDUSTRY_SHORT[t]}</span>
              <span className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--card-2)" }} aria-hidden>
                <span className="block h-full" style={{ width: `${Math.min(100, (n / OWN_MODEL_AT) * 100)}%`, background: "var(--ink)" }} />
              </span>
              <span className="text-right text-sm text-ink-soft tabular-nums">
                {n} of {OWN_MODEL_AT}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
