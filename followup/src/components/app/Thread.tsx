import type { Message } from "@/lib/types";
import { Eyebrow } from "./canvasBits";

/**
 * The conversation as chat bubbles (A-220): the customer on the left in
 * white, the business on the right in black, grouped by day, at phone sizes
 * (R-107). Under each bubble, who and when; an outbound one always says who
 * sent it ("Sent by FollowUp"), so an automatic message is never mistaken
 * for the owner's own words.
 *
 * Rendered on the server in the business's time zone, so the times read
 * the same for everyone on the team.
 */
const TRIGGER_LABEL: Record<string, string> = {
  instant_ack: "welcome message",
  holding: "“let me check” message",
  unanswered: "check-in",
  silence: "check-in",
  sequence: "follow-up plan",
  neglect: "check-in",
  dead_lead_reactivation: "welcome-back message",
};

export default function Thread({
  messages,
  leadName,
  timeZone,
  now,
  dense = false,
}: {
  messages: Message[];
  leadName: string;
  timeZone: string;
  now: Date;
  /** On desktop, the Inbox board's smaller type (14.5px bubbles, 460px wide). The phone keeps ThreadPhone's. */
  dense?: boolean;
}) {
  const first = leadName.split(" ")[0] ?? leadName;
  if (messages.length === 0) {
    return <p className="text-[15px] text-ink-soft">Nothing yet. The first message either way shows up here.</p>;
  }

  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const time = new Intl.DateTimeFormat(undefined, { timeZone, hour: "numeric", minute: "2-digit" });
  const dayName = new Intl.DateTimeFormat(undefined, { timeZone, weekday: "long", month: "short", day: "numeric" });
  const today = dayKey.format(now);
  const yesterday = dayKey.format(new Date(now.getTime() - 86_400_000));

  const groups: { key: string; label: string; items: Message[] }[] = [];
  for (const m of messages) {
    const d = new Date(m.date);
    const key = dayKey.format(d);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(m);
    else groups.push({ key, label: key === today ? "Today" : key === yesterday ? "Yesterday" : dayName.format(d), items: [m] });
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <div key={g.key} className="flex flex-col gap-2.5">
          <div className="text-center">
            <Eyebrow>{g.label}</Eyebrow>
          </div>
          {g.items.map((m) => {
            const at = time.format(new Date(m.date));
            const width = "max-w-[82%] " + (dense ? "sm:max-w-[520px] lg:max-w-[460px]" : "sm:max-w-[520px]");
            if (m.direction === "inbound") {
              return (
                <div key={m.id} className={"flex flex-col items-start gap-[3px] self-start " + width}>
                  <div className="whitespace-pre-wrap rounded-[16px] rounded-bl-[6px] border border-line bg-card px-3 py-[9px] text-[14px] leading-[1.4] sm:text-[15px]">
                    {m.body}
                  </div>
                  <span className="text-[11.5px] text-ink-faint">
                    {first} · {at}
                  </span>
                </div>
              );
            }
            const who = m.source?.endsWith("_direct")
              ? `Sent from ${m.source.startsWith("messenger") ? "Messenger" : "Instagram"} directly, not through FollowUp`
              : m.trigger && TRIGGER_LABEL[m.trigger]
                ? `Sent by FollowUp · ${TRIGGER_LABEL[m.trigger]}`
                : "You";
            return (
              <div key={m.id} className={"flex flex-col items-end gap-[3px] self-end " + width}>
                <div
                  className="whitespace-pre-wrap rounded-[16px] rounded-br-[6px] px-3 py-[9px] text-[14px] leading-[1.4] sm:text-[15px]"
                  style={{ background: "var(--ink)", color: "var(--on-accent)" }}
                >
                  {m.body}
                </div>
                <span className="text-right text-[11.5px] text-ink-faint">
                  {who} · {at}
                  {m.opened ? " · Opened" : ""}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
