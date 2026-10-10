"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { WARM_CARD } from "@/components/app/ReplyCard";
import { oneQueue, summariseGroups, UNKNOWN_SOURCE_LABEL, WHOLE_QUEUE } from "@/lib/approvalGroups";
import { plainHoldReason } from "@/lib/holdReasons";
import { Eyebrow } from "@/components/app/canvasBits";
import { useUndoableSend } from "@/components/useUndoableSend";
import SiteReplyCard from "@/components/app/SiteReplyCard";
import type { PendingApproval } from "@/lib/pendingApprovals";
import SafePileAction from "@/components/SafePileAction";
import SafePilePeek from "@/components/SafePilePeek";
import UndoLine from "@/components/UndoLine";
import { AnimatePresence, motion } from "framer-motion";
import { MOTION, OPEN_IN_PLACE, RESULT_HOLD_MS } from "@/lib/motion";
import { fillPriceSlot, hasPriceSlot, slotOf, splitAtPriceSlot } from "@/lib/priceSlot";
import { RememberPrice } from "@/components/app/RememberPrice";
import MarkedText from "@/components/app/MarkedText";
import { dropKeptEdit, keepEdit, readKeptEdit } from "@/lib/keptEdit";

/**
 * "Needs your OK" — research/product/2026-09-10-ux-simplification.md
 * §0.6 and §8, implementation plan item #1. This is the missing screen
 * that answers "what needs my OK right now": every lead whose most
 * recent AI decision is a held draft (src/lib/pendingApprovals.ts), each
 * with the actual drafted reply inline and a one-click resolution —
 * Approve & send, Edit (in place, A-087), or Don't send.
 *
 * Reuses the same POST /api/leads/[id]/send that a human clicking
 * "Send now" in MessageComposer already uses — approving here IS sending
 * the exact drafted text, nothing new to trust.
 *
 * 2026-09-14 revisit (founder: dashboard reads as "weird" — layout,
 * density, this component, and color all flagged): the original
 * treatment wrapped this in a 2px --coral border under a --gold-soft
 * header band, with the lead's message and the draft each in their own
 * bordered box inside the card. Two things were wrong with that, not
 * just one:
 *   1. --coral/--gold read as an alarm — this is the routine, trusted,
 *      first thing an owner does every day, not an error state. It also
 *      quietly misused --gold outside "going cold," which A-005 already
 *      says it's reserved for ("gold... stays reserved for 'going cold'
 *      alone" — design-brain/decisions/approved.md).
 *   2. said-box-in-draft-box-in-2px-bordered-card is exactly the
 *      "card-in-card soup" design-brain/decisions/rejected.md calls out
 *      as S-09 — a symptom of unresolved hierarchy, not a design choice.
 * Fixed by matching the same calm, borderless-item list treatment every
 * other dashboard section already uses (divide-y rows, no nested boxes,
 * no status-color border) — the queue earns attention by sitting first
 * on the page and by what it says, not by looking like a warning.
 */

/**
 * A row of the approval queue, unchanged.
 *
 * This was a hand-written subset of PendingApproval, re-mapped field by
 * field on the dashboard. That mapping silently dropped `draftRiskLevel`
 * the moment grouping needed it — and since the safe pile is built from
 * that field, every draft would have landed in "needs you" and the
 * one-click pile would have been permanently empty, with no error
 * anywhere. An alias cannot drop a field.
 */
/** A waiting reply, plus "Based on …" (A-043) when there is something to point at. */
export type ApprovalItem = PendingApproval & {
  basis?: string | null;
  /** Numbers, prices and days in the draft nobody wrote (research round 2, #1): underlined in place. */
  checkWords?: string[];
  /** "Waiting 5 h" / "Quiet 6 days" (A-046), worked out on the server. */
  wait?: string | null;
  /** The same fact for the "Start with" line: "who has waited 5 hours". */
  waitClause?: string | null;
  /** When the customer was told the owner is on it, in the business's time (A-060). */
  toldAt?: string | null;
  /** Facts for the "About" panel beside them on the desk (A-212), worked out on the server. */
  about?: { cameFrom: string | null; firstWrote: string | null; language: string | null } | null;
};

const CHANNEL_NAME: Record<string, string> = {
  email: "Email",
  call: "Phone",
  text: "Text",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  messenger: "Messenger",
  web: "Website form",
  lead_form: "Facebook lead form",
};

const CHANNEL_LABEL: Record<string, string> = {
  email: "email",
  call: "a call",
  text: "text",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  messenger: "Messenger",
  web: "your website form",
  lead_form: "your Facebook lead form",
};

