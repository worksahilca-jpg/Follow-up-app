"use client";

import { useState } from "react";
import { formatDate } from "@/lib/demo-data";

export type ConversationMessage = {
  id: string;
  direction: string;
  channel: string;
  body: string;
  date: string;
  source?: string | null;
  opened?: boolean;
};

const RECENT = 3;

/**
 * The conversation on a lead page.
 *
 * Two changes from the version that lived inline in the page, both about the
 * same problem: the composer — the thing the owner came here to do — used to
 * sit BELOW this list, and this list is unbounded. A lead with twenty messages
 * pushed the send box arbitrarily far down the page, worst on a phone.
 *
 * The composer now sits above it, and this collapses to the last few messages
 * with an explicit way to see the rest. Newest-relevant context stays visible;
 * the archive is one tap away instead of always paid for in scroll.
 *
 * The outbound indent is also gone below `sm`: a 24px margin on a bordered box
 * at 390px left almost no line length to read. The fill difference still marks
 * who said what, at every width.
 */
export default function ConversationThread({
  messages,
  leadName,
}: {
  messages: ConversationMessage[];
  leadName: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const hidden = Math.max(0, messages.length - RECENT);
  const visible = showAll ? messages : messages.slice(-RECENT);

  if (messages.length === 0) {
    return (
      <section>
        <h2 className="font-display text-xl">Conversation</h2>
        {/* A manually-added lead used to render this heading with nothing
            under it, which reads as a page that failed to load. */}
        <p className="mt-2 text-sm text-ink-soft">
          Nothing yet — the first message either way will show up here.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="font-display text-xl">Conversation</h2>

      {hidden > 0 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-2 text-sm underline underline-offset-2"
          style={{ color: "var(--accent)" }}
        >
          Show all {messages.length} messages
        </button>
      )}

      <div className="mt-3 space-y-3">
        {visible.map((m) => (
          <div
            key={m.id}
            className={
              "box p-3 text-sm " +
              (m.direction === "outbound" ? "sm:ml-6" : "")
            }
            // The one box whose ground is not --card: an outbound message
            // sits on --slate-soft so the two sides of a thread read apart.
            // Radius and shadow still come from `.box`.
            style={{ backgroundColor: m.direction === "outbound" ? "var(--slate-soft)" : undefined }}
          >
            <div className="flex items-center justify-between gap-3 text-xs text-ink-soft mb-1">
              <span className="uppercase tracking-wide truncate">
                {m.direction === "outbound" ? "You" : leadName} · {m.channel}
              </span>
              <span className="shrink-0">{formatDate(m.date)}</span>
            </div>
            <p className="whitespace-pre-wrap">{m.body}</p>
            {m.source && (
              <p className="text-xs mt-1" style={{ color: "var(--slate)" }}>
                Sent directly on {m.source === "messenger_direct" ? "Messenger" : "Instagram"} — not through FollowUp
                {m.source.endsWith("_direct") ? " (likely Meta's own AI or a teammate replying from the native app)" : ""}
              </p>
            )}
            {m.opened && (
              <p className="text-xs mt-1" style={{ color: "var(--sage)" }}>
                Opened
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
