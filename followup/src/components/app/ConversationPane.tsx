import Link from "next/link";
import type { Lead, Message } from "@/lib/types";
import type { PendingApproval } from "@/lib/pendingApprovals";
import { describeBasis } from "@/lib/basedOn";
import { languageName } from "@/lib/leadLanguage";
import ReplyCard from "./ReplyCard";
import Thread from "./Thread";
import { Initials, Eyebrow } from "./canvasBits";

/**
 * One conversation, as the right half of the desktop Inbox (canvas Inbox
 * and InboxAI boards): who, where and since when, the messages, then the
 * reply. "Open person" goes to the full customer page, where everything
 * else about them lives.
 */
const CHANNEL: Record<string, string> = {
  email: "Email",
  text: "Text",
  call: "Phone",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  messenger: "Messenger",
  web: "Website form",
};

export default function ConversationPane({
  lead,
  approval,
  timeZone,
  now,
  sendLocked,
}: {
  lead: Lead;
  approval: PendingApproval | null;
  timeZone: string;
  now: Date;
  sendLocked: boolean;
}) {
  const first = lead.conversation[0];
  const lastIn = [...lead.conversation].reverse().find((m: Message) => m.direction === "inbound");
  const channel = CHANNEL[(lastIn ?? first)?.channel ?? ""] ?? lead.source;
  const basis = lead.suggestedMessage
    ? describeBasis({
        draft: lead.suggestedMessage,
        leadFirstName: lead.name.split(" ")[0] ?? "",
        messages: lead.conversation.map((m) => ({
          direction: m.direction === "inbound" ? "inbound" : "outbound",
          body: m.body,
          sentAt: new Date(m.date),
          source: m.source ?? null,
          channel: m.channel,
        })),
      })
    : null;
  const replyLanguage = lead.languageRead && lead.languageRead.language !== "en" ? languageName(lead.languageRead.language) : null;
  const since = first ? ago(first.date, now) : null;

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex items-center gap-3 border-b border-line px-1 py-4 lg:px-6">
        <Initials name={lead.name} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-base font-semibold">{lead.name}</span>
            {approval && <span className="hidden sm:inline rounded-full border border-line bg-paper px-2 py-0.5 text-[12px] font-medium">Needs you</span>}
          </div>
          <div className="text-[13px] text-ink-faint">{[channel, since ? `first message ${since}` : null].filter(Boolean).join(" · ")}</div>
        </div>
        <Link href={`/leads/${lead.id}`} className="shrink-0 rounded-full border border-line bg-card px-3.5 py-1.5 text-[13px] font-medium">
          Open person
        </Link>
      </div>
      <div className="flex-1 px-1 py-6 lg:px-6">
        <Thread messages={lead.conversation} leadName={lead.name} timeZone={timeZone} now={now} />
      </div>
      {/* Pinned under the thread on desktop; on the phone it follows the thread, clear of the tab bar. */}
      <div className="bg-paper px-1 pb-6 pt-2 lg:sticky lg:bottom-0 lg:px-6">
        {approval && (
          <div className="mb-2">
            <Eyebrow>Held because {approval.reason.replace(/\.\s*$/, "")}</Eyebrow>
          </div>
        )}
        <ReplyCard
          key={lead.id}
          leadId={lead.id}
          leadName={lead.name}
          leadEmail={lead.email || undefined}
          draft={lead.suggestedMessage}
          draftSubject={lead.suggestedSubject}
          waiting={Boolean(approval)}
          seenInboundAt={lastIn?.date}
          sendLocked={sendLocked}
          basis={basis}
          languageName={replyLanguage}
        />
      </div>
    </div>
  );
}

function ago(iso: string, now: Date): string {
  const min = Math.max(1, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  return `${Math.floor(h / 24)} days ago`;
}
