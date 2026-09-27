import { notFound } from "next/navigation";
import { getLeadById, getLeadAuditTrail } from "@/lib/leads-data";
import { getFreeTierStatus } from "@/lib/billing";
import { formatCurrency, formatDate } from "@/lib/demo-data";
import PriorityPill from "@/components/PriorityPill";
import StageSelector from "@/components/StageSelector";
import LeadAutomationToggle from "@/components/LeadAutomationToggle";
import LeadWorkflowEnrollment from "@/components/LeadWorkflowEnrollment";
import LeadAssignmentSelect from "@/components/LeadAssignmentSelect";
import DeleteLeadButton from "@/components/DeleteLeadButton";
import CopyBookingLinkButton from "@/components/CopyBookingLinkButton";
import LeadTrustPanel from "@/components/LeadTrustPanel";
import AutomationStatusBadge from "@/components/AutomationStatusBadge";
import WeTalkedButton from "@/components/WeTalkedButton";
import CollapsibleSection from "@/components/CollapsibleSection";
import { Mail, Phone } from "lucide-react";
import { isSocialLeadId } from "@/lib/instagramId";
import type { LeadLanguage } from "@/lib/leadLanguage";
import { sendLockedForSession } from "@/lib/sendingControl";
import CatchUp from "@/components/CatchUp";
import { describeBasis } from "@/lib/basedOn";
import { languageName } from "@/lib/leadLanguage";
import Link from "next/link";
import ReplyCard from "@/components/app/ReplyCard";
import Thread from "@/components/app/Thread";
import { Initials, waitingFor } from "@/components/app/canvasBits";
import { getSessionContext } from "@/lib/session";
import { getPendingApprovals, type PendingApproval } from "@/lib/pendingApprovals";
import { prisma } from "@/lib/db";
import type { Lead, Message } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLeadById(id);
  if (!lead) notFound();
  const [auditTrail, freeTierStatus, sendLocked] = await Promise.all([getLeadAuditTrail(id), getFreeTierStatus(), sendLockedForSession()]);
  const autonomousAllowed = freeTierStatus?.tier !== "free";
  // "Based on" and the "In <language>" rewrite (A-043).
  const basis = lead.suggestedMessage
    ? describeBasis({
        draft: lead.suggestedMessage,
        leadFirstName: lead.name.split(" ")[0] ?? "",
        messages: lead.conversation.map((m) => ({ direction: m.direction === "inbound" ? "inbound" : "outbound", body: m.body, sentAt: new Date(m.date), source: m.source ?? null, channel: m.channel })),
      })
    : null;
  const replyLanguage = lead.languageRead && lead.languageRead.language !== "en" ? languageName(lead.languageRead.language) : null;

  // The canvas conversation (App, Inbox, InboxAI, ThreadPhone boards):
  // who this is and why it's here, the conversation, then the reply.
  // Everything else about the customer sits below, under "More about".
  const ctx = await getSessionContext();
  const [approval, business] = ctx
    ? await Promise.all([
        getPendingApprovals(ctx.businessId).then((all) => all.find((a) => a.leadId === lead.id) ?? null),
        prisma.business.findUnique({ where: { id: ctx.businessId }, select: { timezone: true } }),
      ])
    : [null, null];
  const timeZone = business?.timezone ?? "America/New_York";
  const firstName = lead.name.split(" ")[0] ?? lead.name;
  const firstMessage = lead.conversation[0];
  const channel = channelName(lastInbound(lead.conversation)?.channel ?? firstMessage?.channel ?? null, lead.source);
  const now = new Date();

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
      <div className="min-w-0">
        <Link href="/inbox" className="text-[13px] text-ink-faint hover:text-ink-soft">
          ← Inbox
        </Link>
        <div className="mt-3 flex items-center gap-3.5">
          <Initials name={lead.name} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[26px] leading-tight">{lead.name}</h1>
              {approval && (
                <span className="rounded-full border border-line bg-card px-2.5 py-0.5 text-[12.5px] font-medium">Needs you</span>
              )}
            </div>
            <div className="mt-0.5 text-[13.5px] text-ink-faint">
              {[channel, firstMessage ? `first message ${timeAgoWords(firstMessage.date, now)}` : null].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>

        <div className="mt-7">
          <Thread messages={lead.conversation} leadName={lead.name} timeZone={timeZone} now={now} />
        </div>

        <div className="mt-6">
          <ReplyCard
            leadId={lead.id}
            leadName={lead.name}
            leadEmail={lead.email || undefined}
            draft={lead.suggestedMessage}
            draftSubject={lead.suggestedSubject}
            waiting={Boolean(approval)}
            seenInboundAt={newestInboundAt(lead.conversation)}
            sendLocked={sendLocked}
            basis={basis}
            languageName={replyLanguage}
          />
        </div>
        <div className="mt-4">
          <CatchUp leadId={lead.id} />
        </div>
      </div>

      <aside className="mt-10 min-w-0 lg:mt-0">
        <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-2.5 rounded-2xl border border-line bg-card p-5 text-[14px]">
          <Details lead={lead} approval={approval} now={now} />
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {lead.automationStatus?.kind !== "closed" && (
            <WeTalkedButton leadId={lead.id} leadName={lead.name} talked={lead.automationStatus?.kind === "talked"} />
          )}
          <CopyBookingLinkButton leadId={lead.id} />
          {lead.phone && !isSocialLeadId(lead.phone) && (
            <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-sm font-medium">
              <Phone className="h-3.5 w-3.5" /> Call
            </a>
          )}
          {lead.email && (
            <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 text-sm text-ink-soft underline underline-offset-2">
              <Mail className="h-3.5 w-3.5" /> Open in your mail app
            </a>
          )}
        </div>

        <div className="mt-6 space-y-2">
          <CollapsibleSection title={`More about ${firstName}`}>
            <div className="space-y-4 text-sm">
              <AutomationStatusBadge status={lead.automationStatus} />
              <div className="flex flex-wrap items-center gap-3">
                <PriorityPill priority={lead.priority} reviewed={lead.reviewed} />
                <StageSelector leadId={lead.id} stage={lead.stage} />
                <span className="font-medium">{formatCurrency(lead.dealValue)} potential</span>
              </div>
              <dl className="space-y-2">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-soft">Came from</dt>
                  <dd>{lead.source}</dd>
                </div>
                <div className="flex justify-between items-start gap-3">
                  <dt className="text-ink-soft shrink-0">Assigned to</dt>
                  <dd>
                    <LeadAssignmentSelect leadId={lead.id} initialAssignedToId={lead.assignedToId} initialAssignedToName={lead.assignedTo} />
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-soft">Last contacted</dt>
                  <dd>{formatDate(lead.lastContacted)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-soft">Next follow-up</dt>
                  <dd>{lead.nextFollowUp ? formatDate(lead.nextFollowUp) : "—"}</dd>
                </div>
              </dl>
              <p className="leading-relaxed text-ink-soft">{lead.scoreReason || "FollowUp hasn't reviewed this customer yet."}</p>
              {lead.notes && <p className="leading-relaxed text-ink-soft">{lead.notes}</p>}
            </div>
          </CollapsibleSection>
          <CollapsibleSection title="What FollowUp did">
            <LeadTrustPanel source={lead.source} optedOutAt={lead.optedOutAt} auditTrail={auditTrail} languageRead={lead.languageRead as LeadLanguage | null} />
          </CollapsibleSection>
          <CollapsibleSection title="Follow-up plan">
            <div className="space-y-3">
              <LeadAutomationToggle
                leadId={lead.id}
                initialTier={lead.automationTier}
                autonomousAllowed={autonomousAllowed}
                holdAllForApproval={freeTierStatus?.holdAllForApproval ?? false}
              />
              <LeadWorkflowEnrollment leadId={lead.id} />
            </div>
          </CollapsibleSection>
          <div className="pt-4">
            <DeleteLeadButton leadId={lead.id} leadName={lead.name} />
          </div>
        </div>
      </aside>
    </div>
  );
}

