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
import ReplyBar from "@/components/app/ReplyBar";
import CustomerSide from "@/components/app/CustomerSide";
import { ChannelIcon } from "@/components/app/ChannelIcon";
import Thread from "@/components/app/Thread";
import { Eyebrow, Initials, waitingFor } from "@/components/app/canvasBits";
import { getSessionContext } from "@/lib/session";
import { getPendingApprovals, type PendingApproval } from "@/lib/pendingApprovals";
import { prisma } from "@/lib/db";
import type { Lead, Message } from "@/lib/types";
import { isWaitingOnCustomer } from "@/lib/waitingOn";
import { plainHoldReason } from "@/lib/holdReasons";
import CallBox from "@/components/app/CallBox";
import { isCallablePhone, telHref } from "@/lib/callPlan";
import { displayChannel } from "@/lib/displayChannel";
import ReadyCard from "@/components/app/ReadyCard";
import { isReady, readQualification, templateFor } from "@/lib/qualification";

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
  const replyLanguage = lead.languageRead && lead.languageRead.language !== "en" ? languageName(lead.languageRead.language) : null;

  // The canvas conversation (App, Inbox, InboxAI, ThreadPhone boards):
  // who this is and why it's here, the conversation, then the reply.
  // Everything else about the customer sits below, under "More about".
  const ctx = await getSessionContext();
  const [approval, business, checklist] = ctx
    ? await Promise.all([
        getPendingApprovals(ctx.businessId).then((all) => all.find((a) => a.leadId === lead.id) ?? null),
        prisma.business.findUnique({ where: { id: ctx.businessId }, select: { timezone: true, teamCalls: true, industry: true } }),
        prisma.lead.findFirst({ where: { id: lead.id, businessId: ctx.businessId }, select: { qualification: true, qualifiedAt: true } }),
      ])
    : [null, null, null];
  const timeZone = business?.timezone ?? "America/New_York";
  const basis = lead.suggestedMessage
    ? describeBasis({
        draft: lead.suggestedMessage,
        leadFirstName: lead.name.split(" ")[0] ?? "",
        messages: lead.conversation.map((m) => ({ direction: m.direction === "inbound" ? "inbound" : "outbound", body: m.body, sentAt: new Date(m.date), source: m.source ?? null, channel: displayChannel(m.channel, lead.source) })),
        timeZone,
      })
    : null;
  // The Call box (A-103): only on a team that calls customers, and only for a number someone can dial.
  const callable = Boolean(business?.teamCalls) && isCallablePhone(lead.phone) ? (lead.phone as string) : null;
  const calls = callable && ctx
    ? await prisma.lead.findFirst({
        where: { id: lead.id, businessId: ctx.businessId },
        select: { nextCallAt: true, callAttempts: { orderBy: { createdAt: "desc" }, take: 1, select: { outcome: true, createdAt: true, user: { select: { name: true } } } } },
      })
    : null;
  const when = (d: Date) => d.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone });
  const lastCallAttempt = calls?.callAttempts[0] ?? null;
  const lastCallWords = lastCallAttempt
    ? [lastCallAttempt.outcome === "spoke" ? "spoke" : "no answer", lastCallAttempt.user?.name?.trim().split(" ")[0], when(lastCallAttempt.createdAt)].filter(Boolean).join(" · ")
    : null;
  const firstName = lead.name.split(" ")[0] ?? lead.name;
  const firstMessage = lead.conversation[0];
  const channelId = displayChannel(lastInbound(lead.conversation)?.channel ?? firstMessage?.channel, lead.source);
  const channel = channelName(channelId, lead.source);
  const now = new Date();
  const firstWrote = firstMessage ? new Date(firstMessage.date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone }) : null;
  // "What FollowUp did" in one line (A-220): the newest thing it did, then what's next. The full record is under Details.
  const didLine = [lastActionSummary(auditTrail, now), lead.nextFollowUp ? `Next check-in ${formatDate(lead.nextFollowUp, timeZone)}` : null]
    .filter(Boolean)
    .join(" · ");

  // "Nadia is ready" (src/lib/qualification.ts): for a line of work with a
  // checklist. Ready is shown while the deal is open; a closed or decided
  // one keeps only the folded record of what was learned.
  const template = templateFor(business?.industry);
  const qualification = template ? readQualification(checklist?.qualification) : null;
  const checklistShown = template && qualification && qualification.template === template.id ? qualification : null;
  const showReady = Boolean(
    template &&
      checklistShown &&
      checklist?.qualifiedAt &&
      isReady(template, checklistShown) &&
      lead.automationStatus?.kind !== "closed" &&
      lead.stage !== "won" &&
      lead.stage !== "lost"
  );
  // Wants, Budget, When at the top (A-220): what FollowUp learned from their own words (#466).
  const known = (key: string) => checklistShown?.items.find((i) => i.key === key)?.value ?? null;
  const wants: [string, string | null][] = [
    ["Wants", known("want")],
    ["Budget", known("budget")],
    ["When", known("timing")],
  ];
  const showWants = wants.some(([, v]) => v);
  const readyCard =
    template && checklistShown ? (
      <ReadyCard
        leadName={lead.name}
        template={template}
        qualification={checklistShown}
        ready={showReady}
        callHref={isCallablePhone(lead.phone) ? telHref(lead.phone) : null}
      />
    ) : null;

  // Why the reply waits, said inside the reply card on a phone (A-222), where the side column isn't.
  const holdWhy = approval
    ? (plainHoldReason(approval.reason, { firstName: lead.name.split(" ")[0] || lead.name, topic: approval.riskTopic }) ?? "Every reply waits for your OK.")
    : null;

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
      {/* Phone (A-222): the column fills the screen and the chat sits at its foot, by the thumb, as in a chat app. */}
      <div className="min-w-0 max-lg:flex max-lg:min-h-[calc(100dvh-192px)] max-lg:flex-col">
        {/* Back, then who and where they wrote (A-220). On a phone the same three things are the top bar (CustomerSide). */}
        <Link href="/leads" className="-ml-1 hidden min-h-11 items-center gap-0.5 text-[13px] text-ink-soft hover:text-ink lg:inline-flex">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Customers
        </Link>
        <div className="mt-0.5 hidden items-center gap-2.5 lg:flex">
          <Initials name={lead.name} size={38} />
          <div className="min-w-0">
            <h1 className="title-serif truncate text-[23px] leading-tight sm:text-[26px]">{lead.name}</h1>
            <p className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-ink-faint">
              <ChannelIcon channel={channelId} className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{[channel, firstWrote ? `first wrote ${firstWrote}` : null].filter(Boolean).join(" · ")}</span>
            </p>
          </div>
        </div>

        {showWants && (
          <dl className="grid grid-cols-3 gap-1.5 rounded-[14px] bg-card-2 px-3 py-2.5 lg:mt-3">
            {wants.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[11.5px] text-ink-faint">{label}</dt>
                <dd className={"line-clamp-2 text-[13.5px] leading-snug " + (value ? "font-semibold" : "text-ink-faint")}>{value ?? "Not yet"}</dd>
              </div>
            ))}
          </dl>
        )}

        {/* Phone: a ready customer's card comes first — it is what the alert was about. */}
        {showReady && <div className="mt-4 lg:hidden">{readyCard}</div>}

        <div aria-hidden="true" className="flex-1 lg:hidden" />
        {/* id: the target of CatchUp's "Show all N messages". */}
        <div id="conversation" className="mt-4 lg:mt-6">
          <Thread messages={lead.conversation} leadName={lead.name} timeZone={timeZone} now={now} />
        </div>

        {didLine && (
          <div className="mt-4 px-1">
            <Eyebrow>What FollowUp did</Eyebrow>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{didLine}</p>
          </div>
        )}

        {callable && (
          <div className="mt-6">
            <CallBox
              leadId={lead.id}
              leadName={lead.name}
              phone={callable}
              replyWaiting={Boolean(approval)}
              lastCall={lastCallWords}
              nextCallAt={calls?.nextCallAt ? when(calls.nextCallAt) : null}
            />
          </div>
        )}

        {/* id: the target of the ready card's "Message". */}
        <div id="reply" className="mt-5 scroll-mt-4">
          {siteReply ? (
            <SiteReplyCard key={lead.id} leadId={lead.id} leadName={lead.name} site={siteReply} draft={lead.suggestedMessage} waiting={Boolean(approval)} />
          ) : !lead.suggestedMessage ? (
            // Nothing written yet: one box pinned at the bottom (A-220). A written reply keeps its card below.
            <ReplyBar
              leadId={lead.id}
              leadName={lead.name}
              seenInboundAt={newestInboundAt(lead.conversation)}
              sendLocked={sendLocked}
              languageName={replyLanguage}
            />
          ) : (
            <ReplyCard
              // A new draft (a "No answer" text, A-103) is a new card: its text is held in the card's own state.
              key={lead.suggestedMessage}
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
              textTo={approval?.textTo ?? null}
              why={holdWhy}
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
      <CustomerSide
        name={lead.name}
        line={
          <>
            <ChannelIcon channel={channelId} className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{[channel, firstWrote ? `first wrote ${firstWrote}` : null].filter(Boolean).join(" · ")}</span>
          </>
        }
      >
        {readyCard && <div className={showReady ? "hidden lg:block" : undefined}>{readyCard}</div>}
        <Facts lead={lead} approval={approval} now={now} />

        {/* Three pills, as drawn. The third is Call when there is a number
            to call, and Email (their own mail app) when there isn't, so
            an email-only customer still has a way to reach them directly. */}
        <div className="flex flex-wrap items-center gap-2">
          {/* With the Call box (A-103), Already spoke and Call live in it, once. */}
          {lead.automationStatus?.kind !== "closed" && !callable && (
            <WeTalkedButton leadId={lead.id} leadName={lead.name} talked={lead.automationStatus?.kind === "talked"} onSite={Boolean(siteReply)} />
          )}
          <CopyBookingLinkButton leadId={lead.id} />
          {/* The ready card already carries "Call {name}": one Call button, not two. */}
          {callable || (showReady && isCallablePhone(lead.phone)) ? null : isCallablePhone(lead.phone) ? (
            <a href={telHref(lead.phone)} className={PILL}>
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
          <CollapsibleSection row title="Follow-up plan" status={lead.nextFollowUp ? `Next ${formatDate(lead.nextFollowUp, timeZone)}` : "None"}>
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
                <span>{formatDate(lead.lastContacted, timeZone)}</span>
              </p>
              <p className="leading-relaxed text-ink-soft">{lead.scoreReason || "FollowUp hasn't reviewed this customer yet."}</p>
              {lead.notes && <p className="leading-relaxed text-ink-soft">{lead.notes}</p>}
            </div>
          </CollapsibleSection>
          <div className="border-t border-line-2 px-[18px] py-3 text-[13px]">
            <DeleteLeadButton leadId={lead.id} leadName={lead.name} leadEmail={lead.email} />
          </div>
        </DetailsFold>
      </CustomerSide>
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
            {plainHoldReason(approval.reason, { firstName: lead.name.split(" ")[0] || lead.name, topic: approval.riskTopic }) ?? "Every reply waits for your OK."}
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
    lead_form: "Facebook lead form",
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
