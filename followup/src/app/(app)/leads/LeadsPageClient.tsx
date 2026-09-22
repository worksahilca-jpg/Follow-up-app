"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Lead } from "@/lib/types";
import { formatCurrency, daysSince } from "@/lib/demo-data";
import { matchesSavedFilter, type SavedFilterCriteria, type SavedFilterSummary } from "@/lib/savedFilterMatch";
import AddLeadForm from "@/components/AddLeadForm";
import ImportLeadsForm from "@/components/ImportLeadsForm";
import LogCallForm from "@/components/LogCallForm";
import SmartViewForm from "@/components/SmartViewForm";
import EmptyState from "@/components/EmptyState";
import CleanupLeadsButton from "@/components/CleanupLeadsButton";
import { Search, Plus, Upload, Phone, Inbox, SlidersHorizontal, X, MoreHorizontal } from "lucide-react";
import FadeIn from "@/components/motion/FadeIn";
import { PageHeader } from "@/components/PageHeader";
import { ItemBox, ItemBoxList, type ItemTone } from "@/components/ItemBox";

/**
 * The rail tone, and the word that tone stands for, for one lead.
 *
 * Same 3/7-day scale src/lib/urgency.ts has always used — it just returns a
 * token name here instead of a colour, because ItemBox will not accept a bare
 * colour. The word is the point: the rail used to be the *only* thing on the
 * row explaining itself, and on a phone it was the only thing that survived at
 * all. Now the colour and "Silent 9 days" always travel together.
 */
function urgencyTone(lead: Lead): { tone: ItemTone; label: string } {
  if (lead.stage === "won") return { tone: "sage", label: "Won" };
  if (lead.stage === "lost") return { tone: "slate", label: "Lost" };

  const d = daysSince(lead.lastContacted);
  if (d === 0) return { tone: "sage", label: "Touched today" };
  if (d < 3) return { tone: "sage", label: `Silent ${d} ${d === 1 ? "day" : "days"}` };
  if (d < 7) return { tone: "gold", label: `Silent ${d} days` };
  return { tone: "coral", label: `Silent ${d} days` };
}

/**
 * The rest of line 2 — the facts that used to be four separate columns, three
 * of which (`PriorityPill`, `AutomationStatusBadge`, the assignee) were
 * `hidden` below md/lg. On a 390px phone the row used to survive as a bare
 * score number and a dollar figure: nothing that tells an owner whether to
 * act. These are words, so they survive at every width.
 *
 * Capped at two so line 2 stays one line. Order is by what would make someone
 * act: priority, then whether anything is actually going to happen on its own,
 * then whether it belongs to anybody.
 */
function leadFacts(lead: Lead): string | undefined {
  if (lead.stage === "won" || lead.stage === "lost") return undefined;

  const parts: string[] = [];
  if (lead.priority === "high") parts.push("high priority");

  const a = lead.automationStatus;
  if (a) {
    if (a.kind === "off") parts.push("automation off");
    else if (a.kind === "workflow_paused") parts.push("plan paused");
    else if (a.kind === "account_paused") parts.push("auto follow-up off");
    else if (a.kind === "due_soon") parts.push("following up soon");
    else if (a.kind === "workflow") parts.push(`on ${a.sequenceName}`);
  }

  if (!lead.assignedToId) parts.push("unassigned");

  return parts.length ? parts.slice(0, 2).join(" · ") : undefined;
}

const filters = [
  { id: "all", label: "All" },
  { id: "mine", label: "Mine" },
  { id: "unclaimed", label: "Unclaimed" },
  { id: "new", label: "New" },
  { id: "hot", label: "Hot" },
  { id: "today", label: "Follow-up today" },
  { id: "cold", label: "Cold" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
] as const;

type FilterId = (typeof filters)[number]["id"];

/**
 * The three demoted header actions. Four sibling buttons in a page header was
 * the thing being fixed — at 390px they wrapped under the h1 and consumed the
 * first screen — and no menu primitive existed to put them in.
 *
 * Deliberately small: a button, a popover, click-outside and Escape. No
 * dependency, no focus-trap ceremony. The menu holds three low-frequency
 * actions, not a navigation system.
 */
function LeadsMoreMenu({ onLogCall, onImport }: { onLogCall: () => void; onImport: () => void }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      setOpen(false);
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const item =
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-left hover:bg-paper transition-colors";

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-sm font-medium sm:w-auto"
      >
        <MoreHorizontal className="h-4 w-4" />
        More
      </button>
      {open && (
        /* No overflow-hidden. "Clean up leads" opens its own confirm panel,
           absolutely positioned inside this box — with overflow-hidden the
           panel was clipped away entirely, so the menu item looked like a
           dead button that did nothing when pressed, on the one destructive
           action in the product. The item hovers are rounded instead, which
           is what the clipping was doing for them. */
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-52 box p-1"
          style={{ boxShadow: "var(--shadow-box-hover)" }}
        >
          <button role="menuitem" className={item} onClick={() => { setOpen(false); onLogCall(); }}>
            <Phone className="h-4 w-4 text-ink-soft" />
            Log a call
          </button>
          <button role="menuitem" className={item} onClick={() => { setOpen(false); onImport(); }}>
            <Upload className="h-4 w-4 text-ink-soft" />
            Import CSV
          </button>
          {/* Wears the menu row's own styling rather than arriving as a
              bordered button inside a list of plain rows. */}
          <CleanupLeadsButton triggerClassName={item} />
        </div>
      )}
    </div>
  );
}

