import { PageHeader } from "@/components/PageHeader";
import AccuracyTests from "@/components/AccuracyTests";
import { requirePlatformAdmin } from "@/lib/platformAdmin";

export const dynamic = "force-dynamic";

/** /admin → Accuracy tests: one Run button per test (each route checks the founder again). */
export default async function AccuracyTestsPage() {
  await requirePlatformAdmin();
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Accuracy tests"
        subtitle="FollowUp's real AI on made-up examples with known right answers. Run one after any change to how it judges, qualifies or replies."
      />
      <p className="mt-2 text-sm text-ink-soft">No customer&apos;s data is used.</p>
      <div className="mt-6">
        <AccuracyTests />
      </div>
    </div>
  );
}
