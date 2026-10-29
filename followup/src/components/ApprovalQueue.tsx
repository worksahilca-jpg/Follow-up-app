"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { WARM_CARD } from "@/components/app/ReplyCard";
import { oneQueue, summariseGroups, UNKNOWN_SOURCE_LABEL, WHOLE_QUEUE } from "@/lib/approvalGroups";
import type { TodayTier } from "@/lib/calmToday";
import { MAYBE_NO_REASON, plainHoldReason } from "@/lib/holdReasons";
import { saidNoWords } from "@/lib/saidNoWords";
import { notNowIn } from "@/lib/notNow";
import NotNowQuestion from "@/components/app/NotNowQuestion";
import KeepFollowingButton from "@/components/app/KeepFollowingButton";
import { STAY_IN_TOUCH_TRIGGER } from "@/lib/stayInTouch";
import { THEIR_MOMENT_TRIGGER } from "@/lib/theirMoment";
import { isBookingLinkReason } from "@/lib/bookingOffer";
import { DayRow, type TodayRow } from "@/components/app/TodayDay";
import { Initials } from "@/components/app/canvasBits";
import MeetingOutcomeCard, { type MeetingToLookBackOn } from "@/components/app/MeetingOutcomeCard";
import CallBriefCard, { type CallToPrepare } from "@/components/app/CallBriefCard";
import { callRowWords } from "@/lib/callBrief";
import { outcomeWords } from "@/lib/meetingOutcome";
import { useUndoableSend } from "@/components/useUndoableSend";
import SiteReplyCard from "@/components/app/SiteReplyCard";
import type { PendingApproval } from "@/lib/pendingApprovals";
import SafePileAction from "@/components/SafePileAction";
import SafePilePeek from "@/components/SafePilePeek";
import UndoLine from "@/components/UndoLine";
import { AnimatePresence, motion } from "framer-motion";
import { ownerHeading, quoteWords } from "@/lib/todayWork";
import { MOTION, RESULT_HOLD_MS } from "@/lib/motion";
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
 * Reuses the same POST /api/leads/[id]/send that every manual send
 * uses — approving here IS sending
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
  /** Where Today puts them (A-230), worked out on the server so both sides order alike. */
  tier?: TodayTier;
  /** Why a ready customer is on top: "Wants to book", "Asked the price", "Likely to book" (A-230). */
  why?: string | null;
  /** When they last wrote, "2 days ago", worked out on the server so both sides say the same (A-243). */
  asked?: string | null;
  /** Who they are in one line, from their own words (A-286): "Buying · Mississauga · Pre-approved up to $900k". */
  line?: string | null;
  /** FollowUp knows everything it needs: a quiet "Ready" on their row (A-286). */
  ready?: boolean;
  /**
   * FollowUp's call (A-310): where they stand ("Ready", "Warm", "Later", "Has an agent") for their row and the open
   * person, and the one next step after this reply, from the plan the engine sends by. Judged by FollowUp alone.
   */
  call?: { tag: string; next: string | null; /** For a kind of business with no checklist: FollowUp's written reason, in place of the facts. */ why?: string | null } | null;
  /** Up to three known facts for the open person (A-286). */
  facts?: [string, string][];
  /** How many messages FollowUp or the owner has sent them (A-286): "FollowUp has replied 3 times". */
  replies?: number;
  /** When they started waiting, worked out on the server (A-337): "9:14 AM", "yesterday", "Mon", "Sep 25". */
  since?: string | null;
};

/** How they reached you, in one plain verb (A-255): "Omar Haddad emailed you 4 days ago:". */
const CHANNEL_DID: Record<string, string> = {
  email: "emailed you",
  call: "called you",
  text: "texted you",
  whatsapp: "messaged you on WhatsApp",
  instagram: "messaged you on Instagram",
  messenger: "messaged you on Messenger",
  web: "filled in your website form",
  lead_form: "filled in your Facebook lead form",
};

/** The one card on Today (A-220): white, a hairline, 18px corners, phone padding. */
const CARD = "rounded-[18px] border border-line bg-card p-3.5 sm:p-5";
/**
 * The open reply (A-337): the one raised thing on Today, white with a soft lift (the existing lifted-box shadow, which
 * draws its own hairline), 20px corners, roomier on a computer.
 */
const ONE = "rounded-[20px] bg-card px-4 pt-[18px] pb-4 shadow-[var(--shadow-box-lift)] lg:px-[26px] lg:pt-6 lg:pb-[22px]";

