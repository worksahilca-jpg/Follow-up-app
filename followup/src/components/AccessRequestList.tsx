"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AccessRequestRow } from "@/lib/admin-data";

const CHANNEL_WORDS: Record<string, string> = {
  email: "Email",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  text: "Text",
  website: "Website",
  other: "Other",
};

/**
 * The founder's beta list: who asked, what they sell, where their customers
 * write, and one button. Approve lets that Google email sign in on the
 * next try (src/lib/auth.ts) — no env var, no redeploy.
 */
export default function AccessRequestList({ requests }: { requests: AccessRequestRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(id: string, status: "approved" | "declined" | "new") {
    setBusyId(id);
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
      setBusyId(null);
    }
  }

  if (requests.length === 0) {
    return (
      <div className="box p-5 text-sm text-ink-soft">Nobody has asked yet. Requests from followupbase.io/beta land here.</div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p className="text-sm" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
      {requests.map((r) => {
        const tone = r.status === "approved" ? "var(--sage)" : r.status === "declined" ? "var(--slate)" : "var(--gold)";
        const word = r.status === "approved" ? "Approved" : r.status === "declined" ? "Declined" : "Waiting";
        return (
          <div key={r.id} className="box relative py-3 pl-4 pr-3">
            <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] rounded-l-[var(--radius-box)]" style={{ backgroundColor: tone }} />
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {r.name} <span className="text-ink-soft font-normal">· {r.email}</span>
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  <span style={{ color: tone }}>{word}</span>
                  {r.business ? ` · ${r.business}` : ""}
                  {r.channels.length > 0 ? ` · ${r.channels.map((c) => CHANNEL_WORDS[c] ?? c).join(", ")}` : ""}
                  {` · ${r.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                </p>
                {r.note && <p className="mt-1 text-xs text-ink-soft whitespace-pre-wrap">{r.note}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                {r.status !== "approved" && (
                  <button
                    onClick={() => setStatus(r.id, "approved")}
                    disabled={busyId === r.id}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                    style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
                  >
                    Approve
                  </button>
                )}
                {r.status === "new" && (
                  <button
                    onClick={() => setStatus(r.id, "declined")}
                    disabled={busyId === r.id}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium border border-line hover:bg-paper disabled:opacity-60"
                  >
                    Decline
                  </button>
                )}
                {r.status !== "new" && (
                  <button
                    onClick={() => setStatus(r.id, "new")}
                    disabled={busyId === r.id}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-paper disabled:opacity-60"
                  >
                    Undo
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
