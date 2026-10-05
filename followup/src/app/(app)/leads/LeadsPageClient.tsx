"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Lead } from "@/lib/types";
import { daysSince } from "@/lib/demo-data";
import { matchesSavedFilter, type SavedFilterCriteria, type SavedFilterSummary } from "@/lib/savedFilterMatch";
import AddLeadForm from "@/components/AddLeadForm";
import ImportLeadsForm from "@/components/ImportLeadsForm";
import LogCallForm from "@/components/LogCallForm";
import SmartViewForm from "@/components/SmartViewForm";
import EmptyState from "@/components/EmptyState";
import CleanupLeadsButton from "@/components/CleanupLeadsButton";
import { motion } from "framer-motion";
import { MOTION } from "@/lib/motion";
import { Search, Plus, Upload, Phone, Inbox, SlidersHorizontal, X, MoreHorizontal } from "lucide-react";
import { Initials, restingState, shortAge, StatePill, type StateKey } from "@/components/app/canvasBits";
import { ChannelIcon, channelFromSource } from "@/components/app/ChannelIcon";

const CHANNEL_NAMES: Record<string, string> = {
  email: "Email",
  text: "Text",
  call: "Phone",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  messenger: "Messenger",
  web: "Website form",
};

/**
 * The rail tone, and the word that tone stands for, for one lead.
 *
 * Same 3/7-day scale src/lib/urgency.ts has always used — it just returns a
 * token name here instead of a colour, because ItemBox will not accept a bare
 * colour. The word is the point: the rail used to be the *only* thing on the
 * row explaining itself, and on a phone it was the only thing that survived at
 * all. Now the colour and "Silent 9 days" always travel together.
 */
/** A row's state pill when it isn't in one of the three places (A-029's greys). */
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
        aria-label="More"
        className="inline-flex h-10 w-10 items-center justify-center gap-1.5 rounded-full border border-line bg-card text-sm font-medium sm:h-auto sm:w-auto sm:rounded-lg sm:bg-transparent sm:px-3.5 sm:py-2"
      >
        <MoreHorizontal className="h-4 w-4" />
        <span className="hidden sm:inline">More</span>
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

type Place = "all" | "needs" | "quiet" | "waiting";
const PLACE_LABEL: Record<Exclude<Place, "all">, string> = { needs: "Needs you", quiet: "Going quiet", waiting: "Waiting" };