function ApprovalCard({
  item,
  bare = false,
  onResolved,
  sendLocked = false,
  onSkip,
  askNotNow = false,
}: {
  item: ApprovalItem;
  /** Today's card (A-266, A-335): the queue draws the box; the head is initials, name and one line. */
  bare?: boolean;
  /** Ask the one "not now" question on a maybe-no that reads as not now (A-329): an admin whose business hasn't answered. */
  askNotNow?: boolean;
  /** Done with this card. `result` is what happened, said for a moment before it leaves (A-048). */
  onResolved: (leadId: string, result: string | null, sent?: boolean) => void;
  /** Only admins send, and this person isn't one (A-041). */
  sendLocked?: boolean;
  /** "Skip for now": the next person comes first; this one waits at the back (A-243). Absent when they are the only one. */
  onSkip?: () => void;
}) {
  const firstName = item.leadName.split(" ")[0] || item.leadName;
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
  // A maybe-no says itself in the no line below (A-326), not twice.
  const plainReason = item.reason === MAYBE_NO_REASON ? null : plainHoldReason(item.reason, { firstName, topic: item.riskTopic });
  // Their booking link in the reply (A-263): information, not a check, so no dot.
  const offersBooking = isBookingLinkReason(item.reason);
  // With the words underlined, the line under the reply points at them (#1).
  const checkHint =
    item.checkWords && item.checkWords.some((w) => text.includes(w))
      ? item.checkWords.filter((w) => text.includes(w)).length === 1
        ? "Check the underlined word. Nobody wrote it in this conversation."
        : "Check the underlined words. Nobody wrote them in this conversation."
      : null;

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

  // Who, how and when, in one plain sentence (A-255): "Omar Haddad emailed
  // you 4 days ago:". Their message right under it says what they want, so
  // the line no longer leads with a reason tag ("Asked the price ·").
  // A note to someone staying in touch (A-260) answers nothing they asked: the line says why it exists.
  const stay = item.trigger === STAY_IN_TOUCH_TRIGGER;
  // A note for their moment (A-262): the head is what they said and when, and their words are the quote.
  const moment = item.trigger === THEIR_MOMENT_TRIGGER && Boolean(item.said);
  const note = stay || moment;
  const did = stay ? "said yes to hearing from you" : moment ? `said ${item.said?.when ?? "earlier"}` : CHANNEL_DID[item.leadLastMessageChannel ?? ""] ?? "wrote to you";
  const when = note ? null : item.asked ?? null;
  const quoted = moment ? item.said?.quote ?? null : item.leadLastMessage;
  // Who they are in one line (A-337): their facts with FollowUp's word for where they stand, else how they wrote.
  const tag = item.call?.tag ?? (item.ready ? "Ready" : null);
  const headLine =
    [item.line, tag && !item.line?.includes(tag) ? tag : null].filter(Boolean).join(" · ") ||
    `${did.charAt(0).toUpperCase()}${did.slice(1)}${when ? ` ${when}` : ""}`;
  // Why it waits, as a fact on Today's card (A-337), with no dot: "It waits for you." and the reason as written (never
  // re-cased: a reason can start with a name, or with "FollowUp").
  const waitsFor = (why: string) => (bare ? `It waits for you. ${why}` : why);
  // The reply's words: a little smaller on Today's card, where the customer's words lead (A-337).
  const replySize = bare ? "text-[15.5px] leading-[1.55]" : "text-[17px] leading-[1.5]";

  return (
    <article aria-label={`${item.leadName} is waiting for you`}>
      {bare ? (
        // Today's card (A-337): their face and name, who they are in one line ("Buying · Has an agent", FollowUp's
        // call A-310 in it), and on the right since when they have waited, as a date, never a ticking "ago".
        <div className="flex items-center gap-3">
          <Initials name={item.leadName} size={42} />
          <div className="min-w-0">
            {/* A 44px tap band around the name, keeping the line its own size. */}
            <Link href={`/leads/${item.leadId}`} data-nav="push" className="relative block truncate text-[17px] font-semibold leading-[1.25] text-ink before:absolute before:inset-x-0 before:-inset-y-[11px] before:content-[''] hover:underline">
              {item.leadName}
            </Link>
            <p className="mt-0.5 truncate text-[13px] leading-snug text-ink-faint">{headLine}</p>
          </div>
          {item.since && !note && <span className="ml-auto shrink-0 self-start pt-1 text-[12.5px] text-ink-faint">waiting since {item.since}</span>}
        </div>
      ) : (
        <p className="text-[14px] leading-snug text-ink-soft">
          <Link href={`/leads/${item.leadId}`} data-nav="push" className="font-semibold text-ink hover:underline">
            {item.leadName}
          </Link>{" "}
          {did}
          {when && ` ${when}`}
          {quoted ? ":" : "."}
        </p>
      )}

      {/* FollowUp's call (A-310) is the word in the line above; its next step and the facts are on the customer's page,
          one tap on the name (A-337: the card holds their words, the reply, why it waits and Send). */}

      {/* What they actually said, before what we're about to reply with:
          judging a reply needs the customer's own words, not FollowUp's
          summary of them. Their words are the biggest text on the card, as plain text (A-286: the reply is the one box). */}
      {quoted && (
        <div className={bare ? "mt-4" : "mt-2.5"}>
          <p className={"whitespace-pre-wrap font-read text-ink" + (bare ? " text-[16.5px] leading-[1.45]" : " rounded-[16px] bg-card-2 px-4 py-3.5 text-[17px] leading-[1.5]")}>
            {bare ? `“${quoted.trim()}”` : quoted}
          </p>
          {/* The 30-minute holding message went (A-060): the customer is not
              waiting in silence, and the owner should know that before
              deciding how fast this one has to be. */}
          {item.customerToldAt && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-ink-soft">
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

      {/* A lead site that keeps the contact private: the reply goes on the
          site, not by email (b018, A-075). */}
      {item.site ? (
        <div className="mt-2.5">
          <SiteReplyCard leadId={item.leadId} leadName={item.leadName} site={item.site} draft={item.draftMessage} waiting />
        </div>
      ) : (
      <>
      {/* The reply on the wash (A-220), said in words (A-243): who wrote it,
          FollowUp or the owner (A-089), with no label to decode. */}
      {bare ? (
        <p className="mt-4 text-[13px] leading-snug text-ink-faint">{mine ? "You changed it" : note ? "FollowUp wrote this note" : "FollowUp wrote"}</p>
      ) : (
        <p className="mt-4 text-[14px] leading-snug text-ink-soft">
          {mine ? (note ? "Your note, as you changed it:" : "Your reply, as you changed it:") : note ? "FollowUp wrote this note for you:" : "FollowUp wrote this reply for you:"}
        </p>
      )}
      <div className={bare ? "mt-[7px] rounded-[14px] bg-card-2 px-4 py-3.5" : "mt-2 rounded-[16px] px-4 py-3.5"} style={bare ? undefined : WARM_CARD}>
        {item.textTo && <p className="text-[12.5px] text-ink-soft">Text to {item.textTo}</p>}
        {item.draftSubject && <p className="text-[14px] font-medium">{item.draftSubject}</p>}
        {editing ? (
          <div className="mt-1 space-y-2">
            {/* 16px, so a phone doesn't zoom in when the box takes focus. */}
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
              className="w-full resize-y rounded-xl border border-line bg-card/80 p-3 font-read text-[17px] leading-[1.5] focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={writeFresh}
                disabled={rewriting !== null}
                className="h-9 rounded-full border border-line bg-card/70 px-3 text-[13px] font-medium disabled:opacity-60"
              >
                {rewriting === "fresh" ? "Writing…" : "Write a new one"}
              </button>
              <span className="text-[13px] text-ink-soft">or:</span>
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
                  className="h-9 rounded-full border border-line bg-card/70 px-3 text-[13px] font-medium disabled:opacity-60"
                >
                  {rewriting === style ? "Rewriting…" : name}
                </button>
              ))}
            </div>
          </div>
        ) : needsPrice ? (
          <p className={`whitespace-pre-wrap font-read ${replySize}`}>
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
                        className={"my-1 block w-full resize-none rounded-md py-1.5 leading-snug border border-dashed bg-card px-2 align-baseline text-base text-ink disabled:opacity-60"}
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
                        className={"w-28 mx-0.5 inline-block h-9 rounded-md border border-dashed bg-card px-2 align-baseline text-base text-ink disabled:opacity-60"}
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
          <p className={`whitespace-pre-wrap font-read ${replySize}`}>
            <MarkedText text={text} words={item.checkWords ?? []} />
          </p>
        )}
      </div>

      {/* At most one line on why it waits, under the reply (A-087). */}
      {priceMissing && (
        <p className="mt-2.5 text-[13px] leading-snug text-ink-soft">
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
        <p className={bare ? "mt-3 text-[14px] leading-[1.4] text-ink" : "mt-2.5 flex items-baseline gap-2 text-[13px] leading-snug text-ink"}>
          {!bare && <span aria-hidden className="inline-block h-[7px] w-[7px] shrink-0 -translate-y-px rounded-full" style={{ background: "var(--state-needs)" }} />}
          {bare ? "It waits for you. " : ""}
          {firstName} asked if they&apos;re talking to a real person. Answer this one yourself.
        </p>
      )}
      {/* They said no (A-326): what FollowUp did, in words with no dot (R-141), and the one way back. A maybe-no says
          FollowUp isn't sure and stopped to be safe. */}
      {item.saidNo && !editing && (
        <div>
          <p className="mt-2.5 text-[13px] leading-snug text-ink">{saidNoWords(item.saidNoHow ?? "clear", firstName).line}</p>
          {askNotNow && item.saidNoHow === "unsure" && notNowIn(item.leadLastMessage ?? "") && <NotNowQuestion leadId={item.leadId} />}
          <KeepFollowingButton leadId={item.leadId} label={saidNoWords(item.saidNoHow ?? "clear", firstName).link} className="mt-0.5" />
        </div>
      )}
      {/* Why it waits, in the owner's words (A-087): what to check, or
          nothing when the every-reply-waits setting is the only reason.
          A price draft's reason is the blank, which the lines above say. */}
      {/* A note to someone staying in touch: why them, in plain words. Information, not a task, so no dot. */}
      {(note || offersBooking) && item.reason && !editing && (
        <p className="mt-2.5 text-[13px] leading-snug text-ink">{item.reason.trim().replace(/\.?$/, ".")}</p>
      )}
      {!note && (checkHint ?? (offersBooking ? null : plainReason)) && !needsPrice && !item.askedIfPerson && !editing && !edited && (
        <p className={bare ? "mt-3 text-[14px] leading-[1.4] text-ink-soft" : "mt-2.5 flex items-baseline gap-2 text-[13px] leading-snug text-ink"}>
          {!bare && <span aria-hidden className="inline-block h-[7px] w-[7px] shrink-0 -translate-y-px rounded-full" style={{ background: "var(--state-needs)" }} />}
          {waitsFor((checkHint ?? plainReason) as string)}
        </p>
      )}
      {error && (
        <p className="mt-2 text-[13px]" role="alert" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}

      {/* What to do, in words, right above the buttons it names (A-243, R-113).
          A blank to fill says its own instruction above, so this stays quiet then. */}
      {!send.pending && !priceMissing && (!bare || sendLocked || editing) && (
        <p className="mt-4 text-[15.5px] leading-normal text-ink">
          {sendLocked ? (
            <>
              An admin on your team sends replies. To change a word, press <b>Change it</b>.
            </>
          ) : editing ? (
            <>
              Change the words, then press <b>Send</b>.
            </>
          ) : (
            <>
              If it looks right, press <b>Send</b>.
            </>
          )}
        </p>
      )}

      {/* Under the reply, on the phone too (A-243): the sentence and the
          buttons it names sit together. The ten seconds to undo (A-048)
          take their place while the clock runs. */}
      {send.pending ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-[15px]">
            Sending to {firstName} in {send.secs}s
          </p>
          <button onClick={send.undo} className="h-11 rounded-full border border-line bg-card px-5 text-[14px] font-medium">
            Undo
          </button>
          {send.endsAt !== null && (
            <div className="basis-full">
              <UndoLine endsAt={send.endsAt} />
            </div>
          )}
        </div>
      ) : (
        <div className={bare ? "mt-4 flex flex-wrap items-center gap-2 lg:gap-2.5" : "mt-3 flex flex-wrap items-center gap-2.5"}>
          {/* Send is the one black button (A-220), right under the reply (A-337).
              Only admins send (A-041): a teammate keeps Change it. */}
          {!sendLocked && (
            <button
              onClick={sendNow}
              disabled={send.busy || priceMissing || rewriting !== null || !message.trim()}
              className={
                bare
                  ? "h-12 whitespace-nowrap rounded-full px-5 text-[15.5px] font-semibold disabled:opacity-60 lg:px-[26px]"
                  : "h-12 flex-1 rounded-full px-6 text-[16px] font-semibold disabled:opacity-60 sm:flex-none sm:px-7"
              }
              style={{ backgroundColor: "var(--accent)", color: "var(--on-accent)" }}
            >
              {send.busy ? "Sending…" : `Send to ${firstName}`}
            </button>
          )}
          {editing ? (
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setText(saved);
                setEdited(saved !== item.draftMessage);
                setMine(false);
              }}
              disabled={rewriting !== null}
              className={(bare ? "px-4 text-[15px] lg:px-5" : "px-6 text-[16px]") + " h-12 rounded-full border border-line bg-card font-medium disabled:opacity-60"}
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={send.busy}
              className={(bare ? "px-4 text-[15px] lg:px-5" : "px-6 text-[16px]") + " h-12 whitespace-nowrap rounded-full border border-line bg-card font-medium disabled:opacity-60"}
            >
              Change it
            </button>
          )}
          {/* The one quiet way out (A-243). Don't send, Already spoke and
              Later stay on the customer's own page. */}
          {onSkip && !editing && (
            <button
              type="button"
              onClick={onSkip}
              disabled={send.busy}
              className={
                bare
                  ? "ml-auto min-h-12 whitespace-nowrap px-1 text-[14.5px] text-ink-soft hover:text-ink disabled:opacity-60"
                  : "min-h-11 basis-full text-left text-[14px] text-ink-faint underline underline-offset-[3px] hover:text-ink disabled:opacity-60 sm:ml-auto sm:basis-auto sm:text-right"
              }
            >
              {bare ? "Not now" : "Skip for now"}
            </button>
          )}
        </div>
      )}
      </>
      )}
      {/* Says what IS true (nothing left) rather than "Cancelled", which
          describes the press instead of the outcome. */}
      {send.cancelled && <p className="mt-1.5 text-[12.5px] text-ink-soft">Stopped. Nothing was sent.</p>}
    </article>
  );
}

