import type { Message } from "@/lib/types";
import { Eyebrow } from "./canvasBits";

/**
 * The conversation as the canvas draws it (Inbox, InboxAI, ThreadPhone):
 * the customer on the left in white, the business on the right in warm
 * grey, grouped by day. Each outbound message says who sent it, so an
 * automatic one is never mistaken for the owner's own words.
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
    <div className={"flex flex-col " + (dense ? "gap-5 lg:gap-[18px]" : "gap-5")}>
      {groups.map((g) => (
        <div key={g.key} className={"flex flex-col " + (dense ? "gap-3.5 lg:gap-[18px]" : "gap-3.5")}>
          <div className="text-center">
            <Eyebrow>{g.label}</Eyebrow>
          </div>
          {g.items.map((m) => {
            const at = time.format(new Date(m.date));
            if (m.direction === "inbound") {
              return (
                <div key={m.id} className={"flex max-w-[85%] flex-col items-start gap-1 self-start " + (dense ? "sm:max-w-[520px] lg:max-w-[460px]" : "sm:max-w-[520px]")}>
                  <span className="text-[12.5px] text-ink-faint">
                    <span className={"font-medium " + (dense ? "text-ink-soft lg:text-ink" : "text-ink-soft")}>{first}</span> · {at}
                  </span>
                  <div
                    className={
                      "whitespace-pre-wrap border border-line bg-card " +
                      "rounded-[20px_20px_20px_6px] px-4 py-3 text-base leading-relaxed" + (dense ? " lg:rounded-[14px_14px_14px_4px] lg:px-3.5 lg:py-[11px] lg:text-[14.5px] lg:leading-normal" : "")
                    }
                  >
                    {m.body}
                  </div>
                </div>
              );
            }
            const who = m.source?.endsWith("_direct")
              ? `Sent from ${m.source.startsWith("messenger") ? "Messenger" : "Instagram"} directly, not through FollowUp`
              : m.trigger && TRIGGER_LABEL[m.trigger]
                ? `Sent by FollowUp · ${TRIGGER_LABEL[m.trigger]}`
                : "You";
            return (
              <div key={m.id} className={"flex max-w-[85%] flex-col items-end gap-1 self-end " + (dense ? "sm:max-w-[520px] lg:max-w-[460px]" : "sm:max-w-[520px]")}>
                <span className="text-right text-[12.5px] text-ink-faint">
                  {who} · {at}
                  {m.opened ? " · Opened" : ""}
                </span>
                <div
                  className={
                    "whitespace-pre-wrap " +
                    "rounded-[20px_20px_6px_20px] px-4 py-3 text-base leading-relaxed" + (dense ? " lg:rounded-[14px_14px_4px_14px] lg:px-3.5 lg:py-[11px] lg:text-[14.5px] lg:leading-normal" : "")
                  }
                  style={{ background: "var(--accent-soft)", color: "#3f3a36" }}
                >
                  {m.body}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
