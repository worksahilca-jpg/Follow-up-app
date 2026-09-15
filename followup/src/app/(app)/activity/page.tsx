import { getSessionContext } from "@/lib/session";
import { getActivityFeed, type ActivityItem, type ActivityType } from "@/lib/activity";
import { PageHeader } from "@/components/PageHeader";
import { ItemBox, ItemBoxList, ItemBoxLabel, type ItemTone } from "@/components/ItemBox";

export const dynamic = "force-dynamic";

/**
 * Each event type's rail colour AND the word that colour means. They are one
 * object on purpose — see ItemBox: a hue never appears without its word.
 *
 * Two things changed here from the previous version, both deliberate:
 *
 * 1. `automated_send` used to render in --rust, the brand blue. That made
 *    "FollowUp sent this" and the sidebar's "you are here" the same colour,
 *    which is exactly what "accent blue held back" (approved.md A-006) rules
 *    out. The accent means interactive/selected; it is not a status. A routine
 *    send is now --slate: it happened, it's fine, it doesn't want you.
 * 2. Four hues on one screen was the closest thing in the app to a rainbow
 *    (rejected.md S-05 caps a screen at three). Two of the four events are
 *    routine and now share --slate, leaving three: slate (routine), sage (the
 *    guarantee fired), coral (this one wants you now).
 *
 * `sequence_paused` gets --sage rather than a neutral because it is the best
 * event on this page: it is the product's central promise — stop the moment a
 * human replies — visibly keeping itself.
 *
 * The labels are short state words rather than sentences, because line 1
 * already says what happened in full ("Automation sent Dana a follow-up",
 * "Lena Novak's workflow finished"). A label that restates the sentence reads
 * as the app talking to itself — the label's only job is to name the state the
 * colour is standing for.
 */
const STATUS: Record<ActivityType, { tone: ItemTone; label: string }> = {
  automated_send: { tone: "slate", label: "Sent" },
  sequence_paused: { tone: "sage", label: "Stopped itself" },
  rapid_engagement: { tone: "coral", label: "Needs you now" },
  sequence_completed: { tone: "slate", label: "Done" },
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

/**
 * "Today" / "Yesterday" / a date. Sixty events in one undifferentiated stream
 * is hard to place in time; the day is the unit an owner actually thinks in
 * ("did anything go out while I was on site yesterday?").
 */
function dayKey(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function groupByDay(items: ActivityItem[]): { day: string; items: ActivityItem[] }[] {
  const out: { day: string; items: ActivityItem[] }[] = [];
  for (const item of items) {
    const day = dayKey(item.occurredAt);
    const last = out[out.length - 1];
    if (last && last.day === day) last.items.push(item);
    else out.push({ day, items: [item] });
  }
  return out;
}

export default async function ActivityPage() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return <p className="text-sm text-ink-soft">Sign in to view activity.</p>;
  }

  const items = await getActivityFeed(ctx.businessId);
  const days = groupByDay(items);

  return (
    <div>
      <PageHeader
        title="Activity"
        subtitle="Proof, not a promise — every message automation actually sent, every time it stopped itself because a lead replied, and every moment it flagged as worth jumping into right now."
      />

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-ink-soft">
          Nothing here yet — this fills in as automation actually does something.
        </p>
      ) : (
        <>
          <div className="mt-6 flex flex-col gap-6">
            {days.map(({ day, items: dayItems }) => (
              <section key={day}>
                <ItemBoxLabel className="mb-2">{day}</ItemBoxLabel>
                <ItemBoxList>
                  {dayItems.map((item) => (
                    <ItemBox
                      key={item.id}
                      title={item.message}
                      figure={timeAgo(item.occurredAt)}
                      status={STATUS[item.type]}
                      fact={item.detail ? `“${item.detail}”` : undefined}
                      href={item.leadId ? `/leads/${item.leadId}` : undefined}
                    />
                  ))}
                </ItemBoxList>
              </section>
            ))}
          </div>

          {/* Never imply completeness the app doesn't have. The feed is capped
              at 60 in lib/activity.ts and used to simply stop, which reads as
              "that's everything" on a page whose whole job is being trusted. */}
          <p className="mt-6 text-xs text-ink-soft">Showing the last {items.length} events.</p>
        </>
      )}
    </div>
  );
}