export default function LeadsPageClient({ leads }: { leads: Lead[] }) {
  const { data: session } = useSession();
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [showAddLead, setShowAddLead] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showLogCall, setShowLogCall] = useState(false);

  // Smart Views (see research/market/2026-09-05-competitor-feature-gaps.md
  // #2.1) — saved custom filters, alongside the hardcoded quick chips
  // above. `customCriteria` holds a just-built, not-yet-saved filter;
  // `activeSavedFilterId` is which saved view (if any) is currently
  // applied. Only one of quick-filter/custom/saved is ever active at a
  // time, same single-select feel as the existing chip row.
  const [savedFilters, setSavedFilters] = useState<SavedFilterSummary[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [customCriteria, setCustomCriteria] = useState<SavedFilterCriteria | null>(null);
  const [activeSavedFilterId, setActiveSavedFilterId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/saved-filters")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setSavedFilters(data.filters);
      })
      .catch(() => {}); // Smart Views are a convenience on top of the quick filters, not load-bearing — a failed fetch just means none show up yet
  }, []);

  function selectQuickFilter(id: FilterId) {
    setFilter(id);
    setCustomCriteria(null);
    setActiveSavedFilterId(null);
  }

  function selectSavedFilter(id: string) {
    setActiveSavedFilterId(id);
    setCustomCriteria(null);
  }

  async function deleteSavedFilter(id: string) {
    setSavedFilters((prev) => prev.filter((f) => f.id !== id));
    if (activeSavedFilterId === id) {
      setActiveSavedFilterId(null);
      setFilter("all");
    }
    await fetch(`/api/saved-filters/${id}`, { method: "DELETE" }).catch(() => {});
  }

  const activeSavedFilter = savedFilters.find((f) => f.id === activeSavedFilterId) ?? null;

  const filtered = useMemo(() => {
    let list = [...leads];

    if (activeSavedFilter) {
      list = list.filter((l) => matchesSavedFilter(l, activeSavedFilter.criteria));
    } else if (customCriteria) {
      list = list.filter((l) => matchesSavedFilter(l, customCriteria));
    } else {
      if (filter === "mine") list = list.filter((l) => l.assignedToId === session?.user?.id);
      if (filter === "unclaimed") list = list.filter((l) => !l.assignedToId);
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
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (l) => l.name.toLowerCase().includes(q) || l.company.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => b.score - a.score);
  }, [leads, filter, query, session?.user?.id, activeSavedFilter, customCriteria]);

  // Counts for the three chips that used to have a stat tile each above them.
  // Only these three: a number on every chip would be noise, and "All" is
  // already the subtitle.
  const CHIP_COUNTS = {
    hot: leads.filter((l) => l.priority === "high").length,
    cold: leads.filter((l) => l.stage !== "won" && l.stage !== "lost" && daysSince(l.lastContacted) >= 7).length,
    won: leads.filter((l) => l.stage === "won").length,
  };

  const activeFilterLabel = filters.find((f) => f.id === filter)?.label ?? "this filter";

  return (
    <div>
      {/* Four sibling buttons used to sit here. At 390px they wrapped under the
          h1 and ate the first screen of a page whose entire job is the list
          underneath. One primary stays; the other three move into the menu,
          which is also the honest hierarchy — adding a lead is the thing
          someone came here to do, cleaning up is not. */}
      <PageHeader
        title="Leads"
        subtitle={`${leads.length} total, sorted by follow-up priority.`}
        actions={
          <LeadsMoreMenu
            onLogCall={() => setShowLogCall(true)}
            onImport={() => setShowImport(true)}
          />
        }
        primary={
          <button
            onClick={() => setShowAddLead(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium"
            style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
          >
            <Plus className="h-4 w-4" />
            Add lead
          </button>
        }
      />

      {showAddLead && <AddLeadForm onClose={() => setShowAddLead(false)} />}
      {showImport && <ImportLeadsForm onClose={() => setShowImport(false)} />}
      {showLogCall && <LogCallForm onClose={() => setShowLogCall(false)} />}
      {showBuilder && (
        <SmartViewForm
          leads={leads}
          onClose={() => setShowBuilder(false)}
          onApply={(criteria) => {
            setCustomCriteria(criteria);
            setActiveSavedFilterId(null);
          }}
          onSaved={(savedFilter) => {
            setSavedFilters((prev) => [...prev, savedFilter]);
            setCustomCriteria(null);
            setActiveSavedFilterId(savedFilter.id);
          }}
        />
      )}

      {/* The four stat tiles that used to sit here (Total / Hot / Going cold /
          Won) said the same three things as the Hot, Cold and Won chips
          directly beneath them, and "Total" repeats the subtitle above. Three
          facts stated twice, stacked, pushing the list itself to fourth place
          on the page. The counts moved onto the chips they duplicated, which
          is where someone reading "Hot" wants the number anyway. This is the
          "gain density, lose elements" trade S-06 requires. */}

      <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        {/* One scrolling line rather than flex-wrap: at 390px thirteen chips
            wrapped to three rows and pushed the list down again. */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mb-1 sm:flex-wrap sm:overflow-visible sm:pb-0 sm:mb-0">
          {filters.map((f) => {
            const active = !activeSavedFilter && !customCriteria && filter === f.id;
            // The count the deleted stat tile used to carry, on the chip that
            // already named the same thing.
            const count = CHIP_COUNTS[f.id as keyof typeof CHIP_COUNTS];
            return (
              <button
                key={f.id}
                onClick={() => selectQuickFilter(f.id)}
                className="shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: active ? "var(--ink)" : "var(--card)",
                  color: active ? "var(--paper)" : "var(--ink-soft)",
                  border: active ? "none" : "1px solid var(--line)",
                }}
              >
                {f.label}
                {count !== undefined && (
                  <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
                )}
              </button>
            );
          })}
          {savedFilters.length > 0 && <span className="w-px self-stretch bg-line mx-0.5" />}
          {savedFilters.map((sf) => {
            const active = activeSavedFilterId === sf.id;
            const canDelete = sf.createdById === session?.user?.id;
            return (
              <span
                key={sf.id}
                className="inline-flex items-center rounded-full text-sm font-medium transition-colors overflow-hidden"
                style={{
                  backgroundColor: active ? "var(--ink)" : "var(--card)",
                  color: active ? "var(--paper)" : "var(--ink-soft)",
                  border: active ? "none" : "1px solid var(--line)",
                }}
              >
                <button onClick={() => selectSavedFilter(sf.id)} className="pl-3 pr-1.5 py-1.5" title={sf.shared ? "Shared with the team" : "Only visible to you"}>
                  {sf.name}
                </button>
                {canDelete && (
                  <button
                    onClick={() => deleteSavedFilter(sf.id)}
                    className="pr-2.5 pl-0.5 py-1.5 opacity-60 hover:opacity-100"
                    aria-label={`Delete ${sf.name}`}
                    title="Delete this view"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            );
          })}
          <button
            onClick={() => setShowBuilder(true)}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium border border-dashed border-line text-ink-soft"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Custom filter
          </button>
        </div>
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-ink-soft" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search leads…"
            className="pl-9 pr-3 py-2 rounded-lg border border-line bg-card text-sm w-full sm:w-56"
          />
        </div>
      </div>

      {/* One fade for the whole list rather than a per-row stagger — at list
          length (a dozen rows, a hundred) a per-child delay just makes
          scanning feel slow.

          The row is rebuilt, and this is the change that matters most on this
          screen. It used to be seven columns, four of them `hidden` below
          md/lg: priority, automation state, assignee and last-contacted date
          all disappeared on a phone, leaving a bare score number with no unit
          and a dollar figure — nothing that tells an owner whether to act, on
          the one device this ICP actually opens. Those four facts are words
          now (see urgencyTone/leadFacts above), so they survive at every
          width, and the rail finally has something on the row explaining it.

          The score circle is gone rather than kept: it was a second hue inside
          the box, which the one-hue-per-box cap (S-05) doesn't allow, and its
          number never carried a unit anyone could read. The score still leads
          the sort, and the detail page still explains it. */}
      <FadeIn className="mt-6">
        <ItemBoxList>
          {filtered.map((lead) => (
            <ItemBox
              key={lead.id}
              href={`/leads/${lead.id}`}
              title={lead.company ? `${lead.name} · ${lead.company}` : lead.name}
              figure={<span className="text-ink font-medium">{formatCurrency(lead.dealValue)}</span>}
              status={urgencyTone(lead)}
              fact={leadFacts(lead)}
            />
          ))}
        </ItemBoxList>

        {filtered.length === 0 && leads.length > 0 && (
          <p className="py-8 text-center text-sm text-ink-soft">
            No leads match <span className="text-ink font-medium">{activeFilterLabel}</span>.{" "}
            <button
              onClick={() => selectQuickFilter("all")}
              className="underline underline-offset-2"
              style={{ color: "var(--accent)" }}
            >
              Show all leads
            </button>
          </p>
        )}
        {leads.length === 0 && (
          <EmptyState
            icon={Inbox}
            title="No leads yet"
            /* Named one source out of eight until 2026-09-22. A business
               running on Instagram DMs, WhatsApp or a website form opened
               this screen and was told to connect an inbox it does not use
               — the same dead end the founder had already called out in
               onboarding ("we will help them to connect the sources"), on
               a screen nobody went back and checked. */
            description="Connect a lead source in Settings — your inbox, website form, DMs or CRM — or add one by hand."
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
      </FadeIn>
    </div>
  );
}
