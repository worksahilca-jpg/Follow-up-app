"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp } from "lucide-react";
import { useUndoableSend } from "@/components/useUndoableSend";
import UndoLine from "@/components/UndoLine";

type Rewrite = "shorter" | "warmer" | "formal" | "language";

/**
 * One reply box, pinned at the bottom of a customer's page (A-220, the
 * Claude idea): type, press the arrow, and it goes, with the same ten
 * seconds to take it back as every other send (A-048). Shown only when no
 * reply is waiting; a waiting reply keeps its own card, where it can be
 * read before it goes.
 *
 * The tools the old box had stay, one tap away and only when they apply:
 * "Write one for me" on an empty box, the rewrites once there is text.
 */
export default function ReplyBar({
  leadId,
  leadName,
  seenInboundAt,
  sendLocked = false,
  languageName = null,
}: {
  leadId: string;
  leadName: string;
  /** The newest message from them on this page: the server refuses a send if they have written since. */
  seenInboundAt?: string;
  /** Only admins send, and this person isn't one (A-041). */
  sendLocked?: boolean;
  languageName?: string | null;
}) {
  const router = useRouter();
  const first = leadName.split(" ")[0] || leadName;
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState<null | "fresh" | Rewrite>(null);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);

  // Grows with what is typed, up to about six lines, then scrolls.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const send = useUndoableSend({
    url: `/api/leads/${leadId}/send`,
    body: JSON.stringify({ message: text, ...(seenInboundAt ? { seenInboundAt } : {}) }),
    onResponse: async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(typeof data.message === "string" ? data.message : "Couldn't send. Try again.");
        return;
      }
      setText("");
      setSentTo(true);
      router.refresh();
    },
    onNetworkError: () => setError("Couldn't reach FollowUp. Check your connection and try again."),
  });

  async function writeFresh() {
    setBusy("fresh");
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/regenerate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || typeof data.message !== "string") throw new Error(typeof data.message === "string" && !res.ok ? data.message : "Couldn't write one. Try again.");
      setText(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't write one. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function rewrite(style: Rewrite) {
    setBusy(style);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, style }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(typeof data.message === "string" ? data.message : "Couldn't rewrite it.");
      setText(data.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't rewrite it.");
    } finally {
      setBusy(null);
    }
  }

  const tools: [Rewrite | "fresh", string][] = text.trim()
    ? [["shorter", "Shorter"], ["warmer", "Warmer"], ["formal", "More formal"], ...(languageName ? ([["language", `In ${languageName}`]] as [Rewrite, string][]) : [])]
    : [["fresh", "Write one for me"]];

  return (
    // At the foot of the phone's screen, as in a chat app (A-222: this page has no tabs); in the page's own column on a computer.
    // A soft fade of the page colour behind it on a phone, so the page's own words don't show through between the buttons.
    <div className="fixed inset-x-0 bottom-0 z-20 bg-[linear-gradient(to_top,var(--paper)_75%,transparent)] px-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] pt-5 lg:sticky lg:inset-x-auto lg:bottom-4 lg:mt-6 lg:bg-none lg:p-0">
      {error && (
        <p role="alert" className="mb-1.5 rounded-[12px] bg-card px-3 py-2 text-[13px] shadow-sm" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
      {sendLocked ? (
        <p className="rounded-full border border-line bg-card px-4 py-3 text-[13.5px] text-ink-soft shadow-[0_6px_24px_rgba(10,10,10,0.06)]">
          Only admins send on this account.
        </p>
      ) : send.pending ? (
        // The ten seconds (A-048): the only thing to press is the one that stops it.
        <div className="rounded-[20px] border border-line bg-card px-4 py-2.5 shadow-[0_6px_24px_rgba(10,10,10,0.06)]" role="status">
          <div className="flex items-center gap-3">
            <p className="flex-1 text-[14px]">
              Sending to {first} in {send.secs}s
            </p>
            <button type="button" onClick={send.undo} className="h-11 rounded-full border border-line px-4 text-[14px] font-medium">
              Undo
            </button>
          </div>
          {send.endsAt !== null && <UndoLine endsAt={send.endsAt} />}
        </div>
      ) : (
        <>
          {(focused || text.trim()) && (
            <div className="mb-1.5 flex gap-1.5 overflow-x-auto">
              {tools.map(([key, name]) => (
                <button
                  key={key}
                  type="button"
                  // Pressed before the box loses focus, so the row doesn't vanish under the finger.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => (key === "fresh" ? writeFresh() : rewrite(key))}
                  disabled={busy !== null}
                  className="relative h-9 shrink-0 rounded-full border border-line bg-card px-3 text-[13px] font-medium shadow-sm disabled:opacity-60 before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']"
                >
                  {busy === key ? (key === "fresh" ? "Writing…" : "Rewriting…") : name}
                </button>
              ))}
            </div>
          )}
          {/* The box's edge shows focus (2px ink), not an outline squared off inside the rounded box. */}
          <div className="flex items-end gap-2 rounded-[26px] border border-line bg-card py-1 pl-4 pr-1 shadow-[0_6px_24px_rgba(10,10,10,0.06)] focus-within:border-ink focus-within:shadow-[0_0_0_1px_var(--ink),0_6px_24px_rgba(10,10,10,0.06)]">
            <label htmlFor="reply-bar" className="sr-only">
              Reply to {first}
            </label>
            {/* 16px, so a phone doesn't zoom in when the box takes focus. */}
            <textarea
              id="reply-bar"
              ref={box}
              rows={1}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setSentTo(false);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={sentTo ? `Sent to ${first}. Write again…` : `Reply to ${first}…`}
              className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent py-2.5 text-base leading-snug"
              style={{ outline: "none" }}
            />
            <button
              type="button"
              onClick={() => {
                setError(null);
                send.start();
              }}
              disabled={!text.trim() || busy !== null || send.busy}
              aria-label={`Send to ${first}`}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full disabled:opacity-40"
              style={{ background: "var(--ink)", color: "var(--on-accent)" }}
            >
              <ArrowUp className="h-[19px] w-[19px]" strokeWidth={2.3} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