function ApprovalCard({
  item,
  onResolved,
  sendLocked = false,
  laterToday = true,
  onSetAside,
}: {
  item: ApprovalItem;
  /** Done with this card. `result` is what happened, said for a moment before it leaves (A-048). */
  onResolved: (leadId: string, result: string | null, sent?: boolean) => void;
  /** Only admins send, and this person isn't one (A-041). */
  sendLocked?: boolean;
  /** Whether "Later today" (2pm) is still ahead in the owner's day (A-046). */
  laterToday?: boolean;
  /** Set aside with Later (or back with Undo), so the list can drop or restore the row. */
  onSetAside?: (leadId: string, until: string | null) => void;
}) {
  const [busy, setBusy] = useState<"send" | "dismiss" | "talked" | "later" | null>(null);
  const firstName = item.leadName.split(" ")[0] || item.leadName;
  // "Later" (A-046): set aside until a time, back by itself or as soon as
  // the customer writes. Not "handled", so it never counts toward the day.
  const [laterOpen, setLaterOpen] = useState(false);
  const [laterUntil, setLaterUntil] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The price blank (A-060): a price question's reply is written with a
  // gap for the figure. Send stays off until it is filled, and the server
  // refuses the blank anyway (src/lib/priceSlot.ts).
  // Edit in place (A-087): the reply becomes a box inside the same card, so
  // the owner never leaves Today to change a word. `saved` is the draft as
  // FollowUp last wrote it (a "Write a new one" replaces it); Cancel goes back to it.
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(item.draftMessage);
  const [text, setText] = useState(item.draftMessage);
  const [edited, setEdited] = useState(false);
  // The owner's own words: they typed, or asked for a rewrite. A fresh draft from "Write a new one" is FollowUp's again.
  const [mine, setMine] = useState(false);
  const [rewriting, setRewriting] = useState<null | "fresh" | "shorter" | "warmer" | "formal">(null);
  const needsPrice = !editing && hasPriceSlot(text);
  // A price blank or an answer blank (A-100): "[ANSWER: parking]".
  const blankTopic = needsPrice ? (slotOf(text) as { topic?: string } | null)?.topic : undefined;
  const blankHint = blankTopic ? `your answer on ${blankTopic}` : "$ price";
  const [price, setPrice] = useState("");
  // "Use <price> next time" (A-096): ticked by default.
  const [remember, setRemember] = useState(true);
  const priceMissing = needsPrice && !price.trim();
  const message = needsPrice ? fillPriceSlot(text, price.trim()) : text;
  // A half-written reply is never lost (src/lib/keptEdit.ts): back after a
  // refresh, a trip to another screen, or the phone dropping the tab.
  // Restored after mount, because the server render cannot read the tab's storage.
  const restored = useRef(false);
  useEffect(() => {
    const kept = readKeptEdit(item.leadId, item.draftMessage);
    restored.current = true;
    if (!kept) return;
    // Browser-only state, read once after mount (the same exception as Settings' open page).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(kept.text);
    setPrice(kept.price);
    setMine(kept.mine);
    setEdited(kept.text !== item.draftMessage);
    if (kept.text !== item.draftMessage && !hasPriceSlot(kept.text)) setEditing(true);
  }, [item.leadId, item.draftMessage]);
  useEffect(() => {
    if (restored.current) keepEdit(item.leadId, item.draftMessage, { text, mine, price });
  }, [item.leadId, item.draftMessage, text, mine, price]);
  const plainReason = plainHoldReason(item.reason, { firstName, topic: item.riskTopic });
  // With the words underlined, the line under the reply points at them (#1).
  const checkHint =
    item.checkWords && item.checkWords.some((w) => text.includes(w))
      ? item.checkWords.filter((w) => text.includes(w)).length === 1
        ? "Check the underlined word. Nobody wrote it in this conversation."
        : "Check the underlined words. Nobody wrote them in this conversation."
      : null;
  // "We talked" (design brain A-039): the card stays for a few seconds
  // saying what happened, with Undo, then leaves the queue.
  const [talked, setTalked] = useState(false);
  useEffect(() => {
    if (!talked) return;
    // It has already said what happened for eight seconds, so it just leaves.
    const timer = setTimeout(() => onResolved(item.leadId, null), 8000);
    return () => clearTimeout(timer);
  }, [talked, item.leadId, onResolved]);

  /**
   * Ten seconds to change your mind, same as the routine pile.
   *
   * The pile got this first and the card did not, which had it exactly
   * backwards: the pile is a considered press on drafts nobody read,
   * while this is the press an owner makes forty times in a sitting on
   * drafts they are skim-reading. Production tonight says the same — the
   * biggest queue in the database is ten drafts and almost all of them
   * are unjudged, so they arrive here, one at a time, and this is the
   * button that gets used.
   *
   * A mis-tap here writes to a real customer in the owner's name, and
   * before this there was nothing between the tap and the send.
   */
  const send = useUndoableSend({
    url: `/api/leads/${item.leadId}/send`,
    body: JSON.stringify({
      message,
      ...(item.draftSubject ? { subject: item.draftSubject } : {}),
      // The text a "No answer" wrote goes as a text (A-103).
      ...(item.textTo ? { channel: "text" } : {}),
      ...(needsPrice ? { learnFacts: remember } : {}),
      // The newest thing the lead had said when this card was drawn. If
      // they have written since, the server refuses with a 409 and says so,
      // instead of sending a reply to a message that is no longer the last
      // word (daily-path audit 2026-09-25 F7).
      ...(item.leadLastMessageAt ? { seenInboundAt: item.leadLastMessageAt } : {}),
    }),
    onResponse: async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(typeof data.message === "string" ? data.message : "Send failed.");
        return;
      }
      dropKeptEdit(item.leadId);
      onResolved(item.leadId, `Sent to ${firstName}.`, true);
    },
    onNetworkError: () => setError("Couldn't reach FollowUp. Check your connection and try again."),
  });

  function sendNow() {
    setError(null);
    setEditing(false);
    send.start();
  }

  // The same two calls the customer page's editor makes (ReplyCard, A-085).
  async function writeFresh() {
    setRewriting("fresh");
    setError(null);
    try {
      const res = await fetch(`/api/leads/${item.leadId}/regenerate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || typeof data.message !== "string") {
        throw new Error(typeof data.message === "string" && !res.ok ? data.message : "Couldn't write a new one. Try again.");
      }
      setText(data.message);
      setSaved(data.message);
      setEdited(true);
      setMine(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't write a new one. Try again.");
    } finally {
      setRewriting(null);
    }
  }

  async function rewrite(style: "shorter" | "warmer" | "formal") {
    setRewriting(style);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${item.leadId}/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, style }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(typeof data.message === "string" ? data.message : "Couldn't rewrite it.");
      setText(data.text);
      setEdited(true);
      setMine(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't rewrite it.");
    } finally {
      setRewriting(null);
    }
  }

  async function dontSend() {
    setBusy("dismiss");
    setError(null);
    try {
      const res = await fetch(`/api/leads/${item.leadId}/dismiss-hold`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't dismiss it.");
      dropKeptEdit(item.leadId);
      onResolved(item.leadId, `Won't send to ${firstName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't dismiss it.");
      setBusy(null);
    }
  }

  async function weTalked(undo: boolean) {
    setBusy("talked");
    setError(null);
    try {
      const res = await fetch(`/api/leads/${item.leadId}/talked`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(undo ? { undo: true } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(typeof data.message === "string" ? data.message : "Couldn't save that.");
      setTalked(!undo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setBusy(null);
    }
  }

  async function setLater(when: "later_today" | "tomorrow_morning" | "clear") {
    setBusy("later");
    setError(null);
    try {
      const res = await fetch(`/api/leads/${item.leadId}/later`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ when }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(typeof data.message === "string" ? data.message : "Couldn't save that.");
      setLaterUntil(data.until ?? null);
      setLaterOpen(false);
      onSetAside?.(item.leadId, data.until ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setBusy(null);
    }
  }

  if (laterUntil) {
    const at = new Date(laterUntil);
    const tomorrow = at.toDateString() !== new Date().toDateString();
    const time = at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return (
      <div className="box px-4 py-4 flex flex-wrap items-center justify-between gap-3" role="status">
        <p className="text-sm">
          {item.leadName} is set aside until {tomorrow ? `tomorrow at ${time}` : time}, or until {firstName} writes again.
        </p>
        <button
          onClick={() => setLater("clear")}
          disabled={busy !== null}
          className="rounded-lg px-3 py-1.5 text-sm font-medium border disabled:opacity-60"
          style={{ borderColor: "var(--line)", color: "var(--ink)" }}
        >
          {busy === "later" ? "…" : "Undo"}
        </button>
      </div>
    );
  }
  if (talked) {
    return (
      <div className="px-[18px] py-3.5 flex flex-wrap items-center justify-between gap-3" role="status">
        <p className="text-sm">
          Check-ins stopped for {firstName}. FollowUp won&apos;t write to them until they write again.
        </p>
        <button
          onClick={() => weTalked(true)}
          disabled={busy !== null}
          className="rounded-lg px-3 py-1.5 text-sm font-medium border disabled:opacity-60"
          style={{ borderColor: "var(--line)", color: "var(--ink)" }}
        >
          {busy === "talked" ? "…" : "Undo"}
        </button>
      </div>
    );
  }

  const channelAndWait = [CHANNEL_NAME[item.leadLastMessageChannel ?? ""] ?? item.source, item.wait?.toLowerCase()].filter(Boolean).join(" · ");

  return (
    <div>
      {/* Who, where and how long (Today shows one customer at a time, A-209). */}
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <Link href={`/leads/${item.leadId}`} className="text-[20px] font-semibold hover:underline">
          {item.leadName}
        </Link>
        <span className="text-[13px] text-ink-faint">{channelAndWait}</span>
      </div>
      <div className="mt-3">

      {/* What they actually said, before what we're about to reply with —
          approving a draft with no visible context for what it's replying
          to meant trusting the AI's summary of the situation ("reason")
          instead of judging the reply against the lead's own words. This
          is the whole reason to review a hold at all, so it goes first.
          Previously each of these was its own bordered box (dashed, then
          solid) inside this already-bordered card — a nested-card look
          the design brain's S-09 explicitly names. A single divider
          between the two keeps the same "what they said, then what we'll
          say" distinction without stacking boxes inside boxes. */}
      {item.leadLastMessage && (
        // Their words sit in a white card, as the board draws them (A-080),
        // so the message and the reply read as two things.
        <div className="rounded-[16px] border border-line bg-card px-[18px] py-4 leading-relaxed">
          <p className="sr-only">
            {item.leadName.split(" ")[0]} wrote, over {CHANNEL_LABEL[item.leadLastMessageChannel ?? ""] ?? "message"}:
          </p>
          <p className="whitespace-pre-wrap text-[17px] leading-[1.45] text-ink sm:text-[16px]">{item.leadLastMessage}</p>
          {/* The 30-minute holding message went (A-060): the customer is not
              waiting in silence, and the owner should know that before
              deciding how fast this one has to be. */}
          {item.customerToldAt && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-soft">
              <Check size={13} aria-hidden="true" />
              <span>
                FollowUp told {firstName} you&apos;re on it
                {item.toldAt && (
                  <>
                    {" · "}
                    <time dateTime={item.customerToldAt}>{item.toldAt}</time>
                  </>
                )}
              </span>
            </p>
          )}
        </div>
      )}
      {/* The reply in the warm card, as the canvas draws it (TodayCalm,
          TodayCalmPhone): what it is, the words, then Send and Edit. */}
      {/* A lead site that keeps the contact private: the reply goes on the
          site, not by email (b018, A-075). */}
      {item.site ? (
        <div className="mt-3.5">
          <SiteReplyCard leadId={item.leadId} leadName={item.leadName} site={item.site} draft={item.draftMessage} waiting />
        </div>
      ) : (
      <div className="mt-3.5 rounded-[20px] p-4 sm:p-5" style={WARM_CARD}>
        {/* Who wrote it, at a glance (A-089, the Granola lesson): FollowUp's words until
            the owner changes them, then theirs. */}
        <Eyebrow tone="reply">{`${mine ? "Edited by you" : "Written by FollowUp"} · ${sendLocked ? "an admin sends it" : "waits for your OK"}`}</Eyebrow>
        {item.textTo && <p className="mt-1.5 text-[13px] text-ink-soft">Text to {item.textTo}</p>}
        {item.draftSubject && <p className="mt-2 text-[15px] font-medium">{item.draftSubject}</p>}
        {editing ? (
          <div className="mt-2.5 space-y-2">
            <textarea
              id={`reply-text-${item.leadId}`}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setEdited(true);
                setMine(true);
              }}
              rows={7}
              autoFocus
              aria-label={`Your reply to ${firstName}`}
              className="w-full resize-y rounded-xl border border-line bg-card/80 p-3 text-base leading-relaxed focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={writeFresh}
                disabled={rewriting !== null}
                className="h-8 rounded-full border border-line bg-card/70 px-3 text-[13px] font-medium disabled:opacity-60"
              >
                {rewriting === "fresh" ? "Writing…" : "Write a new one"}
              </button>
              <span className="text-[13px] text-ink-soft">or rewrite it:</span>
              {(
                [
                  ["shorter", "Shorter"],
                  ["warmer", "Warmer"],
                  ["formal", "More formal"],
                ] as const
              ).map(([style, name]) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => rewrite(style)}
                  disabled={rewriting !== null || !text.trim()}
                  className="h-8 rounded-full border border-line bg-card/70 px-3 text-[13px] font-medium disabled:opacity-60"
                >
                  {rewriting === style ? "Rewriting…" : name}
                </button>
              ))}
            </div>
          </div>
        ) : needsPrice ? (
          <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed">
            {splitAtPriceSlot(text).map((part, i) =>
              i === 0 ? (
                <span key={i}>{part}</span>
              ) : (
                <span key={i}>
                  {i === 1 ? (
                    blankTopic ? (
                      <textarea
                        id={`price-${item.leadId}`}
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        disabled={send.pending || send.busy}
                        placeholder={blankHint}
                        aria-label={blankTopic ? `Your answer about ${blankTopic}, for ${firstName}` : `The price for ${firstName}`}
                        autoComplete="off"
                        rows={2}
                        className={"my-1 block w-full resize-none rounded-md py-1.5 leading-snug border border-dashed bg-card px-2 align-baseline text-ink disabled:opacity-60"}
                        style={{ borderColor: price.trim() ? "var(--line)" : "var(--ink-soft)" }}
                      />
                    ) : (
                      <input
                        id={`price-${item.leadId}`}
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        disabled={send.pending || send.busy}
                        placeholder={blankHint}
                        aria-label={blankTopic ? `Your answer about ${blankTopic}, for ${firstName}` : `The price for ${firstName}`}
                        autoComplete="off"
                        className={"w-28 mx-0.5 inline-block h-8 rounded-md border border-dashed bg-card px-2 align-baseline text-ink disabled:opacity-60"}
                        style={{ borderColor: price.trim() ? "var(--line)" : "var(--ink-soft)" }}
                      />
                    )
                  ) : (
                    <span>{price.trim() || blankHint}</span>
                  )}
                  {part}
                </span>
              )
            )}
          </p>
        ) : (
          <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed">
            <MarkedText text={text} words={item.checkWords ?? []} />
          </p>
        )}
        {priceMissing && (
          <p className="mt-2 text-[13px] text-ink-soft">
            {blankTopic
              ? `${firstName} asked about ${blankTopic}. FollowUp doesn't know your answer yet, and never guesses. Add it, then send.`
              : "Add the price, then send. FollowUp never guesses one."}
          </p>
        )}
        {needsPrice && !priceMissing && (
          <RememberPrice
            id={`remember-${item.leadId}`}
            price={price.trim()}
            topic={blankTopic}
            checked={remember}
            onChange={setRemember}
            disabled={send.pending || send.busy}
          />
        )}
        {/* They asked if they're talking to a real person (situations audit,
            2026-10-06): said whatever the hold reason, because an account
            that holds every reply would otherwise show nothing at all. */}
        {item.askedIfPerson && !editing && (
          <p className="mt-2.5 flex items-baseline gap-2 text-[13.5px] text-ink">
            <span aria-hidden className="inline-block h-[7px] w-[7px] shrink-0 -translate-y-px rounded-full" style={{ background: "var(--state-needs)" }} />
            {firstName} asked if they&apos;re talking to a real person. Answer this one yourself.
          </p>
        )}
        {/* They said no: information, not a task, so no dot. */}
        {item.saidNo && !editing && (
          <p className="mt-2.5 text-[13.5px] text-ink">{firstName} said no. After this reply, FollowUp won&apos;t remind them again.</p>
        )}
        {/* Why it waits, in the owner's words (A-087): what to check, or
            nothing when the every-reply-waits setting is the only reason.
            A price draft's reason is the blank, which the lines above say. */}
        {(checkHint ?? plainReason) && !needsPrice && !item.askedIfPerson && !editing && !edited && (
          <p className="mt-2.5 flex items-baseline gap-2 text-[13.5px] text-ink">
            <span aria-hidden className="inline-block h-[7px] w-[7px] shrink-0 -translate-y-px rounded-full" style={{ background: "var(--state-needs)" }} />
            {checkHint ?? plainReason}
          </p>
        )}
        {item.basis && !editing && !edited && <p className="mt-2 hidden text-[13px] text-ink-soft sm:block">{item.basis}</p>}
        {error && (
          <p className="mt-2 text-[13px]" role="alert" style={{ color: "var(--coral)" }}>
            {error}
          </p>
        )}
        {/* The grace period replaces the buttons: while the clock runs,
            the only thing to press is the one that stops it (A-048). */}
        {send.pending ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="text-[15px]">
              Sending to {firstName} in {send.secs}s
            </p>
            <button
              onClick={send.undo}
              className="h-9 rounded-full border px-4 text-sm font-medium"
              style={{ borderColor: "var(--line-strong)", background: "var(--glass)" }}
            >
              Undo
            </button>
            {send.endsAt !== null && (
              <div className="basis-full">
                <UndoLine endsAt={send.endsAt} />
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="mt-4 flex gap-2.5">
              {/* Only admins send (A-041): a teammate keeps Edit, Later
                  and Don't send, and is told who sends. */}
              {!sendLocked && (
                <button
                  onClick={sendNow}
                  disabled={busy !== null || send.busy || priceMissing || rewriting !== null || !message.trim()}
                  className="h-[52px] flex-1 rounded-full text-base font-semibold disabled:opacity-60 sm:h-11 sm:flex-none sm:px-7"
                  style={{ backgroundColor: "var(--accent)", color: "var(--on-accent)" }}
                >
                  {send.busy ? "Sending…" : "Send"}
                </button>
              )}
              {!editing && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(true);
                    setLaterOpen(false);
                  }}
                  disabled={busy !== null || send.busy}
                  className="inline-flex h-[52px] w-24 items-center justify-center rounded-full border text-base font-medium disabled:opacity-60 sm:h-11"
                  style={{ borderColor: "var(--line-strong)", background: "var(--glass)" }}
                >
                  Edit
                </button>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-6 sm:justify-start sm:gap-x-4">
              {editing && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setText(saved);
                    setEdited(saved !== item.draftMessage);
                    setMine(false);
                  }}
                  disabled={rewriting !== null}
                  className="flex min-h-11 items-center text-sm text-ink-soft disabled:opacity-60"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => setLaterOpen((v) => !v)}
                disabled={busy !== null || send.busy}
                aria-expanded={laterOpen}
                className="flex min-h-11 items-center text-sm text-ink-soft disabled:opacity-60"
              >
                Later
              </button>
              <button
                onClick={dontSend}
                disabled={busy !== null || send.busy}
                className="flex min-h-11 items-center text-sm text-ink-soft disabled:opacity-60"
              >
                {busy === "dismiss" ? "…" : "Don't send"}
              </button>
              {!editing && <button
                onClick={() => weTalked(false)}
                disabled={busy !== null || send.busy}
                title={`You spoke with ${firstName} on a call or in person. FollowUp stops checking in until they write again.`}
                className="flex min-h-11 items-center text-sm text-ink-soft disabled:opacity-60"
              >
                {busy === "talked" ? "…" : "Already spoke"}
              </button>}
            </div>
          </>
        )}
      </div>
      )}
      <AnimatePresence initial={false}>
      {laterOpen && !send.pending && (
        // Opens from the Later it came from, and closes the same way (A-048).
        <motion.div key="later" {...OPEN_IN_PLACE} className="mt-2 flex flex-wrap items-center gap-2">
          {laterToday && (
            <button
              onClick={() => setLater("later_today")}
              disabled={busy !== null}
              className="rounded-lg px-3 py-1.5 text-sm border border-line hover:bg-paper disabled:opacity-60"
            >
              Later today · 2 pm
            </button>
          )}
          <button
            onClick={() => setLater("tomorrow_morning")}
            disabled={busy !== null}
            className="rounded-lg px-3 py-1.5 text-sm border border-line hover:bg-paper disabled:opacity-60"
          >
            Tomorrow morning · 9 am
          </button>
          <span className="text-xs text-ink-soft">Comes straight back if {firstName} writes again. The reply stays as it is.</span>
        </motion.div>
      )}
      </AnimatePresence>
      {/* Says what IS true (nothing left) rather than "Cancelled", which
          describes the press instead of the outcome. */}
      {send.cancelled && <p className="mt-1.5 text-xs text-ink-soft">Stopped — nothing was sent.</p>}
      </div>
    </div>
  );
}

