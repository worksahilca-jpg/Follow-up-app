"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ScrollTitle from "@/components/app/ScrollTitle";
import { useSession } from "next-auth/react";
import { Lead } from "@/lib/types";
import { daysSince, PIPELINE_STAGES } from "@/lib/demo-data";
import { matchesSavedFilter, type SavedFilterCriteria, type SavedFilterSummary } from "@/lib/savedFilterMatch";
import AddLeadForm from "@/components/AddLeadForm";
import ImportLeadsForm from "@/components/ImportLeadsForm";
import LogCallForm from "@/components/LogCallForm";
import SmartViewForm from "@/components/SmartViewForm";
import EmptyState from "@/components/EmptyState";
import CleanupLeadsButton from "@/components/CleanupLeadsButton";
import { motion } from "framer-motion";
import { MOTION } from "@/lib/motion";
import { Search, Plus, Upload, Phone, Inbox, SlidersHorizontal, X, ChevronLeft } from "lucide-react";
import { Initials, shortAge } from "@/components/app/canvasBits";

/**
 * The filters on Everyone. The pipeline's stages are filters here now
 * (A-219: Pipeline was a second copy of this list, grouped by stage); a
 * stage's total value shows above its rows, as the Pipeline column did.
 */
const filters: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mine", label: "Mine" },
  { id: "unclaimed", label: "Unclaimed" },
  { id: "hot", label: "Hot" },
  { id: "today", label: "Follow-up today" },
  { id: "cold", label: "Cold" },
  ...PIPELINE_STAGES.map((s) => ({ id: `stage:${s.id}`, label: s.label })),
];

type FilterId = string;

/**
 * The three demoted header actions. Four sibling buttons in a page header was
 * the thing being fixed — at 390px they wrapped under the h1 and consumed the
 * first screen — and no menu primitive existed to put them in.
 *
 * Deliberately small: a button, a popover, click-outside and Escape. No
 * dependency, no focus-trap ceremony. The menu holds three low-frequency
 * actions, not a navigation system.
 */
