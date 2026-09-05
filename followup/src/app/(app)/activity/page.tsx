import Link from "next/link";
import { Zap, ShieldCheck, Flame, CheckCircle2 } from "lucide-react";
import { getSessionContext } from "@/lib/session";
import { getActivityFeed, type ActivityItem, type ActivityType } from "@/lib/activity";

export const dynamic = "force-dynamic";

const ICONS: Record<ActivityType, typeof Zap> = {
  automated_send: Zap,
  sequence_paused: ShieldCheck,
  rapid_engagement: Flame,
  sequence_completed: CheckCircle2,
};

// Same lead-urgency-adjacent palette used everywhere else, repurposed here
// for "what kind of automated event is this" instead of lead temperature —
// still one accent per meaning, not decoration.
const ACCENTS: Record<ActivityType, { fg: string; bg: string }> = {
  automated_send: { fg: "var(--rust)", bg: "var(--rust-soft)" },
  sequence_paused: { fg: "var(--slate)", bg: "var(--slate-soft)" },
  rapid_engagement: { fg: "var(--coral)", bg: "var(--coral-soft)" },
  sequence_completed: { fg: "var(--sage)", bg: "var(--sage-soft)" },
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const Icon = ICONS[item.type];
  const accent = ACCENTS[item.type];
  const body = (
    <div className="flex gap-3 py-3.5">
      <div
        className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: accent.bg, color: accent.fg }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm">{item.message}</p>
        {item.detail && (
          <p className="text-xs text-ink-soft mt-1 line-clamp-2 leading-relaxed">&ldquo;{item.detail}&rdquo;</p>
        )}
        <p className="text-xs text-ink-soft mt-1">{timeAgo(item.occurredAt)}</p>
      </div>
    </div>
  );

  return item.leadId ? (
    <Link href={`/leads/${item.leadId}`} className="block px-1 -mx-1 rounded-lg hover:bg-paper transition-colors">
      {body}
    </Link>
  ) : (
    <div className="px-1 -mx-1">{body}</div>
  );
}

export default async function ActivityPage() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return <p className="text-sm text-ink-soft">Sign in to view activity.</p>;
  }

  const items = await getActivityFeed(ctx.businessId);

  return (
    <div>
      <h1 className="font-display text-3xl">Activity</h1>
      <p className="text-ink-soft mt-1 max-w-xl">
        Proof, not a promise — every message automation actually sent, every time it stopped itself because a lead
        replied, and every moment it flagged as worth jumping into right now.
      </p>

      <div className="mt-6 rounded-xl border border-line bg-card px-5">
        {items.length === 0 ? (
          <p className="text-sm text-ink-soft py-8 text-center">
            Nothing here yet — this fills in as automation actually does something.
          </p>
        ) : (
          <div className="divide-y divide-line">
            {items.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
