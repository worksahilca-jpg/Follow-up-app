"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { WARM_CARD } from "@/components/app/ReplyCard";
import { oneQueue, summariseGroups, UNKNOWN_SOURCE_LABEL, WHOLE_QUEUE } from "@/lib/approvalGroups";
import type { TodayTier } from "@/lib/calmToday";
import { plainHoldReason } from "@/lib/holdReasons";
import { STAY_IN_TOUCH_TRIGGER } from "@/lib/stayInTouch";
import { THEIR_MOMENT_TRIGGER } from "@/lib/theirMoment";
import { isBookingLinkReason } from "@/lib/bookingOffer";
import { DAY_BOX, DayHeading, DayRow, type TodayRow } from "@/components/app/TodayDay";
import { useUndoableSend } from "@/components/useUndoableSend";
import SiteReplyCard from "@/components/app/SiteReplyCard";
import type { PendingApproval } from "@/lib/pendingApprovals";
import SafePileAction from "@/components/SafePileAction";
import SafePilePeek from "@/components/SafePilePeek";
import UndoLine from "@/components/UndoLine";
import { motion } from "framer-motion";
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
  /** Where Today puts them (A-230), worked out on the server so both sides order alike. */
  tier?: TodayTier;
  /** Why a ready customer is on top: "Wants to book", "Asked the price", "Likely to book" (A-230). */
  why?: string | null;
  /** When they last wrote, "2 days ago", worked out on the server so both sides say the same (A-243). */
  asked?: string | null;
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
/** The one customer on Today: a box on a computer; on a phone it sits on the page itself, as a phone app would (A-222). */
const ONE = "px-2 sm:px-0 lg:rounded-[18px] lg:border lg:border-line lg:bg-card lg:px-5 lg:py-5";

