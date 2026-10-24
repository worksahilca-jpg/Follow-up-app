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
import { Search, Plus, Upload, Phone, Inbox, SlidersHorizontal, X, ChevronLeft, MoreHorizontal } from "lucide-react";
import { Initials, shortAge } from "@/components/app/canvasBits";
import { TierTag } from "@/components/app/TodayDay";

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
function LeadsMoreMenu({ onAdd, onLogCall, onImport, wide = false }: { onAdd: () => void; onLogCall: () => void; onImport: () => void; /** On a computer (A-307): "Add a customer" is its own black button, the rest sit behind "More". */ wide?: boolean }) {
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
    <div className="relative flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      {wide && (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[14px] font-semibold"
          style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add a customer
        </button>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={wide ? "More: log a call, import, clean up" : "Add or import customers"}
        className={(wide ? "h-10 w-10" : "h-11 w-11") + " inline-flex items-center justify-center rounded-full border border-line bg-card text-ink"}
      >
        {wide ? <MoreHorizontal className="h-[18px] w-[18px]" /> : <Plus className="h-[18px] w-[18px]" />}
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
          className="absolute right-0 top-full z-20 mt-1 w-52 box p-1"
          style={{ boxShadow: "var(--shadow-box-hover)" }}
        >
          {!wide && (
            <button role="menuitem" className={item} onClick={() => { setOpen(false); onAdd(); }}>
              <Plus className="h-4 w-4 text-ink-soft" />
              Add a customer
            </button>
          )}
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
/** FollowUp's call (A-310): where each open customer stands, "Ready", "Warm", "Later", "Has an agent", by id. */
export type Tags = Record<string, string>;
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

/**
 * One customer, the way a phone's message list shows a chat (A-324): a face, the name, and one line of their last words
 * with how long ago. When the owner has something to do, the line says it in words, in bold (R-141: never a dot alone).
 * Ready to book keeps a Call button beside the row.
 */
function Row({ lead, href, line, time, selected, todo = false, isNew = false, call = false, tag = null }: { lead: Lead; href: string; line: string; time?: string | null; selected?: boolean; todo?: boolean; isNew?: boolean; call?: boolean; tag?: string | null }) {
  return (
    <li className={"flex min-w-0 items-center gap-3 rounded-[14px] px-4 lg:hover:bg-card-2" + (selected ? " bg-card-2" : "")}>
      {/* On a phone the row opens the customer's own page, sliding in (A-222, A-264); on a computer, the panel beside the list. */}
      <Link
        href={href}
        data-nav="push"
        data-phone-href={`/leads/${lead.id}`}
        scroll={false}
        aria-current={selected ? "true" : undefined}
        className="flex min-h-[76px] min-w-0 flex-1 items-center gap-3.5 py-2"
      >
        <Initials name={lead.name} size={56} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className={"truncate text-[16px] text-ink " + (todo || isNew ? "font-bold" : "font-medium")}>{lead.name}</span>
            {/* A customer's first day says "New"; after that, FollowUp's call (A-310) when there is one. */}
            {isNew ? <TierTag>New</TierTag> : tag && <TierTag>{tag}</TierTag>}
          </span>
          <span className={"mt-0.5 flex min-w-0 gap-1.5 text-[14.5px] " + (todo ? "font-semibold text-ink" : "text-ink-soft")}>
            <span className="truncate">{line.replace(/\s+/g, " ")}</span>
            {/* The time stays when the words are cut. */}
            {time && <span className="shrink-0 font-normal text-ink-faint tabular-nums">· {time}</span>}
          </span>
        </span>
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

export default function LeadsPageClient({
  leads,
  groups,
  fresh = [],
  lines,
  tags = {},
  show = null,
  stage = null,
  openId = null,
}: {
  leads: Lead[];
  /** Who is in which group, worked out on the server from the same sources Today uses. */
  groups: Groups;
  /** Customers who arrived in the last day: their row says "New" (A-324). */
  fresh?: string[];
  lines: GroupLines;
  tags?: Tags;
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
  const isNew = useMemo(() => new Set(fresh), [fresh]);
  const statusOf = (id: string): Status | null =>
    groups.needs.includes(id) ? "needs" : groups.ready.includes(id) ? "ready" : groups.booked.includes(id) ? "booked" : groups.quiet.includes(id) ? "quiet" : groups.waiting.includes(id) ? "waiting" : null;
  const rowFor = (lead: Lead, where: Show | null) => {
    const last = lastOf(lead);
    // The one list and search (A-324): where they stand, as a phone's message list would show it.
    const state = where ? null : statusOf(lead.id);
    const booked = state === "booked" && Boolean(lines[lead.id]);
    const call = where === "ready" || state === "ready";
    // What the owner has to do, in words (founder, 2026-10-24: "We should say what action needed", R-141).
    const todo = groups.needs.includes(lead.id) ? "Check and send your reply" : state === "ready" ? "Ready to book. Call them" : null;
    // What the line says (A-220): in a list behind a link, why they're there (why they're ready, when the booking is);
    // elsewhere what to do, when they're booked, or their last words.
    const line = where && where !== "all" && where !== "needs" ? (lines[lead.id] ?? said(lead)) : (todo ?? (booked ? `Booked · ${lines[lead.id]}` : said(lead)));
    const time = !booked && (where === "needs" || where === "all" || !where) && last ? shortAge(last.date) : null;
    // Where they stand (A-310), unless the row already says it: "Ready to book" is the same call in words.
    const tag = call ? null : (tags[lead.id] ?? null);
    return (
      <Row
        key={lead.id}
        lead={lead}
        href={rowHref(lead.id)}
        line={line}
        time={time}
        selected={lead.id === openId}
        todo={Boolean(todo) && line === todo}
        isNew={isNew.has(lead.id)}
        call={call}
        tag={tag}
      />
    );
  };

  const searchBox = (where = "mt-3") => (
    <div className={"relative " + where}>
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
          <h1 className="title-serif ios-title1">{TITLE[show]}</h1>
          <span className="text-[14px] font-semibold text-ink-soft tabular-nums">{inGroup.length}</span>
        </div>
        {SUB[show] && <p className="mt-0.5 text-[13px] text-ink-faint">{SUB[show]}</p>}
        {forms}
        {searchBox()}

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
          <ul className="-mx-4 mt-3">{filtered.map((l) => rowFor(l, show))}</ul>
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

  // ---- Everyone (A-324): one list like a phone's messages, newest message on top, no groups and no box. A new
  // customer is on top because they wrote last; a reply that's ready reads bold, like an unread chat. ----
  const listed = inGroup.slice(0, LIST_MAX);

  return (
    <div className="max-w-[720px]">
      {/* The title, one line, search and Add (A-307). On a computer search and "Add a customer" sit beside the title;
          on a phone the one + (A-267), then the line, then search across the width. */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <div className="mr-auto min-w-0">
          <ScrollTitle title="Customers" />
          <h1 className="title-serif ios-title1">Customers</h1>
        </div>
        <div className="order-2 lg:order-3">
          <div className="lg:hidden">
            <LeadsMoreMenu onAdd={() => setShowAddLead(true)} onLogCall={() => setShowLogCall(true)} onImport={() => setShowImport(true)} />
          </div>
          <div className="hidden lg:block">
            <LeadsMoreMenu wide onAdd={() => setShowAddLead(true)} onLogCall={() => setShowLogCall(true)} onImport={() => setShowImport(true)} />
          </div>
        </div>
        <p className="order-3 basis-full text-[15px] text-ink-soft lg:order-4">Newest message on top.</p>
        {leads.length > 0 && searchBox("order-4 mt-2.5 basis-full lg:order-2 lg:mt-0 lg:basis-[320px]")}
      </div>
      {forms}

      {leads.length > 0 &&
        (query.trim() ? (
          // Searching looks through everyone, as one group.
          <section className="mt-6">
            <p className="group-label mb-2 px-1">
              {filtered.length} {filtered.length === 1 ? "customer" : "customers"} found
            </p>
            {filtered.length > 0 && <ul className="-mx-4">{filtered.map((l) => rowFor(l, null))}</ul>}
          </section>
        ) : (
          <>
            <ul aria-label="Customers" className="-mx-4 mt-4">
              {listed.map((l) => rowFor(l, null))}
            </ul>
            {inGroup.length > listed.length && (
              <Link href="/leads?show=all" className="mt-2 flex min-h-11 items-center text-[13.5px] text-ink-soft underline underline-offset-[3px]">
                Show everyone ({inGroup.length})
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
