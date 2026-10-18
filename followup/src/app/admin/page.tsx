import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { getPlatformAdminData } from "@/lib/admin-data";
import { countWaitingForOk } from "@/lib/admin-usage";
import { getDecisions } from "@/lib/adminDecisionsData";
import { formatCurrency } from "@/lib/demo-data";
import { requirePlatformAdmin } from "@/lib/platformAdmin";

export const dynamic = "force-dynamic";

/**
 * /admin → Decide (founder, 2026-10-18: "organise the admin page so that I
 * can make decisions"). Four numbers, then one line per decision: what
 * happened, and the one thing to do. The detail lives in the other places.
 * Numbers only, across every business; no customer's words.
 */
export default async function DecidePage() {
  await requirePlatformAdmin();
  const [data, waiting, decisions] = await Promise.all([getPlatformAdminData(), countWaitingForOk(), getDecisions()]);

  const numbers = [
    { value: String(data.totalBusinesses), label: data.totalBusinesses === 1 ? "business" : "businesses" },
    { value: String(data.activeBusinessCount), label: "active" },
    { value: String(waiting), label: waiting === 1 ? "reply waiting for an OK" : "replies waiting for an OK" },
    { value: formatCurrency(data.estimatedMonthlyRevenueUsd), label: "a month" },
  ];

  return (
    <div className="max-w-3xl">
      <PageHeader title="Decide" subtitle="What needs a decision from you. Numbers only, no customer's messages." />

      <div className="mt-6 grid grid-cols-2 overflow-hidden rounded-2xl border border-line sm:grid-cols-4">
        {numbers.map((n, i) => (
          <div
            key={n.label}
            className={`px-4 py-4 sm:px-5 ${i % 2 === 1 ? "border-l border-line" : ""} ${i >= 2 ? "border-t border-line sm:border-t-0 sm:border-l" : ""}`}
          >
            <p className="text-2xl font-semibold tracking-[-0.02em] tabular-nums">{n.value}</p>
            <p className="mt-0.5 text-sm text-ink-soft">{n.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-soft">
        Active: captured a customer or connected an app. Money is a rough estimate from paid plans.
      </p>

      <section className="mt-10">
        <h2 className="ios-title3">Needs you</h2>
        {decisions.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-line px-5 py-4 text-ink-soft">Nothing needs you right now.</p>
        ) : (
          <ul className="mt-3 overflow-hidden rounded-2xl border border-line">
            {decisions.map((d) => (
              <li
                key={d.key}
                className="flex flex-col gap-3 border-t border-line px-5 py-4 first:border-t-0 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="flex min-w-0 flex-1 gap-3">
                  <span aria-hidden className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--state-needs)" }} />
                  <div className="min-w-0">
                    <p className="font-semibold">{d.title}</p>
                    <p className="mt-0.5 text-sm text-ink-soft">{d.why}</p>
                  </div>
                </div>
                <Link
                  href={d.action.href}
                  className="ml-5 inline-flex min-h-11 shrink-0 items-center self-start rounded-full border border-line-strong px-4 text-sm font-medium sm:ml-0 sm:self-center"
                >
                  {d.action.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