function LeadsMoreMenu({ onAdd, onLogCall, onImport }: { onAdd: () => void; onLogCall: () => void; onImport: () => void }) {
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
        aria-label="Add or import customers"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-ink"
      >
        <Plus className="h-[18px] w-[18px]" />
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
          <button role="menuitem" className={item} onClick={() => { setOpen(false); onAdd(); }}>
            <Plus className="h-4 w-4 text-ink-soft" />
            Add a customer
          </button>
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

export type Show = "needs" | "ready" | "booked" | "quiet" | "waiting" | "all";
/** The line under a name when its group has something better to say than their last message. */
export type GroupLines = Record<string, string>;
type Groups = { needs: string[]; ready: string[]; booked: string[]; quiet: string[]; waiting: string[] };

const TITLE: Record<Show, string> = {
  needs: "Waiting for you",
  ready: "Ready to book",
  booked: "Booked",
  quiet: "Stopped replying",
  waiting: "Waiting for their reply",
  all: "All customers",
};
/** One plain line under the rows that open a list (A-220). */
const SUB: Partial<Record<Show, string>> = {
  ready: "FollowUp has what it asks for. Time for a call.",
  booked: "Calls and visits coming up",
  quiet: "Send a quick check-in.",
  waiting: "FollowUp will check in",
};
/** The one list shows this many, then "Show everyone" (with its filters) one tap away. */
const LIST_MAX = 50;

const lastOf = (l: Lead) => l.conversation[l.conversation.length - 1];
const said = (l: Lead) => {
  const m = lastOf(l);
  return m ? (m.direction === "outbound" ? `You: ${m.body}` : m.body) : l.company || l.source;
};

/** Where a customer is, in words, under their last message (A-267). */
type Status = "needs" | "ready" | "booked" | "quiet" | "waiting";

/** One customer: their name, one line, where they are in words, and (for Ready to book) a Call button beside the row. */
function Row({ lead, href, line, meta, selected, first = false, call = false, status = null, when = null }: { lead: Lead; href: string; line: string; meta?: string | null; selected?: boolean; first?: boolean; call?: boolean; status?: Status | null; when?: string | null }) {
  return (
    // The hairline between rows starts where the name starts (A-264): the 40px initials + the 12px gap.
    <li
      style={{ "--sep-inset": "52px" } as React.CSSProperties}
      className={"flex min-w-0 items-center gap-2.5" + (first ? "" : " ios-sep") + (selected ? " -mx-2 rounded-[12px] bg-card-2 px-2" : "")}
    >
      {/* On a phone the row opens the customer's own page, sliding in (A-222, A-264); on a computer, the panel beside the list. */}
      <Link
        href={href}
        data-nav="push"
        data-phone-href={`/leads/${lead.id}`}
        scroll={false}
        aria-current={selected ? "true" : undefined}
        className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 py-2.5"
      >
        <Initials name={lead.name} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{lead.name}</span>
          <span className="block truncate text-[13.5px] text-ink-soft">{line.replace(/\s+/g, " ")}</span>
          {status && <StatusLine status={status} when={when} />}
        </span>
        {meta && <span className="shrink-0 self-start pt-0.5 text-[12px] text-ink-faint tabular-nums">{meta}</span>}
      </Link>
      {/* Outlined, never black (one black button per screen); a 48px target around the 32px pill. */}
      {call && lead.phone && (
        <a
          href={`tel:${lead.phone}`}
          aria-label={`Call ${lead.name}`}
          className="relative inline-flex h-8 shrink-0 items-center rounded-full border border-ink px-3 text-[12.5px] font-semibold before:absolute before:-inset-2 before:content-['']"
        >
          Call
        </a>
      )}
    </li>
  );
}

/** The status in words (A-267): an orange dot only for "your turn"; green for ready to book; plain grey otherwise. */
function StatusLine({ status, when }: { status: Status; when: string | null }) {
  if (status === "needs") {
    return (
      <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-faint">
        <span aria-hidden="true" className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: "var(--state-needs)" }} />
        Your reply is ready
      </span>
    );
  }
  const words =
    status === "ready" ? "Ready to book. Time for a call." : status === "booked" ? `Booked${when ? ` · ${when}` : ""}` : status === "quiet" ? "Stopped replying" : "Waiting for their reply";
  return (
    <span className="mt-0.5 block truncate text-[13px]" style={{ color: status === "ready" ? "var(--sage)" : "var(--ink-faint)" }}>
      {words}
    </span>
  );
}

