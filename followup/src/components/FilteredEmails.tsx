"use client";

import { useEffect, useState } from "react";
import { Check, EyeOff } from "lucide-react";

type FilteredEmail = {
  id: string;
  senderName: string;
  senderEmail: string;
  subject: string | null;
  reason: string;
  lastMessageAt: string;
};

/**
 * "Filtered out as not leads" — what the AI inbox classifier decided NOT
 * to turn into a lead, and why, with a one-click override. Sits under
 * Gmail in Settings. The point is trust: an owner can see every judgment
 * call the AI made on their inbox, not just the ones it got right.
 */
export default function FilteredEmails() {
  const [items, setItems] = useState<FilteredEmail[] | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restored, setRestored] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/integrations/gmail/filtered")
      .then((r) => r.json())
      .then((data: { success: boolean; filtered?: FilteredEmail[] }) => setItems(data.success ? (data.filtered ?? []) : []))
      .catch(() => setItems([]));
  }, []);

  async function restore(item: FilteredEmail) {
    setRestoring(item.id);
    setError(null);
    try {
      const res = await fetch(`/api/integrations/gmail/filtered/${item.id}/restore`, { method: "POST" });
      const data: { success: boolean; leadId?: string; message?: string } = await res.json();
      if (data.success && data.leadId) {
        setRestored((r) => ({ ...r, [item.id]: data.leadId! }));
      } else {
        setError(data.message ?? "Couldn't import that email.");
      }
    } catch {
      setError("Couldn't import that email.");
    } finally {
      setRestoring(null);
    }
  }

  if (items === null) return null;

  return (
    <div className="mt-3 pt-3 border-t border-line">
      <p className="text-xs font-medium flex items-center gap-1.5">
        <EyeOff className="h-3.5 w-3.5" /> Filtered out as not leads
      </p>
      <p className="text-xs text-ink-soft mt-1">
        Emails the AI decided weren&apos;t sales inquiries — personal mail, recruiters, vendors, notifications.
        Every call it made is listed here with its reason. If it got one wrong, one click makes it a lead.
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-ink-soft mt-2">Nothing filtered out recently.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map((item) => (
            <li key={item.id} className="text-xs rounded-lg border border-line bg-paper px-2.5 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-medium">{item.senderName || item.senderEmail}</span>
                  <span className="text-ink-soft"> · {item.senderEmail}</span>
                  {item.subject && <div className="truncate">{item.subject}</div>}
                  <div className="text-ink-soft mt-0.5">{item.reason}</div>
                  <div className="text-ink-soft mt-0.5">{new Date(item.lastMessageAt).toLocaleString()}</div>
                </div>
                {restored[item.id] ? (
                  <a href={`/leads/${restored[item.id]}`} className="shrink-0 inline-flex items-center gap-1 text-xs font-medium underline" style={{ color: "var(--sage)" }}>
                    <Check className="h-3 w-3" /> Now a lead
                  </a>
                ) : (
                  <button
                    onClick={() => restore(item)}
                    disabled={restoring === item.id}
                    className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium border border-line disabled:opacity-60"
                  >
                    {restoring === item.id ? "Importing…" : "This was a lead"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs mt-2" style={{ color: "var(--gold)" }}>{error}</p>}
    </div>
  );
}
