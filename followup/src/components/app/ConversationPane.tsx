import Link from "next/link";
import type { Lead, Message } from "@/lib/types";
import type { PendingApproval } from "@/lib/pendingApprovals";
import { describeBasis } from "@/lib/basedOn";
import { languageName } from "@/lib/leadLanguage";
import SiteReplyCard from "@/components/app/SiteReplyCard";
import { siteReplyFor } from "@/lib/siteReply";
import ReplyCard from "./ReplyCard";
import Thread from "./Thread";
import { Initials, StatePill } from "./canvasBits";
import { ChannelIcon, channelFromSource } from "./ChannelIcon";
import { displayChannel } from "@/lib/displayChannel";
import { ExternalLink } from "lucide-react";
import { plainHoldReason } from "@/lib/holdReasons";

/**
 * One conversation, as the right half of the desktop Inbox (canvas Inbox
 * and InboxAI boards): who, where and since when, the messages, then the
 * reply. "Open person" goes to the full customer page, where everything
 * else about them lives.
 */
// The Inbox board's reading column: the thread and the reply sit in one
// centred 640px column, however wide the pane is.
const COLUMN = "mx-auto w-full max-w-[640px]";

const CHANNEL: Record<string, string> = {
  email: "Email",
  text: "Text",
  call: "Phone",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  messenger: "Messenger",
  web: "Website form",
  lead_form: "Facebook lead form",
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
  const channelKey = displayChannel((lastIn ?? first)?.channel, lead.source) ?? channelFromSource(lead.source);
  const channel = CHANNEL[channelKey ?? ""] ?? lead.source;
  // A lead site that keeps the contact private: answered there (b018, A-075).
  const siteReply = siteReplyFor(lead);
  const basis = lead.suggestedMessage
    ? describeBasis({
        draft: lead.suggestedMessage,
        leadFirstName: lead.name.split(" ")[0] ?? "",
        messages: lead.conversation.map((m) => ({
          direction: m.direction === "inbound" ? "inbound" : "outbound",
          body: m.body,
          sentAt: new Date(m.date),
          source: m.source ?? null,
          channel: displayChannel(m.channel, lead.source),
        })),
        timeZone,
      })
    : null;
  const replyLanguage = lead.languageRead && lead.languageRead.language !== "en" ? languageName(lead.languageRead.language) : null;
  const since = first ? ago(first.date, now) : null;
  const meta = [channel, since ? `first message ${since}` : null].filter(Boolean).join(" · ");

  return (
    <div className="flex min-h-full flex-col">
      {/* The Inbox board's header bar: who, whether they need you, and the way to everything else about them. */}
      <div className="flex items-center gap-3 border-b border-line px-1 py-4 lg:h-14 lg:px-6 lg:py-0">
        <span className="lg:hidden">
          <Initials name={lead.name} size={36} />
        </span>
        <span className="hidden lg:inline-flex">
          <Initials name={lead.name} size={28} />
        </span>
        <div className="min-w-0 flex-1 lg:flex lg:items-center lg:gap-3">
          <div className="flex min-w-0 items-center gap-2 lg:gap-3">
            <span className="truncate text-base font-semibold lg:text-[15px]">{lead.name}</span>
            {approval && (
              <span className="hidden sm:inline-flex">
                <StatePill state="needs" label="Needs you" />
              </span>
            )}
          </div>
          <div className="text-[13px] text-ink-faint lg:hidden">{meta}</div>
        </div>
        <Link
          href={`/leads/${lead.id}`}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line bg-card px-3.5 text-[13px] font-medium lg:rounded-[8px] lg:px-3 lg:font-normal"
        >
          <ExternalLink className="hidden h-3.5 w-3.5 text-ink-soft lg:block" aria-hidden />
          Open person
        </Link>
      </div>
      {/* Where they wrote and since when, on its own quiet line (desktop). */}
      <div className="hidden items-center gap-2 border-b border-line-2 px-6 py-2.5 text-[13px] text-ink-faint lg:flex">
        <ChannelIcon channel={channelKey} className="h-[13px] w-[13px] shrink-0 text-ink-faint" />
        <span>{meta}</span>
      </div>
      <div className="flex-1 px-1 py-6 lg:px-6 lg:py-7">
        <div className={COLUMN}>
          <Thread messages={lead.conversation} leadName={lead.name} timeZone={timeZone} now={now} dense />
        </div>
      </div>
      {/* Pinned under the thread on desktop; on the phone it follows the thread, clear of the tab bar. */}
      <div className="bg-paper px-1 pb-6 pt-2 lg:sticky lg:bottom-0 lg:px-6">
        <div className={COLUMN}>
          {approval && plainHoldReason(approval.reason, { firstName: lead.name.split(" ")[0] || lead.name, topic: approval.riskTopic }) && (
            <p className="mb-2 text-[13px] leading-snug text-ink-soft">
              {plainHoldReason(approval.reason, { firstName: lead.name.split(" ")[0] || lead.name, topic: approval.riskTopic })}
            </p>
          )}
          {siteReply ? (
            <SiteReplyCard key={lead.id} leadId={lead.id} leadName={lead.name} site={siteReply} draft={lead.suggestedMessage} waiting={Boolean(approval)} dense />
          ) : (
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
              dense
            />
          )}
        </div>
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