export default function LeadsPageClient({
  leads,
  groups,
  lines,
  show = null,
  stage = null,
  openId = null,
}: {
  leads: Lead[];
  /** Who is in which group, worked out on the server from the same sources Today uses. */
  groups: Groups;
  lines: GroupLines;
  /** A group opened as a list (?show=), or null for the groups. */
  show?: Show | null;
  /** A pipeline stage to filter Everyone by (?stage=, where /pipeline now lands). */
  stage?: string | null;
  /** The customer open beside the list (?p=), if any (A-025). */
  openId?: string | null;
}) {
  const { data: session } = useSession();
  const [filter, setFilter] = useState<FilterId>(stage && PIPELINE_STAGES.some((s) => s.id === stage) ? `stage:${stage}` : "all");
  const [showFilters, setShowFilters] = useState(Boolean(stage));
  const byId = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const [query, setQuery] = useState("");
  const [showAddLead, setShowAddLead] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showLogCall, setShowLogCall] = useState(false);

  // Smart Views (see research/market/2026-09-05-competitor-feature-gaps.md
  // #2.1) — saved custom filters, alongside the quick chips. `customCriteria`
  // holds a just-built, not-yet-saved filter; `activeSavedFilterId` is which
  // saved view (if any) is applied. Only one of quick/custom/saved is ever
  // active at a time.
  const [savedFilters, setSavedFilters] = useState<SavedFilterSummary[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [customCriteria, setCustomCriteria] = useState<SavedFilterCriteria | null>(null);
  const [activeSavedFilterId, setActiveSavedFilterId] = useState<string | null>(null);

  useEffect(() => {
    if (show !== "all") return;
    fetch("/api/saved-filters")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setSavedFilters(data.filters);
      })
      .catch(() => {}); // Smart Views are a convenience on top of the quick filters, not load-bearing — a failed fetch just means none show up yet
  }, [show]);

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

  // The people in the open group, in the group's own order; Everyone newest message first. Someone with no
  // message yet (just brought in from a CRM) goes by when they arrived there, not to the very bottom
  // (founder's HubSpot test, 2026-10-15: the three new contacts were 34th to 36th).
  const inGroup = useMemo(() => {
    if (!show || show === "all") {
      const at = (l: Lead) => (lastOf(l) ? new Date(lastOf(l)!.date).getTime() : new Date(l.lastContacted).getTime() || 0);
      return [...leads].sort((a, b) => at(b) - at(a));
    }
    return groups[show].map((id) => byId.get(id)).filter((l): l is Lead => Boolean(l));
  }, [show, leads, groups, byId]);

  const filtered = useMemo(() => {
    // Search on the groups page looks through everyone.
    let list = show ? inGroup : [...inGroup];
    if (show === "all") {
      if (activeSavedFilter) {
        list = list.filter((l) => matchesSavedFilter(l, activeSavedFilter.criteria));
      } else if (customCriteria) {
        list = list.filter((l) => matchesSavedFilter(l, customCriteria));
      } else {
        if (filter === "mine") list = list.filter((l) => l.assignedToId === session?.user?.id);
        if (filter === "unclaimed") list = list.filter((l) => !l.assignedToId);
        if (filter === "hot") list = list.filter((l) => l.priority === "high");
        if (filter === "today") {
          list = list.filter((l) => l.nextFollowUp && new Date(l.nextFollowUp).toDateString() === new Date().toDateString());
        }
        if (filter === "cold") list = list.filter((l) => l.stage !== "won" && l.stage !== "lost" && daysSince(l.lastContacted) >= 7);
        if (filter.startsWith("stage:")) list = list.filter((l) => l.stage === filter.slice(6));
      }
    }
    const q = query.trim().toLowerCase();
    if (q) {
      const digits = q.replace(/\D/g, "");
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.company.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          (digits.length >= 3 && (l.phone ?? "").replace(/\D/g, "").includes(digits))
      );
    }
    return list;
  }, [show, inGroup, filter, query, session?.user?.id, activeSavedFilter, customCriteria]);

  const activeFilterLabel = filters.find((f) => f.id === filter)?.label ?? "this filter";
  const stageTotal = show === "all" && filter.startsWith("stage:") && !activeSavedFilter && !customCriteria ? filtered.reduce((sum, l) => sum + (l.dealValue || 0), 0) : 0;

  const rowHref = (id: string) => `/leads?${show ? `show=${show}&` : ""}p=${id}`;
  // What a row says depends on where it is (A-220): why they're ready, why they're going quiet,
  // what happens next, when the booking is; otherwise their last message.
  const statusOf = (id: string): Status | null =>
    groups.needs.includes(id) ? "needs" : groups.ready.includes(id) ? "ready" : groups.booked.includes(id) ? "booked" : groups.quiet.includes(id) ? "quiet" : groups.waiting.includes(id) ? "waiting" : null;
  const rowFor = (lead: Lead, where: Show | null, first = false) => {
    const last = lastOf(lead);
    const line = where && where !== "all" && where !== "needs" ? (lines[lead.id] ?? said(lead)) : said(lead);
    const meta = where === "needs" || where === "all" || !where ? (last ? shortAge(last.date) : null) : null;
    // The one list and search (A-267): their last words, then where they are in words.
    const status = where ? null : statusOf(lead.id);
    const call = where === "ready" || status === "ready";
    return <Row key={lead.id} lead={lead} href={rowHref(lead.id)} line={line} meta={meta} selected={lead.id === openId} first={first} call={call} status={status} when={status === "booked" ? lines[lead.id] ?? null : null} />;
  };

  const searchBox = (
    <div className="relative mt-3">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-ink-faint" aria-hidden="true" />
      {/* 16px, so a phone doesn't zoom in when the box takes focus. */}
      <input
        id="customers-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search a name, email or phone"
        aria-label="Search customers"
        className="h-11 w-full rounded-full border-0 bg-card-2 pl-10 pr-4 text-base"
      />
    </div>
  );

  const forms = (
    <>
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
    </>
  );

  // ---- One group opened as a list (?show=). ----
  if (show) {
    return (
      <div className="max-w-[720px]">
        <Link href="/leads" className="-ml-1 inline-flex min-h-11 items-center gap-0.5 text-[13px] text-ink-soft hover:text-ink">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Customers
        </Link>
        <div className="flex items-baseline justify-between gap-3">
          <ScrollTitle title={TITLE[show]} />
          <h1 className="title-serif text-[26px] leading-tight">{TITLE[show]}</h1>
          <span className="text-[14px] font-semibold text-ink-soft tabular-nums">{inGroup.length}</span>
        </div>
        {SUB[show] && <p className="mt-0.5 text-[13px] text-ink-faint">{SUB[show]}</p>}
        {forms}
        {searchBox}

        {show === "all" && (
          <>
            <div className="mt-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                aria-expanded={showFilters}
                className="inline-flex h-11 items-center gap-1.5 rounded-full border border-line bg-card px-4 text-[13.5px] font-medium"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                Filter
                {(filter !== "all" || activeSavedFilter || customCriteria) && (
                  <span className="text-ink-faint">· {activeSavedFilter?.name ?? (customCriteria ? "Custom" : activeFilterLabel)}</span>
                )}
              </button>
              {stageTotal > 0 && (
                <span className="text-[13px] text-ink-soft tabular-nums">
                  {`$${stageTotal.toLocaleString("en-US")} in ${activeFilterLabel}`}
                </span>
              )}
            </div>
            {/* Opens under the Filter button and folds back into it (A-048).
                Kept mounted, so the filters keep their state while closed.
                One scrolling line on a phone rather than three wrapped rows. */}
            <motion.div
              initial={false}
              animate={
                showFilters
                  ? { opacity: 1, y: 0, display: "flex", transition: { duration: MOTION.move, ease: MOTION.easeOut } }
                  : { opacity: 0, y: -4, transition: { duration: MOTION.exit, ease: MOTION.easeIn }, transitionEnd: { display: "none" } }
              }
              style={{ display: showFilters ? "flex" : "none" }}
              aria-hidden={!showFilters}
              className="mt-2.5 -mb-1 gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible"
            >
              {filters.map((f) => {
                const active = !activeSavedFilter && !customCriteria && filter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => selectQuickFilter(f.id)}
                    className="h-11 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium"
                    style={{
                      backgroundColor: active ? "var(--ink)" : "var(--card)",
                      color: active ? "var(--paper)" : "var(--ink-soft)",
                      border: active ? "none" : "1px solid var(--line)",
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
              {savedFilters.map((sf) => {
                const active = activeSavedFilterId === sf.id;
                const canDelete = sf.createdById === session?.user?.id;
                return (
                  <span
                    key={sf.id}
                    className="inline-flex h-11 shrink-0 items-center overflow-hidden rounded-full text-[13px] font-medium"
                    style={{
                      backgroundColor: active ? "var(--ink)" : "var(--card)",
                      color: active ? "var(--paper)" : "var(--ink-soft)",
                      border: active ? "none" : "1px solid var(--line)",
                    }}
                  >
                    <button onClick={() => selectSavedFilter(sf.id)} className="h-full pl-3 pr-1.5" title={sf.shared ? "Shared with the team" : "Only visible to you"}>
                      {sf.name}
                    </button>
                    {canDelete && (
                      <button onClick={() => deleteSavedFilter(sf.id)} className="h-full pl-0.5 pr-2.5 opacity-60 hover:opacity-100" aria-label={`Delete ${sf.name}`} title="Delete this view">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </span>
                );
              })}
              <button
                onClick={() => setShowBuilder(true)}
                className="inline-flex h-11 shrink-0 items-center gap-1 rounded-full border border-dashed border-line px-3.5 text-[13px] font-medium text-ink-soft"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                Custom filter
              </button>
            </motion.div>
          </>
        )}

        {filtered.length > 0 && (
          <ul className="-mx-2 mt-3 rounded-[16px] border border-line bg-card px-3 py-1 sm:mx-0">{filtered.map((l, i) => rowFor(l, show, i === 0))}</ul>
        )}
        {filtered.length === 0 && leads.length > 0 && (
          <p className="py-8 text-center text-[14px] text-ink-soft">
            {query.trim() || (show === "all" && (filter !== "all" || activeSavedFilter || customCriteria)) ? (
              <>
                Nobody matches that.{" "}
                <button
                  onClick={() => {
                    setQuery("");
                    selectQuickFilter("all");
                  }}
                  className="underline underline-offset-2"
                >
                  Show everyone here
                </button>
              </>
            ) : (
              "Nobody here right now."
            )}
          </p>
        )}
      </div>
    );
  }

  // ---- Everyone, as one list (A-267; were groups with counts, A-220). ----
  // Reply ready first (in Today's order), then ready to book, then everyone else, newest message first.
  const firstIds = [...groups.needs, ...groups.ready.filter((id) => !groups.needs.includes(id))];
  const rest = inGroup.filter((l) => !firstIds.includes(l.id));
  const everyone = [...firstIds.map((id) => byId.get(id)).filter((l): l is Lead => Boolean(l)), ...rest];
  const listed = everyone.slice(0, LIST_MAX);

  return (
    <div className="max-w-[720px]">
      {/* The title and one + button (A-267), then search, then everyone. */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <ScrollTitle title="Customers" />
          <h1 className="title-serif text-[28px] leading-tight">Customers</h1>
        </div>
        <LeadsMoreMenu onAdd={() => setShowAddLead(true)} onLogCall={() => setShowLogCall(true)} onImport={() => setShowImport(true)} />
      </div>
      {forms}
      {leads.length > 0 && searchBox}

      {leads.length > 0 &&
        (query.trim() ? (
          // Searching looks through everyone, as one list.
          <>
            <p className="mt-4 px-1 text-[12.5px] text-ink-faint">
              {filtered.length} {filtered.length === 1 ? "customer" : "customers"} found
            </p>
            {filtered.length > 0 && <ul className="mt-1">{filtered.map((l, i) => rowFor(l, null, i === 0))}</ul>}
          </>
        ) : (
          <>
            <ul aria-label="Everyone" className="mt-2">
              {listed.map((l, i) => rowFor(l, null, i === 0))}
            </ul>
            {everyone.length > listed.length && (
              <Link href="/leads?show=all" className="mt-1 flex min-h-11 items-center text-[13.5px] text-ink-soft underline underline-offset-[3px]">
                Show everyone ({everyone.length})
              </Link>
            )}
          </>
        ))}

      {leads.length === 0 && (
        <EmptyState
          icon={Inbox}
          title="No customers yet"
          /* Named one source out of eight until 2026-09-22. A business
             running on Instagram DMs, WhatsApp or a website form opened
             this screen and was told to connect an inbox it does not use. */
          description="Connect where your customers write to you in Settings — your inbox, website form, DMs or CRM — or add one by hand."
          action={
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setShowAddLead(true)}
                className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium"
                style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
              >
                Add a customer
              </button>
              <Link href="/settings" className="inline-flex items-center rounded-lg border border-line px-4 py-2 text-sm font-medium">
                Go to Settings
              </Link>
            </div>
          }
        />
      )}
    </div>
  );
}
