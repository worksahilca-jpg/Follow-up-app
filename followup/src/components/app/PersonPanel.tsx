import Link from "next/link";
import { X } from "lucide-react";
import type { Lead, Message } from "@/lib/types";
import type { PendingApproval } from "@/lib/pendingApprovals";
import { describeBasis } from "@/lib/basedOn";
import { languageName } from "@/lib/leadLanguage";
import ReplyCard from "./ReplyCard";
import { ChannelIcon, channelFromSource } from "./ChannelIcon";
import { Eyebrow, Initials, StatePill, waitingFor, type StateKey } from "./canvasBits";

/**
 * One customer, opened beside the Customers list (A-025; the canvas App
 * board's right-hand panel): who and where, the facts as label → value,
 * the conversation, and the reply when one is waiting. "Open full page"
 * goes to /leads/[id], where everything else about them lives.
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

function lastInbound(messages: Message[]): Message | undefined {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].direction === "inbound") return messages[i];
  return undefined;
}

/** The panel keeps to the latest few; the full page has the rest. */
const SHOWN = 6;

function ago(iso: string, now: Date): string {
  const min = Math.max(1, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  return `${Math.floor(h / 24)} days ago`;
}

export default function PersonPanel({
  lead,
  approval,
  place,
  timeZone,
  now,
  sendLocked,
}: {
  lead: Lead;
  approval: PendingApproval | null;
  /** Which of the list's places they're in, so the pill here matches the row. */
  place: { state: StateKey; label: string };
  timeZone: string;
  now: Date;
  sendLocked: boolean;
}) {
  const first = lead.conversation[0];
  const lastIn = lastInbound(lead.conversation);
  const channelKey = (lastIn ?? first)?.channel ?? channelFromSource(lead.source);
  const channel = CHANNEL[channelKey ?? ""] ?? lead.source;
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
  const at = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone });
  const firstName = lead.name.split(" ")[0] || lead.name;
  // The conversation as the App board draws it: a dot, who and when, what
  // was said. The customer in ink; what FollowUp sent, quieter; the reply
  // it's holding, in the Needs-you colour with the reason (A-029).
  const entries: { key: string; who: string; at: string; text: string; dot: string; quiet: boolean }[] = lead.conversation
    .slice(-SHOWN)
    .map((m) => {
      const inbound = m.direction === "inbound";
      const byFollowUp = !inbound && !m.source?.endsWith("_direct") && Boolean(m.trigger);
      return {
        key: m.id,
        who: inbound ? firstName : byFollowUp ? "FollowUp" : "You",
        at: at.format(new Date(m.date)),
        text: m.body,
        dot: inbound ? "var(--ink)" : "var(--line)",
        quiet: !inbound,
      };
    });
  if (approval) {
    entries.push({
      key: "held",
      who: "FollowUp",
      at: at.format(new Date(approval.heldAt)),
      text: approval.reason ? `Wrote the reply. Held because ${approval.reason.replace(/\.\s*$/, "")}.` : "Wrote the reply. It waits for your OK.",
      dot: "var(--state-needs)",
      quiet: true,
    });
  }
  const why = approval?.reason ? approval.reason.charAt(0).toUpperCase() + approval.reason.slice(1).replace(/\.\s*$/, "") + "." : null;

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex items-start gap-3 border-b border-line px-5 py-5">
        <Initials name={lead.name} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[20px] font-semibold leading-tight">{lead.name}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-faint">
            <ChannelIcon channel={channelKey} />
            {[channel, first ? `first message ${ago(first.date, now)}` : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        <Link href="/leads" scroll={false} aria-label="Close" className="-mr-2 -mt-1 inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-faint hover:bg-card-2 hover:text-ink">
          <X className="h-[18px] w-[18px]" />
        </Link>
      </div>

      <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-3 border-b border-line px-5 py-5 text-sm">
        <dt className="text-ink-faint">State</dt>
        <dd>
          <StatePill state={place.state} label={place.label} />
        </dd>
        {why && (
          <>
            <dt className="text-ink-faint">Why it&apos;s here</dt>
            <dd>{why}</dd>
          </>
        )}
        {approval ? (
          <>
            <dt className="text-ink-faint">Waiting</dt>
            <dd>{waitingFor(approval.heldAt, now)}</dd>
          </>
        ) : (
          lastIn && (
            <>
              <dt className="text-ink-faint">Last wrote</dt>
              <dd>{ago(lastIn.date, now)}</dd>
            </>
          )
        )}
        <dt className="text-ink-faint">Language</dt>
        <dd>{lead.languageRead ? languageName(lead.languageRead.language) : "Not read yet"}</dd>
      </dl>

      <div className="flex-1 px-5 py-5">
        <div className="mb-3 flex items-center justify-between">
          <Eyebrow>Conversation</Eyebrow>
          <Link href={`/leads/${lead.id}`} className="text-[13px] text-ink-soft underline underline-offset-[3px] hover:text-ink">
            Open full page
          </Link>
        </div>
        {lead.conversation.length > SHOWN && (
          <p className="mb-3 text-[13px] text-ink-faint">Earlier messages are on the full page.</p>
        )}
        {entries.length > 0 ? (
          <ol>
            {entries.map((e, i) => (
              <li key={e.key} className="relative grid grid-cols-[10px_minmax(0,1fr)] gap-x-3 pb-4 last:pb-0">
                {i < entries.length - 1 && <span aria-hidden className="absolute bottom-0 left-[4.5px] top-[14px] w-px bg-line" />}
                <span aria-hidden className="mt-[5px] h-[9px] w-[9px] rounded-full" style={{ background: e.dot }} />
                <div className="min-w-0">
                  <p className="text-[12.5px] text-ink-faint">
                    <span className="font-medium text-ink-soft">{e.who}</span> · {e.at}
                  </p>
                  <p className={"mt-0.5 whitespace-pre-wrap text-[14.5px] leading-relaxed " + (e.quiet ? "text-ink-soft" : "")}>{e.text}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-ink-soft">No messages yet.</p>
        )}
      </div>

      {approval && (
        <div className="px-5 pb-5">
          <ReplyCard
            key={lead.id}
            leadId={lead.id}
            leadName={lead.name}
            leadEmail={lead.email || undefined}
            draft={lead.suggestedMessage}
            draftSubject={lead.suggestedSubject}
            waiting
            seenInboundAt={lastIn?.date}
            sendLocked={sendLocked}
            basis={basis}
            languageName={replyLanguage}
          />
        </div>
      )}
    </div>
  );
}
