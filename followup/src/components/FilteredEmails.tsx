"use client";

import { useEffect, useState } from "react";
import { Check, EyeOff } from "lucide-react";

type FilteredEmail = {
  id: string;
  provider: string;
  senderName: string;
  senderEmail: string | null;
  senderPhone: string | null;
  subject: string | null;
  reason: string;
  lastMessageAt: string;
};

/** Which page the list sits on: Email (Gmail, Outlook) or the chat apps (Instagram, Messenger, WhatsApp). */
type Channels = "email" | "chats";
const PROVIDERS: Record<Channels, readonly string[]> = {
  email: ["gmail", "outlook"],
  chats: ["instagram", "messenger", "whatsapp"],
};

/** The rows that belong on this page. */
export function rowsFor<T extends { provider: string }>(channels: Channels, rows: readonly T[]): T[] {
  return rows.filter((r) => PROVIDERS[channels].includes(r.provider));
}

/**
 * "Filtered out": what FollowUp decided NOT to treat as a customer, and
 * why, with a one-click override. The point is trust: an owner can see
 * every judgment call made on their messages, not just the right ones.
 *
 * One list per page, for the apps on that page. It lived only under Email
 * until 2026-10-12, so an owner who connected only Instagram or WhatsApp
 * could never see, or bring back, a chat that was set aside.
 */
export default function FilteredEmails({ channels = "email" }: { channels?: Channels }) {
  const [items, setItems] = useState<FilteredEmail[] | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restored, setRestored] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/integrations/gmail/filtered")
      .then((r) => r.json())
      .then((data: { success: boolean; filtered?: FilteredEmail[] }) =>
        setItems(data.success ? rowsFor(channels, data.filtered ?? []) : [])
      )
      .catch(() => setItems([]));
  }, [channels]);

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
  // The chat apps' page has no "connected" state to lean on, so an empty
  // list there says nothing rather than a line about apps that may not be set up.
  if (channels === "chats" && items.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-line">
      <p className="text-[13px] font-medium flex items-center gap-1.5">
        <EyeOff className="h-3.5 w-3.5" /> Filtered out
      </p>
      <p className="text-[13px] text-ink-soft mt-1">
        {channels === "chats"
          ? "Chats FollowUp decided weren’t from customers: friends, family, jokes, people selling to you. Each one says why. If it got one wrong, bring it back and every message comes with it."
          : "Emails FollowUp decided weren’t from customers: personal mail, recruiters, suppliers, notifications. Each one says why. If it got one wrong, one tap makes it a customer."}
      </p>
      {items.length === 0 ? (
        <p className="text-[13px] text-ink-soft mt-2">Nothing filtered out recently.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map((item) => (
            <li key={item.id} className="text-[13px] rounded-[12px] border border-line bg-paper px-2.5 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 wrap-break-word">
                  {/* A WhatsApp row has a number where a mailbox row has
                      an address; one of the two is always set, decided by
                      provider. Named rather than left blank so a person
                      reading this list knows which app to go and look in. */}
                  <span className="font-medium">{item.senderName || item.senderEmail || item.senderPhone}</span>
                  {/* A DM row's "phone" is an internal id (ig:…), never shown. */}
                  {item.provider !== "instagram" && item.provider !== "messenger" && (
                    <span className="text-ink-soft"> · {item.senderEmail ?? item.senderPhone}</span>
                  )}
                  {item.provider === "outlook" && <span className="text-ink-soft"> · Outlook</span>}
                  {item.provider === "whatsapp" && <span className="text-ink-soft"> · WhatsApp</span>}
                  {item.provider === "instagram" && <span className="text-ink-soft"> · Instagram</span>}
                  {item.provider === "messenger" && <span className="text-ink-soft"> · Messenger</span>}
                  {item.subject && <div className="truncate">{item.subject}</div>}
                  <div className="text-ink-soft mt-0.5">{item.reason}</div>
                  <div className="text-ink-soft mt-0.5">
                    {new Date(item.lastMessageAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </div>
                </div>
                {restored[item.id] ? (
                  <a href={`/leads/${restored[item.id]}`} className="shrink-0 inline-flex items-center gap-1 text-[13px] font-medium underline" style={{ color: "var(--sage)" }}>
                    <Check className="h-3 w-3" /> Now a customer
                  </a>
                ) : (
                  <button
                    onClick={() => restore(item)}
                    disabled={restoring === item.id}
                    className="shrink-0 rounded-full px-2.5 py-1 text-[13px] font-medium border border-line disabled:opacity-60"
                  >
                    {restoring === item.id ? "Bringing back…" : "This is a customer"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-[13px] mt-2" style={{ color: "var(--coral)" }}>{error}</p>}
    </div>
  );
}
