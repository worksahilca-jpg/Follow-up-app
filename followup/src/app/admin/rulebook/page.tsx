import { PageHeader } from "@/components/PageHeader";
import RulebookList from "@/components/admin/RulebookList";
import { requirePlatformAdmin } from "@/lib/platformAdmin";
import { AREAS, caseTotals, rulebook } from "@/lib/rulebook";
import { estimateRunMicros, loadTestHistory, type TestId } from "@/lib/testRuns";

export const dynamic = "force-dynamic";

/**
 * /admin → Rulebook (night plan B1 + B3, 2026-10-31): every rule FollowUp follows, why, where it lives, and a button
 * that runs only the tests that prove it, with the price first.
 */
export default async function RulebookPage() {
  await requirePlatformAdmin();
  const history = await loadTestHistory();
  const totals = caseTotals();
  const rules = rulebook().map((r) => ({
    ...r,
    price: (Object.entries(r.tests) as [TestId, string[]][]).reduce(
      (sum, [test, names]) => sum + estimateRunMicros(test, history[test].runs, totals[test], names.length),
      0
    ),
  }));
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Rulebook"
        subtitle="Every rule FollowUp follows when it writes or decides: why it exists, where it lives, and the tests that prove it."
      />
      <p className="mt-2 text-sm text-ink-soft">
        Change a rule, then run only its tests. Each run is kept on Accuracy tests. No customer&apos;s data is used.
      </p>
      <div className="mt-6">
        <RulebookList areas={AREAS} rules={rules} />
      </div>
    </div>
  );
}
