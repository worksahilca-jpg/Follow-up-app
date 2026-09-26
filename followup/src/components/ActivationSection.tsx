import type { Activation, FunnelStep } from "@/lib/activation";
import { formatSpan } from "@/lib/activation";

// Design brain A-047 (the Amplitude study): who reaches first value, where
// the rest stop, and who to help. Desktop shows every step; the phone gets
// the headline, the sentence and who's stuck, with the steps one tap away
// (R-015).

const FUNNEL_GRID = "grid-cols-[minmax(0,13rem)_minmax(0,1fr)_3rem_minmax(0,10rem)]";

function Funnel({ funnel }: { funnel: FunnelStep[] }) {
  const top = Math.max(1, funnel[0]?.count ?? 1);
  const slowest = funnel.reduce<number>((best, s, i) => (s.medianMs !== null && (best < 0 || s.medianMs > (funnel[best].medianMs ?? 0)) ? i : best), -1);
  return (
    <div>
      <div className={`grid ${FUNNEL_GRID} gap-4 px-5 py-3 border-b border-line text-xs font-medium text-ink-soft`}>
        <span>Step</span>
        <span aria-hidden />
        <span className="text-right">Testers</span>
        <span className="text-right">Median time</span>
      </div>
      {funnel.map((s, i) => {
        const isValue = s.step === "replySent";
        return (
          <div key={s.step} className={`grid ${FUNNEL_GRID} gap-4 px-5 py-3 border-b border-line last:border-0 items-center`}>
            <span className={`text-sm min-w-0 ${isValue ? "font-semibold" : ""}`}>
              {s.label}
              {isValue && <span className="font-normal text-ink-soft"> · first value</span>}
            </span>
            <span className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--line)" }} aria-hidden>
              <span className="block h-full rounded-full" style={{ width: `${Math.round((s.count / top) * 100)}%`, backgroundColor: "var(--ink)" }} />
            </span>
            <span className="text-right font-display text-xl tabular-nums">{s.count}</span>
            <span className={`text-right text-xs tabular-nums ${i === slowest ? "font-semibold" : "text-ink-soft"}`}>
              {s.medianMs !== null ? `${formatSpan(s.medianMs)} later${i === slowest ? " · slowest" : ""}` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function ActivationSection({ activation: a }: { activation: Activation }) {
  const band = [
    [`${a.activated} of ${a.signedIn}`, "testers activated"],
    [a.medianToValueMs !== null ? formatSpan(a.medianToValueMs) : "—", "median from first sign-in to first value"],
    [a.week2.of ? `${a.week2.came} of ${a.week2.of}` : "—", a.week2.of ? "activated testers came back in week 2" : "back in week 2 · not known yet"],
    [String(a.answered), a.answered === 1 ? "tester heard back from a customer" : "testers heard back from a customer"],
  ] as const;

  return (
    <section className="mt-10">
      <h2 className="font-display text-xl">Who reaches first value</h2>
      <p className="text-sm text-ink-soft mt-1">
        First value: a customer got a reply that FollowUp wrote. Activated: within 7 days of first signing in. Counted
        from FollowUp&apos;s own records, beta testers only.
      </p>

      {a.testers === 0 ? (
        <div className="mt-4 box p-5 text-sm text-ink-soft">No testers yet. This fills as you add them below.</div>
      ) : (
        <>
          <p className="mt-4 text-lg sm:hidden">
            {a.activated} of {a.signedIn} testers reached first value.
          </p>
          <div className="mt-4 box overflow-hidden hidden sm:grid grid-cols-4">
            {band.map(([n, label], i) => (
              <div key={label} className={`px-5 py-4 border-line ${i > 0 ? "border-l" : ""}`}>
                <p className="font-display text-4xl tabular-nums">{n}</p>
                <p className="text-sm text-ink-soft mt-1">{label}</p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-base sm:text-lg max-w-3xl">{a.summary}</p>

          <div className="mt-4 box overflow-hidden overflow-x-auto hidden sm:block">
            <Funnel funnel={a.funnel} />
          </div>

          <div className="mt-4 box overflow-hidden">
            <div className="px-5 pt-4 pb-3">
              <p className="text-sm font-medium">Who&apos;s stuck</p>
              <p className="text-xs text-ink-soft mt-0.5">Longest first. A message from you usually unsticks it.</p>
            </div>
            {a.stuck.length === 0 ? (
              <p className="px-5 pb-4 text-sm text-ink-soft">Nobody. Everyone has reached first value or moved today.</p>
            ) : (
              a.stuck.map((s) => (
                <div
                  key={s.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,12rem)_minmax(0,14rem)_minmax(0,1fr)_5rem_3.5rem] gap-x-4 gap-y-0.5 px-5 py-3 border-t border-line items-center"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium truncate">{s.name}</span>
                    <span className="block text-xs text-ink-soft truncate">
                      <span className="sm:hidden">Last step: {s.lastStep}</span>
                      <span className="hidden sm:inline">{s.business ?? s.email}</span>
                    </span>
                  </span>
                  <span className="hidden sm:block text-sm">Last step: {s.lastStep}</span>
                  <span className="hidden sm:block text-sm text-ink-soft">{s.reason}</span>
                  <span className="text-right text-sm font-semibold tabular-nums">{s.days === 1 ? "1 day" : `${s.days} days`}</span>
                  <a href={`mailto:${s.email}`} className="hidden sm:block text-right text-sm font-medium underline underline-offset-2">
                    Email
                  </a>
                </div>
              ))
            )}
          </div>

          <details className="mt-4 box overflow-hidden sm:hidden">
            <summary className="px-5 py-4 text-sm cursor-pointer">Every step, with times</summary>
            <div className="overflow-x-auto border-t border-line">
              <Funnel funnel={a.funnel} />
            </div>
          </details>

          <p className="mt-3 text-xs text-ink-soft">
            Connected means any source: Gmail, Outlook, Instagram, Messenger or WhatsApp. Nothing here is sent to testers.
          </p>
        </>
      )}
    </section>
  );
}
