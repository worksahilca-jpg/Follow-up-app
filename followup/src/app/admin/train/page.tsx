import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import TrainAdd from "@/components/admin/TrainAdd";
import TrainScorecard from "@/components/admin/TrainScorecard";
import TrainRemove from "@/components/admin/TrainRemove";
import { requirePlatformAdmin } from "@/lib/platformAdmin";
import { getTrainingSummary, listExamples } from "@/lib/training";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "add", label: "Add a conversation" },
  { key: "score", label: "Scorecard" },
  { key: "examples", label: "Examples" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const VERDICT_LABEL: Record<string, string> = { followup: "FollowUp better", same: "Same", agent: "Business better" };
const CHANNEL: Record<string, string> = { email: "Email", instagram: "Instagram", whatsapp: "WhatsApp", text: "Text" };

/**
 * /admin/train — "Train FollowUp" (A-292). Real conversations from businesses teach the drafts of businesses of the
 * same kind; the scorecard shows how close FollowUp gets. Founder only (the layout checks, and so does this page).
 */
export default async function TrainPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePlatformAdmin();
  const { tab: asked } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === asked) ? (asked as Tab) : "add";
  const [summary, examples] = await Promise.all([getTrainingSummary(), tab === "examples" ? listExamples(100) : Promise.resolve([])]);
  const perConversation = new Map<string, number>();
  for (const e of examples) perConversation.set(e.conversationId, (perConversation.get(e.conversationId) ?? 0) + 1);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Train FollowUp"
        subtitle="Real conversations teach FollowUp how each kind of business answers. The scorecard shows how close it gets."
      />
      <p className="mt-3 text-sm text-ink-soft tabular-nums">
        {summary.examples} {summary.examples === 1 ? "example" : "examples"} from {summary.conversations}{" "}
        {summary.conversations === 1 ? "conversation" : "conversations"}. Each business&apos;s replies use the newest few from its own kind.
      </p>

      <nav aria-label="Train" className="mt-5 flex gap-5 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/train?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className="-mb-px inline-flex min-h-11 shrink-0 items-center border-b-2 text-[15px] font-medium whitespace-nowrap"
            style={{ borderColor: tab === t.key ? "var(--ink)" : "transparent", color: tab === t.key ? "var(--ink)" : "var(--ink-soft)" }}
          >
            {t.label}
            {t.key === "examples" && summary.examples > 0 ? <span className="ml-1.5 tabular-nums text-ink-faint">{summary.examples}</span> : null}
          </Link>
        ))}
      </nav>

      {tab === "add" && <TrainAdd />}
      {tab === "score" && <TrainScorecard scored={summary.scored} total={summary.examples} />}
      {tab === "examples" &&
        (examples.length === 0 ? (
          <p className="mt-6 text-ink-soft">No examples yet. Add a conversation to start.</p>
        ) : (
          <ul className="mt-6 overflow-hidden rounded-2xl border border-line">
            {examples.map((e, i) => {
              const firstOfConversation = examples.findIndex((x) => x.conversationId === e.conversationId) === i;
              return (
                <li key={e.id} className="border-t border-line px-5 py-4 first:border-t-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-soft">
                    <span>
                      {e.trade} · {CHANNEL[e.channel] ?? e.channel}
                      {e.verdict ? ` · ${VERDICT_LABEL[e.verdict] ?? e.verdict}` : ""}
                      {e.verdict === "followup" ? " (not used)" : ""}
                    </span>
                    {firstOfConversation && <TrainRemove conversationId={e.conversationId} examples={perConversation.get(e.conversationId) ?? 1} />}
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">Customer</p>
                  <p className="whitespace-pre-wrap break-words">{e.customerSaid}</p>
                  <p className="mt-2 text-sm text-ink-soft">Business</p>
                  <p className="whitespace-pre-wrap break-words">{e.reply}</p>
                </li>
              );
            })}
          </ul>
        ))}
    </div>
  );
}
