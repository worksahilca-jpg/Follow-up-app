"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import AppWindow from "./AppWindow";
import { Initials } from "./canvasBits";

type Result = { id: string; name: string; detail: string | null };

/**
 * "Search" in the sidebar: a row like every other row, which opens a small
 * window with the box and the matching customers (A-213 windows; founder
 * 2026-10-10: "simplify, copy Wispr if you want"). Ctrl+K or ⌘K opens it
 * from anywhere, as in most apps people already use. Enter or a click opens
 * the customer; Up/Down move through the list; Esc closes.
 */
export default function SidebarSearch({ className, style }: { className: string; style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} style={style}>
        <Search className="h-4 w-4" strokeWidth={1.8} />
        <span className="flex-1">Search</span>
      </button>
      {open && <SearchWindow onClose={() => setOpen(false)} />}
    </>
  );
}

function SearchWindow({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (!term) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/customers/search?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((d: { results?: Result[] }) => {
          setResults(d.results ?? []);
          setActive(0);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  function go(r: Result) {
    onClose();
    router.push(`/leads/${r.id}`);
  }

  const shown = q.trim() ? results : [];

  return (
    <AppWindow label="Search customers" size="small" onClose={onClose}>
      <div className="min-h-[300px] px-1 pb-1 lg:px-3 lg:pb-3 lg:pt-3">
        <label className="flex h-11 items-center gap-2.5 border-b border-line px-2 pr-10">
          <Search className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={2} />
          <span className="sr-only">Search customers</span>
          <input
            id="search-customers"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, shown.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              }
              if (e.key === "Enter" && shown[active]) go(shown[active]);
            }}
            placeholder="Search customers"
            autoComplete="off"
            autoFocus
            role="combobox"
            aria-expanded={shown.length > 0}
            aria-controls="search-customers-results"
            className="min-w-0 flex-1 bg-transparent text-[16px] placeholder:text-ink-faint focus:outline-none"
            style={{ outline: "none" }}
          />
        </label>
        <div id="search-customers-results" role="listbox" className="mt-2 grid gap-0.5">
          {!q.trim() ? (
            <p className="px-2 py-2 text-[13.5px] text-ink-faint">A name, an email or a phone number.</p>
          ) : shown.length === 0 ? (
            <p className="px-2 py-2 text-[13.5px] text-ink-faint">{loading ? "Searching…" : "No customer matches that."}</p>
          ) : (
            shown.map((r, i) => (
              <button
                key={r.id}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left"
                style={{ background: i === active ? "var(--card-2)" : "transparent" }}
              >
                <Initials name={r.name} size={26} />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium">{r.name}</span>
                  {r.detail && <span className="block truncate text-[12.5px] text-ink-faint">{r.detail}</span>}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </AppWindow>
  );
}
