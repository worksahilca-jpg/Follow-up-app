"use client";

import { useEffect, useState } from "react";

/**
 * "What FollowUp knows" (A-096), under the business's name and trade in
 * Settings → Your business. Everything FollowUp will say about the business
 * on its own, each with where it came from, so nothing it knows is hidden
 * (CLAUDE.md: what happened, why, what can I do). Learned from every reply
 * sent through FollowUp (src/lib/businessFacts.ts) or typed here.
 *
 * Drawn and approved 2026-10-06: one quiet list, an Edit link per row, one
 * "Add something" button, and a line of examples. Remove lives inside Edit,
 * so the list itself carries one action per row.
 */

type Fact = {
  id: string;
  label: string;
  value: string;
  source: "reply" | "owner";
  learnedFrom: string | null;
  updatedAt: string;
};

const LABEL_MAX = 40;
const VALUE_MAX = 200;

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function provenance(f: Fact) {
  if (f.source === "owner") return `You wrote this, ${shortDate(f.updatedAt)}`;
  return f.learnedFrom ? `Learned from your reply to ${f.learnedFrom}, ${shortDate(f.updatedAt)}` : `Learned from a reply, ${shortDate(f.updatedAt)}`;
}

export default function BusinessFactsSection() {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // The row being edited, "new" for the add form, or null.
  const [open, setOpen] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bumped after every change, which reads the list again.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    fetch("/api/business/facts")
      .then((r) => r.json())
      .then((data: { success?: boolean; facts?: Fact[]; isAdmin?: boolean }) => {
        if (!data.success) return;
        setFacts(data.facts ?? []);
        setIsAdmin(Boolean(data.isAdmin));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [version]);

  function start(f: Fact | null) {
    setOpen(f ? f.id : "new");
    setLabel(f?.label ?? "");
    setValue(f?.value ?? "");
    setError(null);
  }

  async function call(url: string, method: "POST" | "PATCH" | "DELETE", body?: object) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(typeof data.message === "string" ? data.message : "Couldn't save. Try again.");
      setOpen(null);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!label.trim() || !value.trim()) {
      setError("Fill in both: what it is, and what you tell customers.");
      return;
    }
    const body = { label: label.trim(), value: value.trim() };
    void (open === "new" ? call("/api/business/facts", "POST", body) : call(`/api/business/facts/${open}`, "PATCH", body));
  }

  if (!loaded) return null;

  const form = (
    <div className="space-y-3 py-4">
      <div>
        <label htmlFor="fact-label" className="mb-1.5 block text-[13px] font-medium">
          What it is
        </label>
        <input
          id="fact-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={LABEL_MAX}
          placeholder="e.g. Commission"
          autoFocus
          className="w-full rounded-[12px] border border-line bg-paper px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="fact-value" className="mb-1.5 block text-[13px] font-medium">
          What you tell customers
        </label>
        <textarea
          id="fact-value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={VALUE_MAX}
          rows={2}
          placeholder="e.g. 2.5%"
          className="w-full rounded-[12px] border border-line bg-paper px-3 py-2 text-sm leading-relaxed"
        />
      </div>
      {error && (
        <p className="text-[13px]" role="alert" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={save} disabled={busy} className="h-9 rounded-full bg-ink px-4 text-sm font-medium text-paper disabled:opacity-60">
          {busy ? "Saving…" : "Save"}
        </button>
        <button onClick={() => setOpen(null)} disabled={busy} className="h-9 rounded-full px-3 text-sm text-ink-soft">
          Cancel
        </button>
        {open !== "new" && (
          <button
            onClick={() => void call(`/api/business/facts/${open}`, "DELETE")}
            disabled={busy}
            className="ml-auto h-9 rounded-full px-3 text-sm"
            style={{ color: "var(--coral)" }}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="box p-5">
      <p className="text-sm font-medium">What FollowUp knows</p>
      <p className="mt-1 text-[13px] text-ink-soft">
        FollowUp uses these in replies, word for word. Anything that isn&apos;t here still waits for you, and it never
        makes up a price, a date or a promise.
      </p>

      {facts.length === 0 && open !== "new" && (
        <p className="mt-4 border-t border-line pt-4 text-[13.5px] text-ink">
          Nothing yet. FollowUp learns from the replies you send{isAdmin ? ", or you can add something now." : "."}
        </p>
      )}

      {facts.length > 0 && (
        <ul className="mt-4 border-t border-line">
          {facts.map((f) => (
            <li key={f.id} className="border-b border-line">
              {open === f.id ? (
                form
              ) : (
                <div className="flex items-start gap-3 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-ink-soft">{f.label}</p>
                    <p className="mt-0.5 break-words text-[15px] leading-snug">{f.value}</p>
                    <p className="mt-1 text-[12.5px] text-ink-soft">{provenance(f)}</p>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => start(f)}
                      className="-mr-2 h-9 shrink-0 px-2 text-[13px] underline underline-offset-2"
                      aria-label={`Edit ${f.label}`}
                    >
                      Edit
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {open === "new" && <div className={facts.length > 0 ? "" : "mt-4 border-t border-line"}>{form}</div>}

      {isAdmin && open !== "new" && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button onClick={() => start(null)} className="h-10 rounded-full border border-line px-4 text-sm font-medium">
            Add something
          </button>
          {/* The short question step (A-100): the things customers in this trade ask most. */}
          <a href="/teach" className="inline-flex h-10 items-center text-sm underline underline-offset-2">
            Answer a few questions
          </a>
        </div>
      )}
      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">
        For example: your services, the areas you cover, your hours, prices you&apos;re happy to share, your booking link,
        answers you give again and again.
      </p>
    </div>
  );
}
