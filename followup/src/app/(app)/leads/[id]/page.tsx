import { notFound } from "next/navigation";
import { getLeadById, getLeadAuditTrail } from "@/lib/leads-data";
import { getFreeTierStatus } from "@/lib/billing";
import { formatCurrency, formatDate } from "@/lib/demo-data";
import PriorityPill from "@/components/PriorityPill";
import StageSelector from "@/components/StageSelector";
import MessageComposer from "@/components/MessageComposer";
import LeadAutomationToggle from "@/components/LeadAutomationToggle";
import LeadWorkflowEnrollment from "@/components/LeadWorkflowEnrollment";
import LeadAssignmentSelect from "@/components/LeadAssignmentSelect";
import DeleteLeadButton from "@/components/DeleteLeadButton";
import CopyBookingLinkButton from "@/components/CopyBookingLinkButton";
import LeadTrustPanel from "@/components/LeadTrustPanel";
import AutomationStatusBadge from "@/components/AutomationStatusBadge";
import WeTalkedButton from "@/components/WeTalkedButton";
import CollapsibleSection from "@/components/CollapsibleSection";
import ConversationThread from "@/components/ConversationThread";
import { PageHeader } from "@/components/PageHeader";
import { Mail, Phone, MessageSquare } from "lucide-react";
import { isInstagramLeadId, isSocialLeadId } from "@/lib/instagramId";
import type { LeadLanguage } from "@/lib/leadLanguage";
import { sendLockedForSession } from "@/lib/sendingControl";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLeadById(id);
  if (!lead) notFound();
  const [auditTrail, freeTierStatus, sendLocked] = await Promise.all([getLeadAuditTrail(id), getFreeTierStatus(), sendLockedForSession()]);
  const autonomousAllowed = freeTierStatus?.tier !== "free";

  return (
    <div>
      {/* There was no way back to the list from here — a real dead end on a
          phone, where the browser's own back button is the only escape and
          people don't reliably reach for it inside an app. */}
      <PageHeader back={{ href: "/leads", label: "Leads" }} title={lead.name} subtitle={lead.company} />

      {/* The 64px score circle used to sit top-right — the second-largest
          element on the page, containing a bare number — while the sentence
          explaining it ("Why this score") sat several hundred pixels below in
          the left column. A verdict and its reasoning separated by the entire
          layout. They are one thing now: the sentence leads, the number is a
          small figure beside it, and the weighted factors stay available
          under the fold rather than being the first thing read.

          When the AI hasn't looked at this lead yet, say so — the same
          honesty PriorityPill already applies. "No reason given" is very
          different from "we haven't looked", and on an unanswered buyer
          question the difference is the whole product. */}
      <div className="mt-4 flex items-start gap-3">
        <p className="flex-1 text-sm leading-relaxed text-ink-soft">
          {lead.scoreReason || "FollowUp hasn't reviewed this lead yet — no score reasoning available."}
        </p>
        {lead.scoreReason && (
          <span className="shrink-0 font-mono text-sm tabular-nums text-ink-soft" title="Lead score, 0–100">
            {lead.score}/100
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <PriorityPill priority={lead.priority} reviewed={lead.reviewed} />
        <StageSelector leadId={lead.id} stage={lead.stage} />
        <span className="text-sm font-medium">
          {formatCurrency(lead.dealValue)} potential
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {lead.phone && isSocialLeadId(lead.phone) ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-soft">
            <MessageSquare className="h-3.5 w-3.5" /> {isInstagramLeadId(lead.phone) ? "Instagram DM" : "Facebook Messenger"}
          </span>
        ) : (
          lead.phone && (
            <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium">
              <Phone className="h-3.5 w-3.5" /> {lead.phone}
            </a>
          )
        )}
        <CopyBookingLinkButton leadId={lead.id} />
        {/* Demoted from the page's one filled button to a plain link. It opens
            mailto:, which leaves FollowUp entirely — whatever gets sent has no
            record here, no audit trail and no effect on scoring, which is a
            direct hole in "own the conversation". Making it the most prominent
            control on the page actively pushed people out of the product. The
            composer below is the real way to reply; this stays for the cases
            where someone genuinely wants their own mail client.

            Whether it should exist at all is a product call, not a design one
            — flagged for Sahil, not decided here. */}
        {lead.email && (
          <a
            href={`mailto:${lead.email}`}
            className="inline-flex items-center gap-1.5 text-sm text-ink-soft underline underline-offset-2"
          >
            <Mail className="h-3.5 w-3.5" /> Open in your mail app
          </a>
        )}
      </div>

      {/* research/product/2026-09-10-ux-simplification.md §8: this used to
          be one card buried at the top of a 7-card sidebar stack — moved
          up front since it's already computed to answer the one question
          that actually varies by lead state: what's FollowUp doing here,
          and is anything waiting on you. See automationStatus.ts. */}
      <div className="mt-6 flex flex-wrap items-start gap-x-4 gap-y-2">
        <AutomationStatusBadge status={lead.automationStatus} />
        {/* "We talked" (design brain A-039) sits with the status because it
            changes the status: after a call or a visit, FollowUp stops
            checking in until they write again. Not on a closed lead,
            where nothing is checking in anyway. */}
        {lead.automationStatus?.kind !== "closed" && (
          <WeTalkedButton leadId={lead.id} leadName={lead.name} talked={lead.automationStatus?.kind === "talked"} />
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-8 mt-8">
        {/* min-w-0 on the grid items. An `auto` grid track's minimum is its
            item's min-content size, and min-width:0 on an inner flex item
            only lets that item shrink — it does not stop the nowrap text
            inside it (the composer's "To Name <email>" row) from propagating
            its full width up through the track. Without this the whole lead
            page was 539px wide on a 390px phone and scrolled sideways. */}
        <div className="min-w-0 md:col-span-2 space-y-8">
          {/* The composer is the page's actual job and it used to be THIRD in
              this column, under an unbounded conversation list. It comes
              first now — the reason to be on this screen is reachable without
              scrolling past twenty old messages. */}
          <MessageComposer
            leadId={lead.id}
            initialMessage={lead.suggestedMessage}
            initialSubject={lead.suggestedSubject}
            leadName={lead.name}
            leadEmail={lead.email || undefined}
            seenInboundAt={newestInboundAt(lead.conversation)}
            sendLocked={sendLocked}
          />

          <ConversationThread messages={lead.conversation} leadName={lead.name} />

          {lead.scoreFactors.length > 0 && (
            <CollapsibleSection title="See the factors behind the score">
              <div className="space-y-1.5">
                {lead.scoreFactors.map((f) => (
                  <div key={f.label} className="flex items-center justify-between text-sm">
                    <span className="text-ink-soft">{f.label}</span>
                    <span
                      className="font-medium tabular-nums"
                      style={{ color: f.weight >= 0 ? "var(--sage)" : "var(--coral)" }}
                    >
                      {f.weight >= 0 ? "+" : ""}
                      {f.weight}
                    </span>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}
        </div>

        {/* Was: a `divide-y` wrapper around four CollapsibleSections, two of
            which wrapped their own `rounded-xl border bg-card` card — three
            box levels deep, the clearest S-09 violation in the app. Each
            section is now the box, sitting directly on the paper, one level. */}
        <aside className="min-w-0 space-y-2">
          <div>
            <CollapsibleSection title="Details">
              <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-ink-soft">Source</dt>
                    <dd>{lead.source}</dd>
                  </div>
                  <div className="flex justify-between items-start gap-3">
                    <dt className="text-ink-soft shrink-0">Assigned to</dt>
                    <dd>
                      <LeadAssignmentSelect
                        leadId={lead.id}
                        initialAssignedToId={lead.assignedToId}
                        initialAssignedToName={lead.assignedTo}
                      />
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-soft">Last contacted</dt>
                    <dd>{formatDate(lead.lastContacted)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-soft">Next follow-up</dt>
                    <dd>{lead.nextFollowUp ? formatDate(lead.nextFollowUp) : "—"}</dd>
                  </div>
              </dl>
            </CollapsibleSection>
          </div>

          <div>
            <CollapsibleSection title="Notes">
              <p className="text-sm text-ink-soft leading-relaxed">{lead.notes || "No notes yet."}</p>
            </CollapsibleSection>
          </div>

          <div>
            <CollapsibleSection title="Consent & AI activity">
              <LeadTrustPanel source={lead.source} optedOutAt={lead.optedOutAt} auditTrail={auditTrail} languageRead={lead.languageRead as LeadLanguage | null} />
            </CollapsibleSection>
          </div>

          <div>
            <CollapsibleSection title="Automation & follow-up plan">
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
          </div>

          <div className="pt-4">
            <DeleteLeadButton leadId={lead.id} leadName={lead.name} />
          </div>
        </aside>
      </div>
    </div>
  );
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