export default function ApprovalQueue({
  items,
  rows = [],
  sendLocked = false,
  handledToday = 0,
  holdAll = false,
  meetings = [],
  calls = [],
  quiet = null,
  askNotNow = false,
}: {
  items: ApprovalItem[];
  /** The one "not now" question (A-329) may be asked on a card: an admin, and the business hasn't answered it. */
  askNotNow?: boolean;
  /** Calls booked for today and not over yet (A-268): "Your calls today", each opening "Before your call" in place. */
  calls?: CallToPrepare[];
  /** Calls to look back on (A-263): a row each, opening the four answers in place (A-266). */
  meetings?: MeetingToLookBackOn[];
  /** Customers who stopped replying (A-046), as the last row: the first one, and how many in all. */
  quiet?: { id: string; name: string; total: number } | null;
  /** The owner's other decisions: a picked or cancelled time, a call to make, facts to check. */
  rows?: TodayRow[];
  /** Only admins send, and this person isn't one (A-041). */
  sendLocked?: boolean;
  /** People the owner dealt with since their midnight (A-031 / A-046). */
  handledToday?: number;
  /**
   * Business.holdAllForApproval: every reply waits for the owner. The
   * empty state must not then say only unsure ones do (strategy audit
   * 2026-09-27).
   */
  holdAll?: boolean;
}) {
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  // A card that is done says what happened for a moment, then leaves and
  // the next one takes its place (A-048, the Framer study): leadId -> "Sent to Priya."
  const [leaving, setLeaving] = useState<Record<string, string>>({});
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);
  // FollowUp's panel is worked out on the server. After every send the page is fetched again, so what FollowUp did
  // gains the send; what is on screen here (the open card, a half-written reply) stays as it is.
  const router = useRouter();
  // Stable, so a card's own timers aren't restarted by every re-render.
  const resolve = useCallback((leadId: string, result: string | null) => {
    router.refresh();
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
  }, [router]);
  const visible = items.filter((i) => !resolved.has(i.leadId));
  // What still needs a decision: the counts never include a card that is on its way out.
  const active = visible.filter((i) => !leaving[i.leadId]);
  // One person at a time (A-244, A-335). "Not now" (A-243's skip) moves someone to the back of the line for this
  // visit only; a row under the card brings that person up instead. Nothing is saved.
  const [skipped, setSkipped] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  // Everyone after the first three waiting rows (A-337: "12 more waiting"), shown in place when asked for.
  const [listOpen, setListOpen] = useState(false);
  const focusRef = useRef<HTMLElement>(null);
  const skip = useCallback((leadId: string) => {
    setPicked(null);
    setSkipped((prev) => [...prev.filter((id) => id !== leadId), leadId]);
  }, []);

  // People dealt with today, the ones since the page loaded too, so the heading moves as the owner works.
  const handled = handledToday + (items.length - active.length);

  /*
   * One list (A-087): everyone who needs the owner, in Today's order (A-230),
   * whatever channel they wrote on. See @/lib/approvalGroups for what
   * "safe" is allowed to mean.
   */
  const groups = oneQueue(visible);
  const summary = summariseGroups(oneQueue(active));
  // How many sources actually contribute a routine draft — not how many
  // groups exist. A group that is all needs-you has no routine row, so
  // counting groups would keep the whole-queue box on screen beside a
  // single routine row and reintroduce the twin buttons.
  const groupsWithRoutine = groups.filter((g) => g.safeToSend.length > 0).length;
  // Everyone still waiting on a decision, anyone skipped at the back in the order they were skipped.
  // (The groups keep the items they were given, so these are the page's ApprovalItems.)
  const waiting = (groups.flatMap((g) => g.needsYou) as ApprovalItem[]).filter((i) => !leaving[i.leadId]);
  const queue = [
    ...waiting.filter((i) => !skipped.includes(i.leadId)),
    ...skipped.map((id) => waiting.find((i) => i.leadId === id)).filter((i): i is ApprovalItem => Boolean(i)),
  ];
  const selected = (picked && queue.find((i) => i.leadId === picked)) || queue[0] || null;
  // One row per person (A-286): a call to look back on for someone already waiting goes with them, not in the list.
  const queuedIds = new Set(queue.map((i) => i.leadId));
  const listMeetings = meetings.filter((m) => !queuedIds.has(m.leadId));
  const alsoMeeting = selected ? meetings.find((m) => m.leadId === selected.leadId) ?? null : null;
  // A tap on a waiting row brings that person up into the card; the page scrolls back to the card when it is off
  // screen.
  const openPerson = (leadId: string) => {
    setPicked(leadId);
    setListOpen(false);
    const top = focusRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0 || top > window.innerHeight) focusRef.current?.scrollIntoView({ block: "start" });
  };
  const selectedFirst = selected ? selected.leadName.split(" ")[0] || selected.leadName : null;
  // What the last press did, said for a moment before it goes (A-048).
  const justDone = Object.values(leaving).at(-1) ?? null;
  const others = queue.filter((i) => i.leadId !== selected?.leadId);
  const [openMeeting, setOpenMeeting] = useState<string | null>(null);
  const [openCall, setOpenCall] = useState<string | null>(null);
  // Booked calls in time order: one starting within the hour first (A-283); each has its time on the right.
  const soonCalls = calls.filter((c) => c.soon);
  const laterCalls = calls.filter((c) => !c.soon);
  const callRow = (c: CallToPrepare) => (
    <Fragment key={c.bookingId}>
      <DayRow
        plain
        row={callPrepRow(c)}
        expanded={openCall === c.bookingId}
        onClick={() => setOpenCall((o) => (o === c.bookingId ? null : c.bookingId))}
      />
      {openCall === c.bookingId && (
        <div data-attached className="pb-3">
          <CallBriefCard call={c} />
        </div>
      )}
    </Fragment>
  );
  // The owner's other decisions, one row each.
  const decisionRows = rows.length + listMeetings.length + (quiet ? 1 : 0);
  // The heading (A-337): the replies for their OK, numeral first, the page's biggest words.
  const heading = ownerHeading({ replies: queue.length, others: decisionRows, handled, holdAll });

  // The one person, in full (A-335): their words, FollowUp's reply and Send, open from the start (A-250), raised
  // (A-337). After Send the card slides out and the next person's slides in (A-048: motion only where something
  // changes); the card Today opens with simply is.
  const focus = selected ? (
    <section ref={focusRef} aria-label="Do this first" className="mt-4 scroll-mt-20 lg:mt-5 lg:scroll-mt-6">
      {/* What the last press did is said here for a moment. */}
      {justDone && (
        <p className="mb-3 flex items-center gap-1.5 px-1 text-[13.5px] text-ink-soft" role="status">
          <Check className="h-4 w-4 shrink-0" style={{ color: "var(--sage)" }} aria-hidden="true" />
          {[justDone, selectedFirst && `Now ${selectedFirst}.`].filter(Boolean).join(" ")}
        </p>
      )}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={selected.leadId}
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0, transition: { duration: MOTION.move, ease: MOTION.easeApple } }}
          exit={{ opacity: 0, x: -28, transition: { duration: MOTION.exit, ease: MOTION.easeIn } }}
          className={ONE}
        >
          <ApprovalCard
            item={selected}
            bare
            onResolved={resolve}
            sendLocked={sendLocked}
            onSkip={queue.length > 1 ? () => skip(selected.leadId) : undefined}
            askNotNow={askNotNow}
          />
          {/* Anything else waiting for the same person sits with them, not as another row (A-286). */}
          {alsoMeeting && (
            <div className="mt-7 border-t border-line pt-3">
              <p className="px-1 text-[13px] text-ink-faint">Also for {selectedFirst}</p>
              <div className="-mx-3">
                <DayRow
                  row={meetingRow(alsoMeeting)}
                  expanded={openMeeting === alsoMeeting.bookingId}
                  onClick={() => setOpenMeeting((o) => (o === alsoMeeting.bookingId ? null : alsoMeeting.bookingId))}
                />
              </div>
              {openMeeting === alsoMeeting.bookingId && <MeetingOutcomeCard meeting={alsoMeeting} />}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  ) : justDone ? (
    // The last one just went: what happened, said for a moment where the card was.
    <p className="mt-4 flex items-center gap-1.5 px-1 text-[13.5px] text-ink-soft" role="status">
      <Check className="h-4 w-4 shrink-0" style={{ color: "var(--sage)" }} aria-hidden="true" />
      {justDone}
    </p>
  ) : null;

  // Who waits after the open one (A-337): plain rows, their own words and since when, three of them, then
  // "12 more waiting". A row brings that person up into the card.
  const shownOthers = listOpen ? others : others.slice(0, WAITING_SHOWN);
  const hiddenOthers = others.length - shownOthers.length;

  return (
    // Today's owner side (A-337, from the research): the only loud part of the page. The heading counts what waits
    // for their OK; the first reply is open and raised with Send under it; the rest wait as plain rows; the other
    // decisions follow; then today's calls. FollowUp's own work is the quiet panel beside it (the page puts it there).
    <div>
      {/* Weight and tracking set here: the app's own h1 rule (thin, for page titles) would otherwise win over a class. */}
      <h1 className="mx-1 text-[27px] leading-[1.12] text-balance lg:mx-0 lg:text-[32px]" style={{ fontWeight: 700, letterSpacing: "-0.022em" }}>
        {heading.title}
      </h1>
      <p className="mx-1 mt-1.5 text-[15px] leading-[1.4] text-ink-soft lg:mx-0">{heading.sub}</p>

      {/* Said once, above everything, rather than 48 times on 48 cards. */}
      {summary.fromBeforePermission > 0 && (
        <p className="mt-3 px-1 text-[12.5px] leading-relaxed text-ink-soft">
          {summary.fromBeforePermission} of the drafts waiting were already there before you turned sending on. FollowUp
          left them for you rather than sending them all at once. Send them whenever you&apos;re ready.
        </p>
      )}

      {/* Whole-queue "send the routine ones" (A-006): only when more than
          one source has routine drafts, otherwise it twins the row below. */}
      {summary.safeToSend > 0 && groupsWithRoutine > 1 && (
        <div className={`mt-4 ${CARD} flex flex-wrap items-center justify-between gap-3`}>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium">
              {summary.safeToSend} {summary.safeToSend === 1 ? "draft is" : "drafts are"} routine.
            </p>
            <p className="mt-0.5 text-[12.5px] text-ink-soft">
              FollowUp checked each one and found nothing that needs a decision. Nothing goes out until you press.
            </p>
          </div>
          {!sendLocked && <SafePileAction count={summary.safeToSend} source={null} />}
        </div>
      )}

      {focus}

      {/* Routine drafts: one quiet row per source, sent together on one press. */}
      {groups
        .filter((g) => g.safeToSend.length > 0)
        .map((group) => (
          <div key={group.source} className="mt-2.5 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-line bg-card px-3 py-2.5">
            <p className="min-w-0 flex-1 text-[13px] text-ink-soft">
              {group.safeToSend.length} routine {group.safeToSend.length === 1 ? "draft" : "drafts"}
              {group.source === WHOLE_QUEUE ? "" : group.source === UNKNOWN_SOURCE_LABEL ? " added by hand" : ` from ${group.source}`}
              {group.safeToSend[0] && <span className="text-ink"> · top is {group.safeToSend[0].leadName}</span>}
            </p>
            {!sendLocked && <SafePileAction count={group.safeToSend.length} source={group.source === WHOLE_QUEUE ? null : group.source} />}
            <SafePilePeek items={group.safeToSend} />
          </div>
        ))}

      {(others.length > 0 || decisionRows > 0) && (
        <div id="today-next" className="mt-3.5 lg:mt-[18px]">
          {shownOthers.map((i) => (
            <DayRow key={i.leadId} plain row={replyRow(i)} onClick={() => openPerson(i.leadId)} />
          ))}
          {hiddenOthers > 0 && (
            <button
              type="button"
              onClick={() => setListOpen(true)}
              aria-controls="today-next"
              className="flex min-h-12 w-full items-center border-t border-line px-1 py-2 text-left text-[14.5px] font-medium"
            >
              {hiddenOthers} more waiting
              <span aria-hidden="true" className="ml-auto text-ink-faint">
                ›
              </span>
            </button>
          )}
          {/* The owner's other decisions, one row each: a picked or cancelled time, a call to make, a call to look
              back on (which opens its four answers in place), who stopped replying, facts to check. */}
          {rows.map((r) => (
            <DayRow key={r.key} plain row={r} />
          ))}
          {listMeetings.map((m) => (
            <Fragment key={m.bookingId}>
              <DayRow
                plain
                row={meetingRow(m)}
                expanded={openMeeting === m.bookingId}
                onClick={() => setOpenMeeting((o) => (o === m.bookingId ? null : m.bookingId))}
              />
              {openMeeting === m.bookingId && (
                <div data-attached className="pb-3">
                  <MeetingOutcomeCard meeting={m} />
                </div>
              )}
            </Fragment>
          ))}
          {quiet && (
            <DayRow
              plain
              row={{
                key: "quiet",
                kind: "reply",
                person: quiet.name,
                title: quiet.total > 1 ? `${quiet.name} and ${quiet.total - 1} more` : quiet.name,
                sub: "Stopped replying. A quick check-in could bring them back.",
                time: null,
                href: quiet.total > 1 ? "/leads?show=quiet" : `/leads/${quiet.id}`,
              }}
            />
          )}
        </div>
      )}

      {/* Today's booked calls (A-337: "Your calls today", a real heading), a call starting within the hour first
          (A-283), each opening its note in place (A-268). Later days are in FollowUp's "Coming up". */}
      {calls.length > 0 && (
        <section aria-label="Your calls today">
          <h2 className="mx-1 mt-[30px] mb-1.5 text-[19px] lg:mx-0 lg:mt-9" style={{ fontWeight: 700, letterSpacing: "-0.012em" }}>
            Your calls today
          </h2>
          <div className="border-b border-line">
            {soonCalls.map((c) => callRow(c))}
            {laterCalls.map((c) => callRow(c))}
          </div>
        </section>
      )}
    </div>
  );
}