/** State / Why it's here / Waiting / Language, as the canvas App board lists them. */
function Details({ lead, approval, now }: { lead: Lead; approval: PendingApproval | null; now: Date }) {
  const lastIn = lastInbound(lead.conversation);
  const first = lead.name.split(" ")[0] ?? lead.name;
  const kind = lead.automationStatus?.kind;
  const state = approval
    ? "Needs you"
    : kind === "closed"
      ? "Closed"
      : kind === "talked"
        ? "You talked"
        : kind === "waiting" || kind === "sent" || kind === "due_soon" || kind === "workflow"
          ? `Waiting on ${first}`
          : "Handled";
  const why = approval ? sentenceCase(approval.reason) + "." : null;
  return (
    <>
      <dt className="text-ink-faint">State</dt>
      <dd>{state}</dd>
      {why && (
        <>
          <dt className="text-ink-faint">Why it&apos;s here</dt>
          <dd className="text-ink-soft">{why}</dd>
        </>
      )}
      {approval && (
        <>
          <dt className="text-ink-faint">Waiting</dt>
          <dd>{waitingFor(approval.heldAt, now)}</dd>
        </>
      )}
      {!approval && lastIn && (
        <>
          <dt className="text-ink-faint">Last wrote</dt>
          <dd>{timeAgoWords(lastIn.date, now)}</dd>
        </>
      )}
      <dt className="text-ink-faint">Language</dt>
      <dd>{lead.languageRead ? languageName(lead.languageRead.language) : "Not read yet"}</dd>
    </>
  );
}

function lastInbound(messages: Message[]): Message | undefined {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].direction === "inbound") return messages[i];
  return undefined;
}

function channelName(channel: string | null, source: string): string {
  const names: Record<string, string> = {
    email: "Email",
    text: "Text",
    call: "Phone",
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    messenger: "Messenger",
    web: "Website form",
  };
  return (channel && names[channel]) || source || "";
}

function timeAgoWords(iso: string, now: Date): string {
  const min = Math.max(1, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  const d = Math.floor(h / 24);
  return `${d} days ago`;
}

function sentenceCase(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** When the newest message from the lead on this page arrived — what the owner has "seen" when they press Send. */
function newestInboundAt(messages: { direction: string; date: string }[]): string | undefined {
  let newest: number | undefined;
  for (const m of messages) {
    if (m.direction !== "inbound") continue;
    const t = Date.parse(m.date);
    if (Number.isFinite(t) && (newest === undefined || t > newest)) newest = t;
  }
  return newest === undefined ? undefined : new Date(newest).toISOString();
}
