"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AccessRequestRow } from "@/lib/admin-data";

/**
 * The founder's tester list. He types an email, that Google account can
 * sign in on its next try (src/lib/auth.ts) — no env var, no redeploy.
 * There is no public way onto this list: the founder adds every email
 * himself (his decision, 2026-09-19).
 */
export default function AccessRequestList({ requests }: { requests: AccessRequestRow[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy("add");
    setError(null);
    try {
      const res = await fetch("/api/access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };
      if (!res.ok || !data.success) throw new Error(data.message || "Couldn't add that.");
      setEmail("");
      setName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that.");
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(id: string, status: "approved" | "declined") {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/access-request/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Couldn't save that.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={add} className="box p-4 flex flex-col sm:flex-row gap-2 sm:items-end">
        <label className="flex-1 min-w-0">
          <span className="block text-xs font-medium text-ink-soft mb-1">Google email</span>
          <input
            id="tester-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm"
            placeholder="owner@example.com"
          />
        </label>
        <label className="flex-1 min-w-0">
          <span className="block text-xs font-medium text-ink-soft mb-1">Name (optional)</span>
          <input
            id="tester-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm"
            placeholder="Priya, the salon"
          />
        </label>
        <button
          type="submit"
          disabled={busy === "add" || !email.trim()}
          className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 sm:shrink-0"
          style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
        >
          {busy === "add" ? "Adding…" : "Add tester"}
        </button>
      </form>
      {error && (
        <p className="text-sm" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
      {requests.length === 0 ? (
        <div className="box p-5 text-sm text-ink-soft">No testers added yet. Add an email above; they sign in with Google on their next try.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {requests.map((r) => {
            const on = r.status === "approved";
            const tone = on ? "var(--sage)" : "var(--slate)";
            return (
              <div key={r.id} className="box relative py-3 pl-4 pr-3">
                <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] rounded-l-[var(--radius-box)]" style={{ backgroundColor: tone }} />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {r.name} <span className="text-ink-soft font-normal">· {r.email}</span>
                    </p>
                    <p className="mt-1 text-xs text-ink-soft">
                      <span style={{ color: tone }}>{on ? "Can sign in" : "Removed"}</span>
                      {r.business ? ` · ${r.business}` : ""}
                      {` · added ${r.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                    </p>
                    {/* Where they actually are, in the order the doors come.
                        The first unmet one is the thing to chase. */}
                    {on && (
                      <p className="mt-1 text-xs text-ink-soft">
                        {!r.signedIn
                          ? "Not signed in yet"
                          : !r.inboxConnected
                            ? "Signed in · no inbox connected yet"
                            : r.leadCount === 0
                              ? "Signed in · inbox connected · no leads yet"
                              : `Signed in · inbox connected · ${r.leadCount} lead${r.leadCount === 1 ? "" : "s"}`}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setStatus(r.id, on ? "declined" : "approved")}
                    disabled={busy === r.id}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium border border-line hover:bg-paper disabled:opacity-60 shrink-0"
                  >
                    {on ? "Remove" : "Add back"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