export default function ApprovalQueue({
  items,
  answeredForYou = 0,
  sendLocked = false,
  handledToday = 0,
  laterToday = true,
  setAside = 0,
  holdAll = false,
  weekResults = null,
  plan = null,
}: {
  items: ApprovalItem[];
  /** Only admins send, and this person isn't one (A-041). */
  sendLocked?: boolean;
  /** Replies FollowUp sent on its own this week — what it did instead of asking. */
  answeredForYou?: number;
  /** People the owner dealt with since their midnight (A-031 / A-046). */
  handledToday?: number;
  /** "Later today" still ahead in the owner's day (A-046). */
  laterToday?: boolean;
  /** Cards set aside with Later, hidden until they come back. */
  setAside?: number;
  /**
   * Business.holdAllForApproval: every reply waits for the owner. The
   * empty state must not then say only unsure ones do (strategy audit
   * 2026-09-27).
   */
  holdAll?: boolean;
  /** "This week: 11 customers answered · 2 came back…" (A-088): what came of it, said at the end of the day. */
  weekResults?: string | null;
  /** "Next: FollowUp checks on Priya on Thursday…" (research round 2, #2): the plan, on a quiet Today. */
  plan?: string | null;
}) {
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  // A card that is done says what happened for a moment, then leaves and
  // the list closes up (A-048, the Framer study): leadId -> "Sent to Priya."
  const [leaving, setLeaving] = useState<Record<string, string>>({});
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);
  // Stable, so a card's own timers (We talked) aren't restarted by every re-render.
  const resolve = useCallback((leadId: string, result: string | null) => {
    if (!result) {
      setResolved((prev) => new Set(prev).add(leadId));
      return;
    }
    setLeaving((prev) => ({ ...prev, [leadId]: result }));
    timers.current.push(
      setTimeout(() => {
        setResolved((prev) => new Set(prev).add(leadId));
        setLeaving((prev) => {
          const next = { ...prev };
          delete next[leadId];
          return next;
        });
      }, RESULT_HOLD_MS)
    );
  }, []);
  const visible = items.filter((i) => !resolved.has(i.leadId));
  // What still needs a decision: the counts and the "Start with" line
  // never include a card that is on its way out.
  const active = visible.filter((i) => !leaving[i.leadId]);
  // One customer at a time, on the desk as on the phone (A-209). Null
  // means "the first one who needs you"; "Next" picks someone else.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Set aside with Later: they stay on screen with the set-aside note and
  // its Undo until the owner moves on with Next.
  const [setAsideIds, setSetAsideIds] = useState<Set<string>>(new Set());
  const setAsideHere = useCallback((leadId: string, until: string | null) => {
    setSelectedId(leadId);
    setSetAsideIds((prev) => {
      const next = new Set(prev);
      if (until) next.add(leadId);
      else next.delete(leadId);
      return next;
    });
  }, []);

  // An empty queue used to `return null`, so a good day rendered as a greeting,
  // three tiles and a link — and the screen read as broken rather than as calm.
  // This product had no way, anywhere, to say "all clear": silence looked
  // identical to something having gone wrong. An empty queue is a real state
  // and it is the state the owner most wants to be in, so it gets said out
  // loud, with what FollowUp did instead of asking.
  // Handled here since the page loaded count too, so the line moves as the owner works.
  const handled = handledToday + (items.length - active.length);

  if (visible.length === 0) {
    // A finish line, not a blank (A-046, the Todoist study): said calmly,
    // with what FollowUp keeps doing. No confetti, points or streaks.
    const done = handled > 0;
    // Faded in only when the owner emptied the list just now; an empty
    // Today on load simply is (no motion without a change of state).
    return (
      <>
      <motion.div
        initial={items.length > 0 ? { opacity: 0 } : false}
        animate={{ opacity: 1, transition: { duration: MOTION.move, ease: MOTION.easeOut } }}
        className="mt-6 box px-5 py-5 flex items-start gap-4"
        role="status"
      >
        <span
          aria-hidden="true"
          className="h-9 w-9 shrink-0 rounded-full border border-line flex items-center justify-center"
        >
          <Check className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          {/* The plan, not a second "nothing needs your OK" under the heading that
              already says it (research round 2, #2): a plan for what is left
              quiets it as much as finishing it does. */}
          <p className="font-medium">{done ? "You're done for today." : plan ?? "Nothing needs your OK right now."}</p>
          <p className="mt-1 text-sm text-ink-soft">
            {done
              ? `You handled ${handled} ${handled === 1 ? "person" : "people"} today.${plan ? ` ${plan}` : " FollowUp keeps watching, and will tell you when someone writes."}`
              : holdAll
                ? plan
                  ? "You'll see each reply here before it goes, apart from a short “let me check” when a price or date question has waited 30 minutes."
                  : "Every reply FollowUp writes shows up here first. Nothing goes out until you send it, apart from a short “let me check” when a price or date question has waited 30 minutes."
                : "Anything FollowUp isn't sure about will show up here before it sends."}
            {answeredForYou > 0 &&
              ` It answered ${answeredForYou} ${answeredForYou === 1 ? "customer" : "customers"} on its own this week.`}
          </p>
          {/* The end of the day is what the owner remembers (peak-end, A-088): real
              outcomes only, nothing when they are all zero. */}
          {weekResults && <p className="mt-2.5 text-sm text-ink tabular-nums">{weekResults}</p>}
        </div>
      </motion.div>
      </>
    );
  }

  /*
   * One list (A-087): everyone who needs the owner, longest waiting first,
   * whatever channel they wrote on; the channel is the icon on the row.
   * See @/lib/approvalGroups for what "safe" is allowed to mean. Grouping
   * by source (A-006, founder 2026-09-23) put eight headings in front of
   * an owner who lives in Gmail.
   */
  const groups = oneQueue(visible);
  const summary = summariseGroups(oneQueue(active));
  // How many sources actually contribute a routine draft — not how many
  // groups exist. A group that is all needs-you has no routine row, so
  // counting groups would keep the whole-queue box on screen beside a
  // single routine row and reintroduce the twin buttons.
  const groupsWithRoutine = groups.filter((g) => g.safeToSend.length > 0).length;
  const total = handled + active.length;
  // Everyone still waiting on a decision, in order: not leaving, not set aside.
  // (The groups keep the items they were given, so these are the page's ApprovalItems.)
  const queue = (groups.flatMap((g) => g.needsYou) as ApprovalItem[]).filter((i) => !leaving[i.leadId] && !setAsideIds.has(i.leadId));
  // The one on screen: the owner's pick while it is still here, else the
  // first who needs them. A set-aside person stays until the owner moves
  // on, so Undo is still in reach.
  const selected = (selectedId && visible.find((i) => i.leadId === selectedId)) || queue[0] || null;
  // Who comes after them: the next in line, or the first when they were picked from further down.
  const at = selected ? queue.findIndex((i) => i.leadId === selected.leadId) : -1;
  const next = queue.slice(at + 1).find((i) => i.leadId !== selected?.leadId) ?? queue.find((i) => i.leadId !== selected?.leadId) ?? null;

  return (
    <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,700px)_260px] lg:items-start lg:gap-12">
      <div className="min-w-0">
      {/* Said once, above everything, rather than 48 times on 48 cards. */}
      {summary.fromBeforePermission > 0 && (
        <p className="mb-4 text-xs text-ink-soft leading-relaxed">
          {summary.fromBeforePermission} of the drafts waiting were already there before you turned sending on. FollowUp
          left them for you rather than sending them all at once — send them whenever you&apos;re ready.
        </p>
      )}

      {/* Whole-queue "send the routine ones" (A-006): only when more than
          one source has routine drafts, otherwise it twins the row below. */}
      {summary.safeToSend > 0 && groupsWithRoutine > 1 && (
        <div className="mb-5 box px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <p className="font-medium">
              {summary.safeToSend} {summary.safeToSend === 1 ? "draft is" : "drafts are"} routine.
            </p>
            <p className="mt-0.5 text-xs text-ink-soft">
              FollowUp checked each one and found nothing that needs a decision. Nothing goes out until you press.
            </p>
          </div>
          {!sendLocked && <SafePileAction count={summary.safeToSend} source={null} />}
        </div>
      )}

      {/* The one customer (A-209): their words, the reply, Send. Keyed by
          person so Later, Already spoke and the answer blank start fresh. */}
      {selected &&
        (leaving[selected.leadId] ? (
          <p className="flex items-center gap-2 py-2 text-[15px] text-ink-soft" role="status">
            <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
            {leaving[selected.leadId]}
          </p>
        ) : (
          <motion.div key={selected.leadId} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: MOTION.move, ease: MOTION.easeOut } }}>
            <ApprovalCard item={selected} onResolved={resolve} sendLocked={sendLocked} laterToday={laterToday} onSetAside={setAsideHere} />
          </motion.div>
        ))}

      {/* Then one line: who's next, and everyone else in Customers (A-209). */}
      {next && (
        <p className="mt-6 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-[14px] text-ink-soft">
          <span>Next:</span>
          <button type="button" onClick={() => setSelectedId(next.leadId)} className="font-medium text-ink underline-offset-[3px] hover:underline">
            {next.leadName}
          </button>
          {next.wait && <span className="tabular-nums">· {next.wait.replace(/^Waiting /, "")}</span>}
          <span aria-hidden>·</span>
          <Link href="/leads?show=needs" className="underline underline-offset-[3px] hover:text-ink">
            See all {queue.length}
          </Link>
        </p>
      )}

      {/* Routine drafts: one quiet row per source, sent together on one press. */}
      {groups
        .filter((g) => g.safeToSend.length > 0)
        .map((group) => (
          <div key={group.source} className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-line px-4 py-3">
            <p className="text-sm text-ink-soft">
              {group.safeToSend.length} routine {group.safeToSend.length === 1 ? "draft" : "drafts"}
              {group.source === WHOLE_QUEUE ? "" : group.source === UNKNOWN_SOURCE_LABEL ? " added by hand" : ` from ${group.source}`}
              {group.safeToSend[0] && <span className="text-ink"> — top is {group.safeToSend[0].leadName}</span>}
            </p>
            {!sendLocked && <SafePileAction count={group.safeToSend.length} source={group.source === WHOLE_QUEUE ? null : group.source} />}
            <SafePilePeek items={group.safeToSend} />
          </div>
        ))}

      {/* Progress only when there is progress (A-080, the goal-gradient
          rule), desk only, once the day has five or more people in it. */}
      {total >= 5 && handled > 0 && (
        <p className="mt-4 hidden text-[13px] text-ink-faint tabular-nums sm:block">
          {handled} of {total} handled today
          {setAside > 0 && ` · ${setAside} set aside for later`}
        </p>
      )}
      </div>

      {/* Beside them on the desk: a few facts about this customer (A-212). */}
      {selected && !leaving[selected.leadId] && <AboutPanel item={selected} />}
    </div>
  );
}

/**
 * "About Ivy" beside the one customer on the desk (A-212): only facts the
 * card doesn't already say (say each fact once), and their page.
 */
function AboutPanel({ item }: { item: ApprovalItem }) {
  const first = item.leadName.split(" ")[0] || item.leadName;
  const a = item.about;
  const facts: [string, string | null][] = [
    ["Came from", a?.cameFrom ?? null],
    ["First wrote", a?.firstWrote ?? null],
    ["Writes in", a?.language ?? null],
  ];
  return (
    <aside aria-label={`About ${first}`} className="hidden rounded-[16px] bg-card-2 p-5 lg:block">
      <h2 className="text-[15px] font-semibold">About {first}</h2>
      <dl className="mt-3 grid gap-3">
        {facts
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k}>
              <dt className="text-[12.5px] text-ink-faint">{k}</dt>
              <dd className="mt-0.5 break-words text-[14px] leading-snug">{v}</dd>
            </div>
          ))}
      </dl>
      <Link href={`/leads/${item.leadId}`} className="mt-4 inline-block text-[13.5px] underline underline-offset-[3px] hover:text-ink-soft">
        Open {first}&apos;s page
      </Link>
    </aside>
  );
}
