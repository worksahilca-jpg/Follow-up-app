import { notFound } from "next/navigation";
import { getLeadById, getLeadAuditTrail } from "@/lib/leads-data";
import { getFreeTierStatus } from "@/lib/billing";
import { formatCurrency, formatDate, PIPELINE_STAGES } from "@/lib/demo-data";
import PriorityPill from "@/components/PriorityPill";
import StageSelector from "@/components/StageSelector";
import LeadAutomationToggle from "@/components/LeadAutomationToggle";
import LeadWorkflowEnrollment from "@/components/LeadWorkflowEnrollment";
import LeadAssignmentSelect from "@/components/LeadAssignmentSelect";
import DeleteLeadButton from "@/components/DeleteLeadButton";
import CopyBookingLinkButton from "@/components/CopyBookingLinkButton";
import LeadTrustPanel, { consentLabel, lastActionSummary } from "@/components/LeadTrustPanel";
import AutomationStatusBadge from "@/components/AutomationStatusBadge";
import WeTalkedButton from "@/components/WeTalkedButton";
import CollapsibleSection from "@/components/CollapsibleSection";
import DetailsFold from "@/components/app/DetailsFold";
import { ChevronLeft } from "lucide-react";
import { isSocialLeadId } from "@/lib/instagramId";
import type { LeadLanguage } from "@/lib/leadLanguage";
import { sendLockedForSession } from "@/lib/sendingControl";
import CatchUp from "@/components/CatchUp";
import { describeBasis } from "@/lib/basedOn";
import { languageName } from "@/lib/leadLanguage";
import Link from "next/link";
import SiteReplyCard from "@/components/app/SiteReplyCard";
import { siteReplyFor } from "@/lib/siteReply";
import ReplyCard from "@/components/app/ReplyCard";
import Thread from "@/components/app/Thread";
import { Initials, waitingFor } from "@/components/app/canvasBits";
import { getSessionContext } from "@/lib/session";
import { getPendingApprovals, type PendingApproval } from "@/lib/pendingApprovals";
import { prisma } from "@/lib/db";
import type { Lead, Message } from "@/lib/types";
import { isWaitingOnCustomer } from "@/lib/waitingOn";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLeadById(id);
  if (!lead) notFound();
  const [auditTrail, freeTierStatus, sendLocked] = await Promise.all([getLeadAuditTrail(id), getFreeTierStatus(), sendLockedForSession()]);
  const autonomousAllowed = freeTierStatus?.tier !== "free";
  // "Based on" and the "In <language>" rewrite (A-043).
  // A lead site that keeps the contact private: answered there (b018, A-075).
  const siteReply = siteReplyFor(lead);
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
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
      <div className="min-w-0">
        {/* Phone: the ThreadPhone header, back, name, where they wrote. */}
        <div className="-mx-5 -mt-3 flex items-center gap-1 border-b border-line px-2 pb-2.5 sm:-mx-8 lg:hidden">
          <Link href="/leads" aria-label="Back to Customers" className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-ink">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            {/* Inline weight: the global h1 rule is thin and unlayered. */}
            <h1 className="truncate text-[17px] leading-tight" style={{ fontWeight: 600, letterSpacing: "-0.01em" }}>
              {lead.name}
            </h1>
            <p className="truncate text-[13px] text-ink-faint">{channel}</p>
          </div>
        </div>

        <Link href="/leads" className="hidden text-[13px] text-ink-faint hover:text-ink-soft lg:inline">
          ← Customers
        </Link>
        <div className="mt-3 hidden items-center gap-3.5 lg:flex">
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

        {/* id: the target of CatchUp's "Show all N messages". */}
        <div id="conversation" className="mt-5 lg:mt-7">
          <Thread messages={lead.conversation} leadName={lead.name} timeZone={timeZone} now={now} />
        </div>

        <div className="mt-6">
          {siteReply ? (
            <SiteReplyCard key={lead.id} leadId={lead.id} leadName={lead.name} site={siteReply} draft={lead.suggestedMessage} waiting={Boolean(approval)} />
          ) : (
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
          )}
        </div>
        <div className="mt-4">
          <CatchUp leadId={lead.id} />
        </div>
      </div>

      {/* The side column as the one-decision board draws it (A-080): three
          facts, three actions, one "Details" row with the machinery behind
          it. Each fact once: the channel is in the header, the language
          under "Why it may write". */}
      <aside className="mt-10 grid min-w-0 content-start gap-[18px] lg:mt-0 lg:pt-1.5">
        <Facts lead={lead} approval={approval} now={now} />

        {/* Three pills, as drawn. The third is Call when there is a number
            to call, and Email (their own mail app) when there isn't, so
            an email-only customer still has a way to reach them directly. */}
        <div className="flex flex-wrap items-center gap-2">
          {lead.automationStatus?.kind !== "closed" && (
            <WeTalkedButton leadId={lead.id} leadName={lead.name} talked={lead.automationStatus?.kind === "talked"} onSite={Boolean(siteReply)} />
          )}
          <CopyBookingLinkButton leadId={lead.id} />
          {lead.phone && !isSocialLeadId(lead.phone) ? (
            <a href={`tel:${lead.phone}`} className={PILL}>
              Call
            </a>
          ) : lead.email ? (
            <a href={`mailto:${lead.email}`} className={PILL}>
              Email
            </a>
          ) : null}
        </div>

        <DetailsFold>
          <CollapsibleSection row title={`How it handles ${firstName}`} status={TIER_WORDS[lead.automationTier] ?? undefined}>
            <LeadAutomationToggle
              leadId={lead.id}
              initialTier={lead.automationTier}
              autonomousAllowed={autonomousAllowed}
              holdAllForApproval={freeTierStatus?.holdAllForApproval ?? false}
            />
          </CollapsibleSection>
          <CollapsibleSection row title={`Why it may write to ${firstName}`} status={lead.optedOutAt ? "Opted out of texts" : consentLabel(lead.source)}>
            <LeadTrustPanel part="why" source={lead.source} optedOutAt={lead.optedOutAt} auditTrail={auditTrail} languageRead={lead.languageRead as LeadLanguage | null} />
          </CollapsibleSection>
          <CollapsibleSection row title="What FollowUp did" status={lastActionSummary(auditTrail, now) ?? "Nothing yet"}>
            <AutomationStatusBadge status={lead.automationStatus} line onSite={Boolean(siteReply)} />
            <div className="mt-3">
              <LeadTrustPanel part="did" source={lead.source} optedOutAt={lead.optedOutAt} auditTrail={auditTrail} />
            </div>
          </CollapsibleSection>
          <CollapsibleSection row title="Follow-up plan" status={lead.nextFollowUp ? `Next ${formatDate(lead.nextFollowUp)}` : "None"}>
            <LeadWorkflowEnrollment leadId={lead.id} />
          </CollapsibleSection>
          <CollapsibleSection row title="Stage" status={stageLabel(lead.stage)}>
            <dl className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-x-4 gap-y-2.5 text-[14.5px]">
              <dt className="text-ink-faint">Stage</dt>
              <dd>
                <StageSelector leadId={lead.id} stage={lead.stage} />
              </dd>
              <dt className="self-start pt-1 text-ink-faint">Assigned to</dt>
              <dd>
                <LeadAssignmentSelect leadId={lead.id} initialAssignedToId={lead.assignedToId} initialAssignedToName={lead.assignedTo} />
              </dd>
              {lead.dealValue > 0 && (
                <>
                  <dt className="text-ink-faint">Worth</dt>
                  <dd>{formatCurrency(lead.dealValue)}</dd>
                </>
              )}
            </dl>
          </CollapsibleSection>
          <CollapsibleSection row title={`About ${firstName}`}>
            <div className="space-y-3 text-[14px]">
              <div className="flex flex-wrap items-center gap-2">
                <PriorityPill priority={lead.priority} reviewed={lead.reviewed} />
              </div>
              <p className="flex justify-between gap-3">
                <span className="text-ink-faint">Last contacted</span>
                <span>{formatDate(lead.lastContacted)}</span>
              </p>
              <p className="leading-relaxed text-ink-soft">{lead.scoreReason || "FollowUp hasn't reviewed this customer yet."}</p>
              {lead.notes && <p className="leading-relaxed text-ink-soft">{lead.notes}</p>}
            </div>
          </CollapsibleSection>
          <div className="border-t border-line-2 px-[18px] py-3 text-[13px]">
            <DeleteLeadButton leadId={lead.id} leadName={lead.name} leadEmail={lead.email} />
          </div>
        </DetailsFold>
      </aside>
    </div>
  );
}

