"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Lead } from "@/lib/types";
import { formatCurrency, formatDate, daysSince } from "@/lib/demo-data";
import { urgencyColor } from "@/lib/urgency";
import ScoreBadge from "@/components/ScoreBadge";
import PriorityPill from "@/components/PriorityPill";
import AddLeadForm from "@/components/AddLeadForm";
import ImportLeadsForm from "@/components/ImportLeadsForm";
import LogCallForm from "@/components/LogCallForm";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import CleanupLeadsButton from "@/components/CleanupLeadsButton";
import { Search, Plus, Upload, Phone, Users, Flame, Snowflake, Trophy, Inbox } from "lucide-react";

const filters = [
  { id: "all", label: "All" },
  { id: "mine", label: "Mine" },
  { id: "new", label: "New" },
  { id: "hot", label: "Hot" },
  { id: "today", label: "Follow-up today" },
  { id: "cold", label: "Cold" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
] as const;

type FilterId = (typeof filters)[number]["id"];

export default function LeadsPageClient({ leads }: { leads: Lead[] }) {
  const { data: session } = useSession();
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [showAddLead, setShowAddLead] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showLogCall, setShowLogCall] = useState(false);

  const filtered = useMemo(() => {
    let list = [...leads];
    if (filter === "mine") list = list.filter((l) => l.assignedToId === session?.user?.id);
    if (filter === "new") list = list.filter((l) => l.stage === "new");
    if (filter === "hot") list = list.filter((l) => l.priority === "high");
    if (filter === "today") {
      list = list.filter((l) => {
        if (!l.nextFollowUp) return false;
        return new Date(l.nextFollowUp).toDateString() === new Date().toDateString();
      });
    }
    if (filter === "cold") {
      list = list.filter((l) => {
        if (l.stage === "won" || l.stage === "lost") return false;
        return daysSince(l.lastContacted) >= 7;
      });
    }
    if (filter === "won") list = list.filter((l) => l.stage === "won");
    if (filter === "lost") list = list.filter((l) => l.stage === "lost");

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (l) => l.name.toLowerCase().includes(q) || l.company.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => b.score - a.score);
  }, [leads, filter, query, session?.user?.id]);

  const hotCount = leads.filter((l) => l.priority === "high").length;
  const coldCount = leads.filter((l) => l.stage !== "won" && l.stage !== "lost" && daysSince(l.lastContacted) >= 7).length;
  const wonCount = leads.filter((l) => l.stage === "won").length;

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Leads</h1>
          <p className="text-ink-soft mt-1">{leads.length} total, sorted by follow-up priority.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <CleanupLeadsButton />
          <button
            onClick={() => setShowLogCall(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium border border-line"
          >
            <Phone className="h-4 w-4" />
            Log a call
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium border border-line"
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </button>
          <button
            onClick={() => setShowAddLead(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium"
            style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
          >
            <Plus className="h-4 w-4" />
            Add lead
          </button>
        </div>
      </div>

      {showAddLead && <AddLeadForm onClose={() => setShowAddLead(false)} />}
      {showImport && <ImportLeadsForm onClose={() => setShowImport(false)} />}
      {showLogCall && <LogCallForm onClose={() => setShowLogCall(false)} />}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
        <StatCard label="Total" value={String(leads.length)} icon={Users} accent="var(--slate)" accentSoft="var(--slate-soft)" />
        <StatCard label="Hot" value={String(hotCount)} icon={Flame} accent="var(--rust)" accentSoft="var(--rust-soft)" />
        <StatCard label="Going cold" value={String(coldCount)} icon={Snowflake} accent="var(--gold)" accentSoft="var(--gold-soft)" />
        <StatCard label="Won" value={String(wonCount)} icon={Trophy} accent="var(--sage)" accentSoft="var(--sage-soft)" />
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
              style={{
                backgroundColor: filter === f.id ? "var(--ink)" : "var(--card)",
                color: filter === f.id ? "var(--paper)" : "var(--ink-soft)",
                border: filter === f.id ? "none" : "1px solid var(--line)",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-ink-soft" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search leads..."
            className="pl-9 pr-3 py-2 rounded-lg border border-line bg-card text-sm w-full sm:w-56"
          />
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-line bg-card divide-y divide-line overflow-hidden">
        {filtered.map((lead) => (
          <Link
            key={lead.id}
            href={`/leads/${lead.id}`}
            className="flex items-center gap-4 px-5 py-4 hover:bg-paper transition-colors"
          >
            <ScoreBadge score={lead.score} size="sm" />
            {lead.stage !== "won" && lead.stage !== "lost" && (
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: urgencyColor(daysSince(lead.lastContacted)) }}
                title={`${daysSince(lead.lastContacted)} days since last contact`}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{lead.name}</p>
              <p className="text-sm text-ink-soft truncate">{lead.company}</p>
            </div>
            <div className="hidden sm:block">
              <PriorityPill priority={lead.priority} />
            </div>
            <div className="text-sm text-ink-soft hidden lg:block w-28 truncate">{lead.assignedTo}</div>
            <div className="text-sm text-ink-soft hidden md:block w-24">
              {formatDate(lead.lastContacted)}
            </div>
            <div className="text-sm font-medium tabular-nums w-20 text-right" style={{ color: "var(--gold)" }}>
              {formatCurrency(lead.dealValue)}
            </div>
          </Link>
        ))}
        {filtered.length === 0 && leads.length > 0 && (
          <p className="px-5 py-8 text-center text-sm text-ink-soft">No leads match this filter.</p>
        )}
        {leads.length === 0 && (
          <EmptyState
            icon={Inbox}
            title="No leads yet"
            description="Connect Gmail in Settings to sync your inbox, or add one manually to get started."
            action={
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setShowAddLead(true)}
                  className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium"
                  style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
                >
                  Add a lead
                </button>
                <Link
                  href="/settings"
                  className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium border border-line"
                >
                  Go to Settings
                </Link>
              </div>
            }
          />
        )}
      </div>
    </div>
  );
}