function ApprovalCard({
  item,
  bare = false,
  onResolved,
  sendLocked = false,
  onSkip,
}: {
  item: ApprovalItem;
  /** Inside "Do this first" (A-244), which is the box: no box of its own. */
  bare?: boolean;
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
  const plainReason = plainHoldReason(item.reason, { firstName, topic: item.riskTopic });
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

  return (
    <article className={bare ? undefined : ONE} aria-label={`${item.leadName} is waiting for you`}>
      <p className="text-[14px] leading-snug text-ink-soft">
        <Link href={`/leads/${item.leadId}`} data-nav="push" className="font-semibold text-ink hover:underline">
          {item.leadName}
        </Link>{" "}
        {did}
        {when && ` ${when}`}
        {quoted ? ":" : "."}
      </p>

      {/* What they actually said, before what we're about to reply with:
          judging a reply needs the customer's own words, not FollowUp's
          summary of them. Their words are the biggest text on the card. */}
      {quoted && (
        <div className="mt-2.5">
          <p className="whitespace-pre-wrap rounded-[16px] bg-card-2 px-4 py-3.5 font-read text-[17.5px] leading-[1.5] text-ink">{quoted}</p>
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
      <p className="mt-4 text-[14px] leading-snug text-ink-soft">
        {mine ? (note ? "Your note, as you changed it:" : "Your reply, as you changed it:") : note ? "FollowUp wrote this note for you:" : "FollowUp wrote this reply for you:"}
      </p>
      <div className="mt-2 rounded-[16px] px-4 py-3.5" style={WARM_CARD}>
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
              className="w-full resize-y rounded-xl border border-line bg-card/80 p-3 font-read text-[17.5px] leading-[1.5] focus:outline-none"
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
          <p className="whitespace-pre-wrap font-read text-[17.5px] leading-[1.5]">
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
          <p className="whitespace-pre-wrap font-read text-[17.5px] leading-[1.5]">
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
        <p className="mt-2.5 flex items-baseline gap-2 text-[13px] leading-snug text-ink">
          <span aria-hidden className="inline-block h-[7px] w-[7px] shrink-0 -translate-y-px rounded-full" style={{ background: "var(--state-needs)" }} />
          {firstName} asked if they&apos;re talking to a real person. Answer this one yourself.
        </p>
      )}
      {/* They said no: information, not a task, so no dot. */}
      {item.saidNo && !editing && (
        <p className="mt-2.5 text-[13px] leading-snug text-ink">{firstName} said no. After this reply, FollowUp won&apos;t remind them again.</p>
      )}
      {/* Why it waits, in the owner's words (A-087): what to check, or
          nothing when the every-reply-waits setting is the only reason.
          A price draft's reason is the blank, which the lines above say. */}
      {/* A note to someone staying in touch: why them, in plain words. Information, not a task, so no dot. */}
      {(note || offersBooking) && item.reason && !editing && (
        <p className="mt-2.5 text-[13px] leading-snug text-ink">{item.reason.trim().replace(/\.?$/, ".")}</p>
      )}
      {!note && (checkHint ?? (offersBooking ? null : plainReason)) && !needsPrice && !item.askedIfPerson && !editing && !edited && (
        <p className="mt-2.5 flex items-baseline gap-2 text-[13px] leading-snug text-ink">
          <span aria-hidden className="inline-block h-[7px] w-[7px] shrink-0 -translate-y-px rounded-full" style={{ background: "var(--state-needs)" }} />
          {checkHint ?? plainReason}
        </p>
      )}
      {error && (
        <p className="mt-2 text-[13px]" role="alert" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}

      {/* What to do, in words, right above the buttons it names (A-243, R-113).
          A blank to fill says its own instruction above, so this stays quiet then. */}
      {!send.pending && !priceMissing && (
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
              If it looks right, press <b>Send</b>. To change a word, press <b>Change it</b>.
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
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          {/* Send is the one black button (A-220), the widest in the row on a phone.
              Only admins send (A-041): a teammate keeps Change it. */}
          {!sendLocked && (
            <button
              onClick={sendNow}
              disabled={send.busy || priceMissing || rewriting !== null || !message.trim()}
              className="h-12 flex-1 rounded-full px-6 text-[16px] font-semibold disabled:opacity-60 sm:flex-none sm:px-7"
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
              className="h-12 rounded-full border border-line bg-card px-6 text-[16px] font-medium disabled:opacity-60"
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={send.busy}
              className="h-12 rounded-full border border-line bg-card px-6 text-[16px] font-medium disabled:opacity-60"
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
              className="min-h-11 basis-full text-center text-[14px] text-ink-faint underline underline-offset-[3px] hover:text-ink disabled:opacity-60 sm:ml-auto sm:basis-auto"
            >
              Skip for now
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
  answeredForYou = 0,
  sendLocked = false,
  handledToday = 0,
  holdAll = false,
  weekResults = null,
  plan = null,
}: {
  items: ApprovalItem[];
  /** The rest of the owner's day (A-244): calls to make and times booked for today, in order. */
  rows?: TodayRow[];
  /** Only admins send, and this person isn't one (A-041). */
  sendLocked?: boolean;
  /** Replies FollowUp sent on its own this week — what it did instead of asking. */
  answeredForYou?: number;
  /** People the owner dealt with since their midnight (A-031 / A-046). */
  handledToday?: number;
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
  // the next one takes its place (A-048, the Framer study): leadId -> "Sent to Priya."
  const [leaving, setLeaving] = useState<Record<string, string>>({});
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);
  // The day's numbers, progress and "Done today" are worked out on the
  // server (A-244). After every send they are fetched again, so "5 replies
  // to send" becomes 4 and the bar moves as the owner works; what is on
  // screen here (the open card, a half-written reply) stays as it is.
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
  // One customer at a time in "Do this first" (A-244). "Skip for now" (A-243)
  // moves someone to the back of the line for this visit only; a row in
  // "Still to do today" brings that person up instead. Nothing is saved.
  const [skipped, setSkipped] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const focusRef = useRef<HTMLElement>(null);
  const skip = useCallback((leadId: string) => {
    setPicked(null);
    setSkipped((prev) => [...prev.filter((id) => id !== leadId), leadId]);
  }, []);
  const pick = (leadId: string) => {
    setPicked(leadId);
    focusRef.current?.scrollIntoView({ block: "start" });
  };

  // An empty queue is the state the owner most wants to be in, so it is
  // said out loud, with what FollowUp did instead of asking. Handled here
  // since the page loaded counts too, so the line moves as the owner works.
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
  const selectedFirst = selected ? selected.leadName.split(" ")[0] || selected.leadName : null;
  // The card Today opens with simply is; the next one fades in after a send or skip (A-048).
  const [firstCard] = useState(selected?.leadId ?? null);
  // What the last press did, said for a moment before it goes (A-048).
  const justDone = Object.values(leaving).at(-1) ?? null;
  const others = queue.filter((i) => i.leadId !== selected?.leadId);
  const shown = showAll ? others : others.slice(0, REPLY_ROWS);
  const hidden = others.length - shown.length;
  const stillToDo = others.length + rows.length;

  // "Do this first" (A-244), open from the start (A-250, 2026-10-14): their
  // words, FollowUp's reply and Send (A-243's card), with no tap before it.
  const focus = selected ? (
    <section ref={focusRef} aria-label="Do this first" className="scroll-mt-20 rounded-[18px] lg:scroll-mt-6 bg-card p-4 sm:p-5" style={{ border: "1.5px solid var(--ink)" }}>
      <p className="flex items-center gap-1.5 text-[13.5px] text-ink-soft" role={justDone ? "status" : undefined}>
        {justDone && <Check className="h-4 w-4 shrink-0" style={{ color: "var(--sage)" }} aria-hidden="true" />}
        {justDone ? [justDone, selectedFirst && `Now ${selectedFirst}.`].filter(Boolean).join(" ") : "Do this first"}
      </p>
      <motion.div
        key={selected.leadId}
        className="mt-3"
        initial={selected.leadId === firstCard ? false : { opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: MOTION.move, ease: MOTION.easeOut } }}
      >
        <ApprovalCard
          item={selected}
          bare
          onResolved={resolve}
          sendLocked={sendLocked}
          onSkip={queue.length > 1 ? () => skip(selected.leadId) : undefined}
        />
      </motion.div>
    </section>
  ) : visible.length === 0 || rows.length > 0 ? (
    // A finish line, not a blank (A-046, the Todoist study): said calmly,
    // with what FollowUp keeps doing. No confetti, points or streaks.
    // Faded in only when the owner emptied the list just now; an empty
    // Today on load simply is (no motion without a change of state).
    <motion.div
      initial={items.length > 0 ? { opacity: 0 } : false}
      animate={{ opacity: 1, transition: { duration: MOTION.move, ease: MOTION.easeOut } }}
      className={CARD}
      role="status"
    >
      <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "var(--sage-soft)", color: "var(--sage)" }}>
        <Check className="h-5 w-5" strokeWidth={2.4} />
      </span>
      <p className="mt-2.5 text-[17px] font-semibold tracking-[-0.01em]">
        {rows.length > 0 ? "No replies waiting." : handled > 0 ? "You're done for today." : "You're all caught up."}
      </p>
      <p className="mt-0.5 text-[13.5px] leading-normal text-ink-soft">
        {rows.length > 0
          ? "Your calls and booked times for today are below."
          : handled > 0
            ? `You handled ${handled} ${handled === 1 ? "person" : "people"} today. FollowUp keeps watching, and will tell you when someone writes.`
            : holdAll
              ? "Every reply FollowUp writes shows up here first. Nothing goes out until you send it, apart from a short “let me check” when a price or date question has waited 30 minutes."
              : "Anything FollowUp isn't sure about will show up here before it sends."}
        {rows.length === 0 && answeredForYou > 0 &&
          ` It answered ${answeredForYou} ${answeredForYou === 1 ? "customer" : "customers"} on its own this week.`}
      </p>
      {/* What happens next, by name (research round 2, #2): a plan for what is left quiets it as much as finishing it does. */}
      {rows.length === 0 && plan && <p className="mt-2 text-[13.5px] leading-normal text-ink">{plan}</p>}
      {/* The end of the day is what the owner remembers (peak-end, A-088): real
          outcomes only, nothing when they are all zero. */}
      {rows.length === 0 && weekResults && <p className="mt-2 text-[13px] leading-normal text-ink-soft tabular-nums">{weekResults}</p>}
    </motion.div>
  ) : null;

  return (
    <div>
      {/* Said once, above everything, rather than 48 times on 48 cards. */}
      {summary.fromBeforePermission > 0 && (
        <p className="mb-3 px-1 text-[12.5px] leading-relaxed text-ink-soft">
          {summary.fromBeforePermission} of the drafts waiting were already there before you turned sending on. FollowUp
          left them for you rather than sending them all at once. Send them whenever you&apos;re ready.
        </p>
      )}

      {/* Whole-queue "send the routine ones" (A-006): only when more than
          one source has routine drafts, otherwise it twins the row below. */}
      {summary.safeToSend > 0 && groupsWithRoutine > 1 && (
        <div className={`mb-3 ${CARD} flex flex-wrap items-center justify-between gap-3`}>
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

      {/* Still to do today (A-244): every other reply, call and booked time,
          one row each. A reply row brings that person up into "Do this first". */}
      {stillToDo > 0 && (
        <section aria-label="Next" className="mt-7">
          {/* No count beside it (A-250): the day's box already says how many. */}
          <DayHeading title="Next" />
          <div className={`${DAY_BOX} overflow-hidden`}>
            {shown.map((i, n) => (
              <DayRow key={i.leadId} first={n === 0} row={replyRow(i)} onClick={() => pick(i.leadId)} />
            ))}
            {hidden > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="flex min-h-[52px] w-full items-center gap-3 border-t border-line px-4 py-3 text-left text-[14.5px] font-medium hover:bg-paper"
              >
                <span aria-hidden="true" className="w-9 shrink-0" />
                Show {hidden} more {hidden === 1 ? "reply" : "replies"}
              </button>
            )}
            {rows.map((r, n) => (
              <DayRow key={r.key} row={r} first={shown.length === 0 && n === 0} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** How many other replies "Still to do today" lists before "Show N more replies". */
const REPLY_ROWS = 4;

/** One reply in "Still to do today": who, then why or what they said, and how long they have waited. */
function replyRow(item: ApprovalItem): TodayRow {
  // A note to someone staying in touch (A-260) answers nothing: the row says what it is.
  if (item.trigger === STAY_IN_TOUCH_TRIGGER) {
    return { key: item.leadId, kind: "reply", title: `Note to ${item.leadName}`, sub: "Said yes to hearing from you · waiting for your OK", time: null, href: null };
  }
  // A note for their moment (A-262): the time they named has come.
  if (item.trigger === THEIR_MOMENT_TRIGGER) {
    return { key: item.leadId, kind: "reply", title: `Note to ${item.leadName}`, sub: "Their moment · waiting for your OK", time: null, href: null };
  }
  const what = item.why ?? (item.leadLastMessage ? `“${excerpt(item.leadLastMessage, 48)}”` : null);
  const wait = item.wait ? item.wait.charAt(0).toLowerCase() + item.wait.slice(1) : null;
  return { key: item.leadId, kind: "reply", title: `Reply to ${item.leadName}`, sub: [what, wait].filter(Boolean).join(" · ") || null, time: null, href: null };
}

function excerpt(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}