/** The side column's action pill (PersonSide: 38px, hairline, white). */
const PILL = "inline-flex h-[38px] items-center rounded-full border border-line bg-card px-3.5 text-[14px] font-medium hover:bg-card-2";

/** The per-customer setting in the same words as the control itself. */
const TIER_WORDS: Record<string, string> = { off: "You do it", assisted: "Ask if risky", autonomous: "Handle it all" };

/**
 * The three facts (A-080): why it's here (or the state when nothing
 * waits), how long, and where they came from. Label above value, as the
 * board draws them; the needs-you reason carries the one coloured dot.
 */
function Facts({ lead, approval, now }: { lead: Lead; approval: PendingApproval | null; now: Date }) {
  const lastIn = lastInbound(lead.conversation);
  const first = lead.name.split(" ")[0] ?? lead.name;
  const kind = lead.automationStatus?.kind;
  const state =
    kind === "closed"
      ? "Closed"
      : kind === "talked"
        ? lead.viaSite && !lead.email
          ? "Answered"
          : "You talked"
        : isWaitingOnCustomer(lead)
          ? `Waiting on ${first}`
          : "Up to date";
  const contact = lead.email || (lead.phone && !isSocialLeadId(lead.phone) ? lead.phone : null);
  return (
    <>
      <Fact label={approval ? "Why it's here" : "State"}>
        {approval ? (
          <>
            <span aria-hidden className="mr-2 inline-block h-[7px] w-[7px] rounded-full align-[2px]" style={{ background: "var(--state-needs)" }} />
            {sentenceCase(approval.reason).replace(/\.\s*$/, "")}.
          </>
        ) : (
          state
        )}
      </Fact>
      {approval ? <Fact label="Waiting">{waitingFor(approval.heldAt, now)}</Fact> : lastIn && <Fact label="Last wrote">{timeAgoWords(lastIn.date, now)}</Fact>}
      <Fact label="Came from">
        <span className="block truncate">{[lead.source, contact].filter(Boolean).join(" · ")}</span>
      </Fact>
    </>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[12.5px] text-ink-faint">{label}</p>
      <p className="mt-1 text-[15px]">{children}</p>
    </div>
  );
}

function stageLabel(stage: Lead["stage"]): string {
  return PIPELINE_STAGES.find((s) => s.id === stage)?.label ?? stage;
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
