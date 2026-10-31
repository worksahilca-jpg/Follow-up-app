import { PageHeader } from "@/components/PageHeader";
import AccuracyTests from "@/components/AccuracyTests";
import { requirePlatformAdmin } from "@/lib/platformAdmin";
import { loadTestHistory, type TestId } from "@/lib/testRuns";
import { EVAL_CASES } from "@/lib/classifierEval";
import { DM_JUDGE_CASES } from "@/lib/dmJudgeEval";
import { QUAL_EVAL_CASES } from "@/lib/qualificationEval";
import { REPLY_CASES } from "@/lib/replyEval";
import { OTHER_KIND_CHAT_CASES, REALTOR_CHAT_CASES } from "@/lib/conversationEval";

export const dynamic = "force-dynamic";

/** /admin → Accuracy tests: one Run button per test (each route checks the founder again), with every run kept. */
export default async function AccuracyTestsPage() {
  await requirePlatformAdmin();
  const history = await loadTestHistory();
  // How many cases each test has, so a price can be shown before the first run is saved.
  const totals: Record<TestId, number> = {
    "email-check": EVAL_CASES.length,
    "dm-check": DM_JUDGE_CASES.length,
    qualifying: QUAL_EVAL_CASES.length,
    replies: REPLY_CASES.length,
    conversations: REALTOR_CHAT_CASES.length,
    "conversations-other-kinds": OTHER_KIND_CHAT_CASES.length,
    "replies-gpt-5.4-mini": REPLY_CASES.length,
    "replies-gpt-5.4": REPLY_CASES.length,
  };
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Accuracy tests"
        subtitle="FollowUp's real AI on made-up examples with known right answers. Run one after any change to how it judges, qualifies or replies."
      />
      <p className="mt-2 text-sm text-ink-soft">
        No customer&apos;s data is used. Every run is kept here with what it cost, and the price shows before you run one.
      </p>
      <div className="mt-6">
        <AccuracyTests history={history} totals={totals} />
      </div>
    </div>
  );
}
