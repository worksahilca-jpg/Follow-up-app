import ProductUsageSection from "@/components/ProductUsageSection";
import AdminCharts from "@/components/AdminCharts";
import { PageHeader } from "@/components/PageHeader";
import { getPlatformAdminData } from "@/lib/admin-data";
import { getProductUsage } from "@/lib/admin-usage";
import { getNotCustomerStats, NOT_CUSTOMER_CHANNELS, type NotCustomerAnswer } from "@/lib/notCustomerStats";
import { gatherQualityWeek } from "@/lib/qualityWeek";
import QualityWeekSection from "@/components/admin/QualityWeekSection";

/** The answers to "Who is this?" as the founder reads them (A-259). */
const ANSWER_LABEL: Record<NotCustomerAnswer, string> = {
  friend: "A friend or family",
  work: "Someone they work with",
  selling: "Selling them something",
  spam: "Spam",
  none: "No answer",
};

export const dynamic = "force-dynamic";

function channelLabel(provider: string): string {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

/** /admin → Usage: what FollowUp did this week, who signs up, and who it let through by mistake. */
export default async function UsagePage() {
  // getPlatformAdminData() checks the founder first; the rest read after it.
  const data = await getPlatformAdminData();
  const [usage, notCustomer, week] = await Promise.all([
    getProductUsage(),
    getNotCustomerStats(30),
    gatherQualityWeek().catch((err) => {
      console.warn("Usage: couldn't read this week's quality:", err instanceof Error ? err.message : err);
      return null;
    }),
  ]);

  return (
    <div>
      <PageHeader title="Usage" subtitle="Every business together. Counts only, no names or messages." />

      <QualityWeekSection week={week} />

      <div className="mt-10">
        <ProductUsageSection usage={usage} />
      </div>

      <section id="not-a-customer" className="mt-10 scroll-mt-6">
        <h2 className="font-display text-xl">&ldquo;Not a customer&rdquo;, and why</h2>
        <p className="text-sm text-ink-soft mt-1">
          Every time an owner told FollowUp someone wasn&apos;t a customer in the last {notCustomer.days} days, by their
          answer and the channel it came in on. Numbers only. Where these pile up is where FollowUp lets the wrong
          people through.
        </p>
        <div className="mt-4 box overflow-hidden overflow-x-auto">
          {notCustomer.total === 0 ? (
            <p className="p-5 text-sm text-ink-soft">None yet.</p>
          ) : (
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-ink-soft">
                  <th className="px-5 py-3 font-normal">Answer</th>
                  {NOT_CUSTOMER_CHANNELS.map((c) => (
                    <th key={c} className="px-3 py-3 text-right font-normal">{channelLabel(c)}</th>
                  ))}
                  <th className="px-5 py-3 text-right font-normal">All</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {(Object.keys(ANSWER_LABEL) as NotCustomerAnswer[]).map((a) => {
                  const row = notCustomer.table[a];
                  const all = NOT_CUSTOMER_CHANNELS.reduce((n, c) => n + row[c], 0);
                  return (
                    <tr key={a} className="border-t border-line-2">
                      <td className="px-5 py-3">{ANSWER_LABEL[a]}</td>
                      {NOT_CUSTOMER_CHANNELS.map((c) => (
                        <td key={c} className="px-3 py-3 text-right">{row[c]}</td>
                      ))}
                      <td className="px-5 py-3 text-right font-medium">{all}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <div className="mt-10">
        <AdminCharts
          signupsPerWeek={data.signupsPerWeek}
          channelBreakdown={data.channelBreakdown}
          tierBreakdown={data.tierBreakdown}
        />
      </div>
    </div>
  );
}
