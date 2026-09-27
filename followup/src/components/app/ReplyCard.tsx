"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MOTION, OPEN_IN_PLACE } from "@/lib/motion";
import { useRouter } from "next/navigation";
import { fillPriceSlot, hasPriceSlot, splitAtPriceSlot } from "@/lib/priceSlot";
import { Eyebrow } from "./canvasBits";

/**
 * The reply, as drawn on the canvas thread boards (Inbox, InboxAI,
 * ThreadPhone, TodayCalmPhone): a warm card under the conversation that
 * says what it is ("Reply ready · waits for your OK"), the words
 * themselves, and three actions: Send, Edit, Don't send.
 *
 * It sends through the same POST /api/leads/[id]/send the old composer
 * used, so nothing about sending changes. "Don't send" is the same
 * dismiss-hold the Today card uses. A "$ price" blank (A-060) is filled
 * in place, and Send waits for it.
 *
 * When nothing is waiting (no held draft), the card is a plain "Write a
 * reply" box with the same Send.
 */
export const WARM_CARD: React.CSSProperties = {
  background:
    "radial-gradient(70% 90% at 12% 10%, rgba(244,196,160,0.9), rgba(244,196,160,0) 70%)," +
    "radial-gradient(70% 90% at 92% 95%, rgba(196,210,228,0.95), rgba(196,210,228,0) 70%)," +
    "radial-gradient(50% 70% at 88% 0%, rgba(238,212,204,0.9), rgba(238,212,204,0) 72%), #f3efea",
  border: "1px solid rgba(10,10,10,0.06)",
};

type Rewrite = "shorter" | "warmer" | "formal" | "language";