/** How many people wait as rows under the open card before "N more waiting" (A-337). */
const WAITING_SHOWN = 3;

/**
 * One person waiting under the open card (A-337): their name, their own words on one line, and since when, as a quiet
 * time on the right. A no, a picked time and a note say what they are instead of the words.
 */
function replyRow(item: ApprovalItem): TodayRow {
  const base = { key: item.leadId, kind: "reply" as const, title: item.leadName, person: item.leadName, time: item.since ? `since ${item.since}` : null, quietTime: true, href: null };
  // They said no (A-326): the row says it in words before anything else about them.
  if (item.saidNo) return { ...base, sub: saidNoWords(item.saidNoHow ?? "clear", item.leadName).row };
  // They picked a time (A-242): the reply waiting is the acknowledgement; the booking waits for Confirm on their page.
  if (item.pickedTime) return { ...base, sub: "Picked a time. Send the reply, then confirm it on their page." };
  // A note to someone staying in touch (A-260) answers nothing: the row says what it is.
  if (item.trigger === STAY_IN_TOUCH_TRIGGER) return { ...base, time: null, sub: "Said yes to hearing from you. A short note is ready for your OK." };
  // A note for their moment (A-262): the time they named has come.
  if (item.trigger === THEIR_MOMENT_TRIGGER) return { ...base, time: null, sub: "The time they named has come. A short note is ready for your OK." };
  // Their own words, the way the drawing reads (A-337); who they are when there are no words.
  const words = quoteWords(item.leadLastMessage);
  if (words) return { ...base, sub: words };
  if (item.line) return { ...base, sub: item.line };
  const did = CHANNEL_DID[item.leadLastMessageChannel ?? ""] ?? "wrote to you";
  return { ...base, sub: `${did.charAt(0).toUpperCase()}${did.slice(1)}. Your reply is ready.` };
}

/** A call booked for today (A-268) as a row: its time on the right, like a calendar (A-283), and that the note to
 * read before it is ready. The row opens the note in place, so the time stands where a chevron would. */
function callPrepRow(c: CallToPrepare): TodayRow {
  return { key: `prep-${c.bookingId}`, kind: "booking", title: c.name, person: c.name, sub: callRowWords(!!c.soon), time: c.time, href: null };
}

/** A call to look back on (A-263) as a row: the question until it is answered, then what was said. */
function meetingRow(m: MeetingToLookBackOn): TodayRow {
  const sub = m.outcome ? outcomeWords(m.outcome, m.first, m.plan).headline : `How did your call ${m.when} go? One tap.`;
  return { key: `meeting-${m.bookingId}`, kind: "call", title: m.name, person: m.name, sub, time: null, href: null };
}