export default function LeadsPageClient({
  leads,
  places,
  openId = null,
}: {
  leads: Lead[];
  /** The customer open beside the list (?p=), if any (A-025). */
  openId?: string | null;
  /** The canvas's places, worked out on the server from the same sources Today uses. */
  places: { needs: string[]; quiet: string[]; waiting: string[] };
}) {
  const { data: session } = useSession();
  const [filter, setFilter] = useState<FilterId>("all");
  const [place, setPlace] = useState<Place>("all");
  const [showFilters, setShowFilters] = useState(false);
  const placeOf = useMemo(() => {
    const m = new Map<string, Exclude<Place, "all">>();
    for (const id of places.waiting) m.set(id, "waiting");
    for (const id of places.quiet) m.set(id, "quiet");
    for (const id of places.needs) m.set(id, "needs");
    return m;
  }, [places]);
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

    if (place !== "all") list = list.filter((l) => placeOf.get(l.id) === place);

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (l) => l.name.toLowerCase().includes(q) || l.company.toLowerCase().includes(q)
      );
    }

    // "Sorted by who needs you first" (canvas): needs you, going quiet,
    // waiting by score, then everyone else newest message first, the order
    // the Inbox had before it folded in here (A-082).
    const rank = (id: string) => ({ needs: 0, quiet: 1, waiting: 2 })[placeOf.get(id) ?? "x" as never] ?? 3;
    const lastAt = (l: (typeof list)[number]) => {
      const m = l.conversation[l.conversation.length - 1];
      return m ? new Date(m.date).getTime() : 0;
    };
    return list.sort((a, b) => rank(a.id) - rank(b.id) || (rank(a.id) === 3 ? lastAt(b) - lastAt(a) : b.score - a.score));
  }, [leads, filter, place, placeOf, query, session?.user?.id, activeSavedFilter, customCriteria]);

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
      {/* People first on a phone (A-089): the title and two small round
          buttons on one row, then search, then the list. The two full-width
          buttons that used to stack here pushed the people off the first
          screen. On the desk the header is as it was: More, then the one
          black "Add customer". */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[32px] leading-[1.1]">Customers</h1>
          <p className="text-ink-soft mt-1">{`${leads.length} ${leads.length === 1 ? "customer" : "customers"}.`}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:whitespace-nowrap">
          <LeadsMoreMenu onLogCall={() => setShowLogCall(true)} onImport={() => setShowImport(true)} />
          <button
            onClick={() => setShowAddLead(true)}
            aria-label="Add customer"
            className="inline-flex h-10 w-10 items-center justify-center gap-1.5 rounded-full border border-line bg-card text-sm font-medium text-ink sm:h-auto sm:w-auto sm:rounded-lg sm:border-0 sm:bg-ink sm:px-3.5 sm:py-2 sm:text-paper"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add customer</span>
          </button>
        </div>
      </div>

      {/* Search on top on a phone (A-089): finding one person is half this
          screen's job, and the desk's search lives in the sidebar. */}
      <div className="relative mt-4 sm:hidden">
        <Search className="h-4 w-4 absolute left-3 top-3 text-ink-soft" />
        <input
          id="customers-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search customers…"
          aria-label="Search customers"
          className="h-10 w-full rounded-full border border-line bg-card pl-9 pr-3 text-[15px]"
        />
      </div>

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

      {/* The canvas's four places, with counts, as underlined tabs. */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Which customers" className="flex gap-5 overflow-x-auto border-b border-line-2">
          {(["all", "needs", "quiet", "waiting"] as Place[]).map((p) => {
            const count = p === "all" ? leads.length : places[p].length;
            const on = place === p;
            return (
              <button
                key={p}
                role="tab"
                aria-selected={on}
                onClick={() => setPlace(p)}
                className="-mb-px shrink-0 whitespace-nowrap border-b-2 pb-2.5 text-sm"
                style={{ borderColor: on ? "var(--ink)" : "transparent", color: on ? "var(--ink)" : "var(--ink-soft)", fontWeight: on ? 500 : 400 }}
              >
                {p === "all" ? "All" : PLACE_LABEL[p]} <span className="tabular-nums text-ink-faint">{count}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3.5 text-sm font-medium"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filter
          {(filter !== "all" || activeSavedFilter || customCriteria) && (
            <span className="text-ink-faint">· {activeSavedFilter?.name ?? (customCriteria ? "Custom" : activeFilterLabel)}</span>
          )}
        </button>
      </div>

      {/* Opens under the Filter button and folds back into it (A-048).
          Kept mounted, so the filters keep their state while closed. */}
      <motion.div
        initial={false}
        animate={
          showFilters
            ? { opacity: 1, y: 0, display: "flex", transition: { duration: MOTION.move, ease: MOTION.easeOut } }
            : { opacity: 0, y: -4, transition: { duration: MOTION.exit, ease: MOTION.easeIn }, transitionEnd: { display: "none" } }
        }
        style={{ display: "none" }}
        aria-hidden={!showFilters}
        className="mt-4 flex-col sm:flex-row gap-3 sm:items-center sm:justify-between"
      >
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
        <div className="relative hidden sm:block">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-ink-soft" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers…"
            className="pl-9 pr-3 py-2 rounded-lg border border-line bg-card text-sm w-full sm:w-56"
          />
        </div>
      </motion.div>

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
      <div className="mt-6">
        {/* The canvas People table (App board): who, where, what they last
            said, how long, and the state in words. */}
        {filtered.length > 0 && (
          <div className="overflow-hidden rounded-[18px] border border-line bg-card">
            {/* Open beside a customer, the columns tighten but stay, as the
                App board keeps them. */}
            <div
              className={
                "hidden gap-4 px-5 py-3 text-[12.5px] font-medium text-ink-faint md:grid " +
                (openId ? "md:grid-cols-[32px_140px_104px_minmax(0,1fr)_44px_118px] md:gap-3 md:px-4" : "md:grid-cols-[44px_200px_130px_minmax(0,1fr)_90px_150px]")
              }
            >
              <span />
              <span>Name</span>
              <span>Channel</span>
              <span>Last message</span>
              <span>Waiting</span>
              <span>State</span>
            </div>
            {filtered.map((lead) => {
              const last = lead.conversation[lead.conversation.length - 1];
              const where = placeOf.get(lead.id);
              const pill = where ? { state: where as StateKey, label: PLACE_LABEL[where] } : restingState(lead);
              const selected = lead.id === openId;
              return (
                <Link
                  key={lead.id}
                  // Opens beside the list (A-025); the full page is one click from there.
                  href={`/leads?p=${lead.id}`}
                  scroll={false}
                  aria-current={selected ? "true" : undefined}
                  className={
                    "grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 border-t border-line-2 px-4 py-3.5 first:border-t-0 hover:bg-paper md:gap-4 md:px-5 md:first:border-t md:first:border-line-2 " +
                    (openId
                      ? "md:grid-cols-[32px_140px_104px_minmax(0,1fr)_44px_118px] md:gap-3 md:px-4"
                      : "md:grid-cols-[44px_200px_130px_minmax(0,1fr)_90px_150px]")
                  }
                  style={selected ? { background: "var(--card-2)", boxShadow: "inset 2px 0 0 var(--ink)" } : undefined}
                >
                  <Initials name={lead.name} size={32} />
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-medium">{lead.name}</span>
                    <span className="block truncate text-[13px] text-ink-faint md:hidden">
                      {last ? (last.direction === "outbound" ? `You: ${last.body}` : last.body) : lead.company || lead.source}
                    </span>
                  </span>
                  <span className="hidden min-w-0 items-center gap-2 text-[13.5px] text-ink-soft md:flex">
                    <ChannelIcon channel={last?.channel ?? channelFromSource(lead.source)} />
                    <span className="truncate">{CHANNEL_NAMES[last?.channel ?? ""] ?? lead.source}</span>
                  </span>
                  <span className="hidden truncate text-[13.5px] text-ink-soft md:block">
                    {last ? (last.direction === "outbound" ? `You: ${last.body}` : last.body) : "—"}
                  </span>
                  <span className="hidden text-[13px] text-ink-faint tabular-nums md:block">{last ? shortAge(last.date) : "—"}</span>
                  {/* A label only where it says something new (A-089): under the
                      "Needs you" tab, "Needs you" on every row repeats the tab. */}
                  <span className="justify-self-end md:justify-self-start">
                    {!(place !== "all" && where === place) && <StatePill state={pill.state} label={pill.label} />}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
        {filtered.length > 0 && (
          <p className="mt-3 text-[13px] text-ink-faint">
            {filtered.length} of {leads.length} {leads.length === 1 ? "customer" : "customers"} · sorted by who needs you first
          </p>
        )}

        {filtered.length === 0 && leads.length > 0 && (
          <p className="py-8 text-center text-sm text-ink-soft">
            No customers match <span className="text-ink font-medium">{activeFilterLabel}</span>.{" "}
            <button
              onClick={() => selectQuickFilter("all")}
              className="underline underline-offset-2"
              style={{ color: "var(--accent)" }}
            >
              Show all customers
            </button>
          </p>
        )}
        {leads.length === 0 && (
          <EmptyState
            icon={Inbox}
            title="No customers yet"
            /* Named one source out of eight until 2026-09-22. A business
               running on Instagram DMs, WhatsApp or a website form opened
               this screen and was told to connect an inbox it does not use
               — the same dead end the founder had already called out in
               onboarding ("we will help them to connect the sources"), on
               a screen nobody went back and checked. */
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