export default function ReplyCard({
  leadId,
  leadName,
  leadEmail,
  draft,
  draftSubject,
  waiting,
  seenInboundAt,
  sendLocked = false,
  basis,
  languageName,
}: {
  leadId: string;
  leadName: string;
  leadEmail?: string;
  /** The written reply, or "" when nothing is drafted. */
  draft: string;
  draftSubject?: string;
  /** True when this reply is held for the owner's OK (it's in Today). */
  waiting: boolean;
  seenInboundAt?: string;
  sendLocked?: boolean;
  basis?: string | null;
  languageName?: string | null;
}) {
  const router = useRouter();
  const first = leadName.split(" ")[0] ?? leadName;
  const isEmail = Boolean(leadEmail);
  const [editing, setEditing] = useState(!draft);
  const [text, setText] = useState(draft);
  const [subject, setSubject] = useState(draftSubject ?? "");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState<null | "send" | "skip" | Rewrite>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { kind: "sent"; template: string | null } | { kind: "skipped" }>(null);
  const [edited, setEdited] = useState(false);

  const needsPrice = !editing && hasPriceSlot(text);
  const message = needsPrice ? fillPriceSlot(text, price.trim()) : text;
  const canSend = message.trim().length > 0 && !(needsPrice && !price.trim());

  async function send() {
    setBusy("send");
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, ...(isEmail && subject.trim() ? { subject: subject.trim() } : {}), ...(seenInboundAt ? { seenInboundAt } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(typeof data.message === "string" ? data.message : "Couldn't send. Try again.");
      setDone({ kind: "sent", template: typeof data.sentTemplate === "string" ? data.sentTemplate : null });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function skip() {
    setBusy("skip");
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/dismiss-hold`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(typeof data.message === "string" ? data.message : "Couldn't do that. Try again.");
      setDone({ kind: "skipped" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't do that. Try again.");
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
        body: JSON.stringify({ text: message, style }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(typeof data.message === "string" ? data.message : "Couldn't rewrite it.");
      setText(data.text);
      setEdited(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't rewrite it.");
    } finally {
      setBusy(null);
    }
  }

  if (done) {
    return (
      // The card folds into what happened (A-048), once, without fanfare.
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: MOTION.move, ease: MOTION.easeOut } }}
        className="rounded-[20px] border border-line bg-card p-5"
        role="status"
      >
        {done.kind === "skipped" ? (
          <p className="text-[15px]">Not sent. Nothing went to {first}.</p>
        ) : done.template ? (
          <>
            <p className="text-[15px] font-medium">Your words didn&apos;t go. WhatsApp wouldn&apos;t allow it.</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              WhatsApp only lets you write freely within 24 hours of {first}&apos;s last message. Your approved template
              went instead. Once {first} replies, you can write properly again.
            </p>
          </>
        ) : (
          <p className="text-[15px]">Sent to {first}, from your own address.</p>
        )}
      </motion.div>
    );
  }

  const label = waiting ? "Reply ready · waits for your OK" : draft ? "Reply ready" : "Write a reply";

  return (
    <div className="relative overflow-hidden rounded-[20px] p-5" style={WARM_CARD}>
      <Eyebrow>{label}</Eyebrow>

      <AnimatePresence initial={false} mode="wait">
      {editing ? (
        <motion.div key="edit" {...OPEN_IN_PLACE} className="mt-3 space-y-2">
          {isEmail && (
            <input
              id="reply-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject (optional)"
              aria-label="Subject"
              className="w-full rounded-xl border border-line bg-card/80 px-3 py-2 text-[15px] focus:outline-none"
            />
          )}
          <textarea
            id="reply-text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setEdited(true);
            }}
            rows={5}
            placeholder={`Write to ${first}…`}
            aria-label={`Your reply to ${first}`}
            className="w-full resize-y rounded-xl border border-line bg-card/80 p-3 text-base leading-relaxed focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-ink-soft">Rewrite it:</span>
            {(
              [
                ["shorter", "Shorter"],
                ["warmer", "Warmer"],
                ["formal", "More formal"],
                ...(languageName ? [["language", `In ${languageName}`]] : []),
              ] as [Rewrite, string][]
            ).map(([style, name]) => (
              <button
                key={style}
                type="button"
                onClick={() => rewrite(style)}
                disabled={busy !== null || !text.trim()}
                className="h-8 rounded-full border border-line bg-card/70 px-3 text-[13px] font-medium disabled:opacity-60"
              >
                {busy === style ? "Rewriting…" : name}
              </button>
            ))}
          </div>
        </motion.div>
      ) : (
        <p key="read" className="mt-2.5 whitespace-pre-wrap text-base leading-relaxed">
          {needsPrice
            ? splitAtPriceSlot(text).map((part, i) =>
                i === 0 ? (
                  <span key={i}>{part}</span>
                ) : (
                  <span key={i}>
                    {i === 1 ? (
                      <input
                        id="reply-price"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="$ price"
                        aria-label={`The price for ${first}`}
                        autoComplete="off"
                        className="mx-0.5 inline-block h-8 w-28 rounded-md border border-dashed bg-card px-2 align-baseline"
                        style={{ borderColor: price.trim() ? "var(--line)" : "var(--ink-soft)" }}
                      />
                    ) : (
                      <span>{price.trim() || "$ price"}</span>
                    )}
                    {part}
                  </span>
                )
              )
            : text}
        </p>
      )}
      </AnimatePresence>

      {needsPrice && <p className="mt-2 text-[13px] text-ink-soft">Add the price, then send. FollowUp never guesses one.</p>}
      {basis && !edited && !editing && <p className="mt-2 text-[13px] text-ink-soft">{basis}</p>}
      {error && (
        <p className="mt-2 text-[13px]" role="alert" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
      {sendLocked && <p className="mt-2 text-[13px] text-ink-soft">Only admins send on this account. An admin will see this reply waiting.</p>}

      <div className="mt-4 flex gap-2.5">
        {!sendLocked && (
          <button
            type="button"
            onClick={send}
            disabled={busy !== null || !canSend}
            className="h-[52px] flex-1 rounded-full text-base font-semibold disabled:opacity-60 sm:flex-none sm:px-8"
            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
          >
            {busy === "send" ? "Sending…" : "Send"}
          </button>
        )}
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={busy !== null}
            className="h-[52px] w-24 rounded-full border text-base font-medium"
            style={{ borderColor: "rgba(10,10,10,0.18)", background: "rgba(255,255,255,0.55)" }}
          >
            Edit
          </button>
        )}
        {waiting && (
          <button
            type="button"
            onClick={skip}
            disabled={busy !== null}
            className="h-[52px] px-3 text-sm text-ink-soft disabled:opacity-60"
          >
            {busy === "skip" ? "…" : "Don't send"}
          </button>
        )}
      </div>
    </div>
  );
}
