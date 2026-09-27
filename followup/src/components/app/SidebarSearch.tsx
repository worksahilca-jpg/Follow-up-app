"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Initials } from "./canvasBits";

type Result = { id: string; name: string; detail: string | null };

/**
 * "Search customers" in the sidebar (canvas App board): type, and matching
 * customers appear right under the box. Enter or a click opens the
 * conversation. Up/Down move through the list, Escape closes it.
 */
export default function SidebarSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function go(r: Result) {
    setOpen(false);
    setQ("");
    setResults([]);
    router.push(`/leads/${r.id}`);
  }

  const shown = q.trim() ? results : [];

  return (
    <div ref={boxRef} className="relative mt-3">
      <label className="flex h-8 items-center gap-2 rounded-lg border border-line bg-card px-2.5 focus-within:border-[var(--line-strong)]">
        <Search className="h-3.5 w-3.5 shrink-0 text-ink-faint" strokeWidth={2} />
        <span className="sr-only">Search customers</span>
        <input
          id="sidebar-search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
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
          role="combobox"
          aria-expanded={open && shown.length > 0}
          aria-controls="sidebar-search-results"
          className="min-w-0 flex-1 bg-transparent text-[13.5px] placeholder:text-ink-faint focus:outline-none"
          style={{ outline: "none" }}
        />
      </label>
      {open && q.trim() && (
        <div
          id="sidebar-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-9 z-40 overflow-hidden rounded-xl border border-line bg-card p-1"
          style={{ boxShadow: "var(--shadow-box-lift)" }}
        >
          {shown.length === 0 ? (
            <p className="px-2.5 py-2 text-[13px] text-ink-faint">{loading ? "Searching…" : "No customer matches that."}</p>
          ) : (
            shown.map((r, i) => (
              <button
                key={r.id}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left"
                style={{ background: i === active ? "var(--card-2)" : "transparent" }}
              >
                <Initials name={r.name} size={24} />
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-medium">{r.name}</span>
                  {r.detail && <span className="block truncate text-[12px] text-ink-faint">{r.detail}</span>}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
