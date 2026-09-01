"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { leads, formatCurrency, formatDate, daysSince } from "@/lib/demo-data";
import ScoreBadge from "@/components/ScoreBadge";
import PriorityPill from "@/components/PriorityPill";
import { Search } from "lucide-react";

const filters = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "hot", label: "Hot" },
  { id: "today", label: "Follow-up today" },
  { id: "cold", label: "Cold" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
] as const;

type FilterId = (typeof filters)[number]["id"];

export default function LeadsPage() {
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    let list = [...leads];
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
  }, [filter, query]);

  return (
    <div>
      <h1 className="font-display text-3xl">Leads</h1>
      <p className="text-ink-soft mt-1">{leads.length} total, sorted by follow-up priority.</p>

      <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
              style={{
                backgroundColor: filter === f.id ? "var(--ink)" : "var(--card)",
                color: filter === f.id ? "white" : "var(--ink-soft)",
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
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{lead.name}</p>
              <p className="text-sm text-ink-soft truncate">{lead.company}</p>
            </div>
            <div className="hidden sm:block">
              <PriorityPill priority={lead.priority} />
            </div>
            <div className="text-sm text-ink-soft hidden md:block w-24">
              {formatDate(lead.lastContacted)}
            </div>
            <div className="text-sm font-medium tabular-nums w-20 text-right" style={{ color: "var(--gold)" }}>
              {formatCurrency(lead.dealValue)}
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-ink-soft">No leads match this filter.</p>
        )}
      </div>
    </div>
  );
}
