import { notFound } from "next/navigation";
import { getLeadById } from "@/lib/leads-data";
import { formatCurrency, formatDate } from "@/lib/demo-data";
import ScoreBadge from "@/components/ScoreBadge";
import PriorityPill from "@/components/PriorityPill";
import StageSelector from "@/components/StageSelector";
import MessageComposer from "@/components/MessageComposer";
import LeadAutomationToggle from "@/components/LeadAutomationToggle";
import DeleteLeadButton from "@/components/DeleteLeadButton";
import { Mail, Phone, MessageSquare } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLeadById(id);
  if (!lead) notFound();

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">{lead.name}</h1>
          <p className="text-ink-soft">{lead.company}</p>
        </div>
        <ScoreBadge score={lead.score} size="lg" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <PriorityPill priority={lead.priority} />
        <StageSelector leadId={lead.id} stage={lead.stage} />
        <span className="text-sm font-medium" style={{ color: "var(--gold)" }}>
          {formatCurrency(lead.dealValue)} potential
        </span>
      </div>

      <div className="mt-4 flex gap-2">
        <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium" style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}>
          <Mail className="h-3.5 w-3.5" /> Email
        </a>
        {lead.phone && (
          <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium">
            <Phone className="h-3.5 w-3.5" /> {lead.phone}
          </a>
        )}
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-soft">
          <MessageSquare className="h-3.5 w-3.5" /> Text
        </span>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mt-8">
        <div className="md:col-span-2 space-y-8">
          <section>
            <h2 className="font-display text-xl">Why this score</h2>
            <p className="text-sm text-ink-soft mt-2 leading-relaxed">{lead.scoreReason}</p>
            <div className="mt-3 space-y-1.5">
              {lead.scoreFactors.map((f) => (
                <div key={f.label} className="flex items-center justify-between text-sm">
                  <span className="text-ink-soft">{f.label}</span>
                  <span className="font-medium tabular-nums" style={{ color: f.weight >= 0 ? "var(--sage)" : "var(--rust)" }}>
                    {f.weight >= 0 ? "+" : ""}
                    {f.weight}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-display text-xl">Conversation</h2>
            <div className="mt-3 space-y-3">
              {lead.conversation.map((m) => (
                <div
                  key={m.id}
                  className="rounded-lg border border-line p-3 text-sm"
                  style={{
                    marginLeft: m.direction === "outbound" ? "1.5rem" : 0,
                    backgroundColor: m.direction === "outbound" ? "var(--slate-soft)" : "var(--card)",
                  }}
                >
                  <div className="flex items-center justify-between text-xs text-ink-soft mb-1">
                    <span className="uppercase tracking-wide">
                      {m.direction === "outbound" ? "You" : lead.name} · {m.channel}
                    </span>
                    <span>{formatDate(m.date)}</span>
                  </div>
                  <p>{m.body}</p>
                  {m.opened && <p className="text-xs mt-1" style={{ color: "var(--rust)" }}>Opened</p>}
                </div>
              ))}
            </div>
          </section>

          <MessageComposer leadId={lead.id} initialMessage={lead.suggestedMessage} leadName={lead.name} />
        </div>

        <aside className="space-y-6">
          <div className="rounded-xl border border-line bg-card p-4">
            <h3 className="text-sm font-semibold">Details</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-soft">Source</dt>
                <dd>{lead.source}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Assigned to</dt>
                <dd>{lead.assignedTo}</dd>
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
          </div>
          <div className="rounded-xl border border-line bg-card p-4">
            <h3 className="text-sm font-semibold">Notes</h3>
            <p className="text-sm text-ink-soft mt-2 leading-relaxed">{lead.notes}</p>
          </div>
          <LeadAutomationToggle leadId={lead.id} initialEnabled={lead.automationEnabled} />
          <DeleteLeadButton leadId={lead.id} leadName={lead.name} />
        </aside>
      </div>
    </div>
  );
}
