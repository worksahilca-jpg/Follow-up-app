"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, Globe, Mail, MessageCircle, Phone } from "lucide-react";
import { WARM_CARD } from "@/components/app/ReplyCard";
import { groupApprovalsBySource, isSafeToSendInBulk, summariseGroups, UNKNOWN_SOURCE_LABEL } from "@/lib/approvalGroups";
import { Eyebrow, Initials } from "@/components/app/canvasBits";
import { QUEUE_PAGE_SIZE, nextStep, visibleCount } from "@/lib/queuePaging";
import { useUndoableSend } from "@/components/useUndoableSend";
import type { PendingApproval } from "@/lib/pendingApprovals";
import SafePileAction from "@/components/SafePileAction";
import SafePilePeek from "@/components/SafePilePeek";
import UndoLine from "@/components/UndoLine";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { MOTION, OPEN_IN_PLACE, RESULT_HOLD_MS } from "@/lib/motion";
import { fillPriceSlot, hasPriceSlot, splitAtPriceSlot } from "@/lib/priceSlot";

/**
 * "Needs your OK" — research/product/2026-09-10-ux-simplification.md
 * §0.6 and §8, implementation plan item #1. This is the missing screen
 * that answers "what needs my OK right now": every lead whose most
 * recent AI decision is a held draft (src/lib/pendingApprovals.ts), each
 * with the actual drafted reply inline and a one-click resolution —
 * Approve & send, Edit (goes to the full lead page), or Don't send.
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
  /** "Waiting 5 h" / "Quiet 6 days" (A-046), worked out on the server. */
  wait?: string | null;
  /** The same fact for the "Start with" line: "who has waited 5 hours". */
  waitClause?: string | null;
  /** When the customer was told the owner is on it, in the business's time (A-060). */
  toldAt?: string | null;
};

const CHANNEL_NAME: Record<string, string> = {
  email: "Email",
  call: "Phone",
  text: "Text",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  messenger: "Messenger",
  web: "Website form",
};

const CHANNEL_LABEL: Record<string, string> = {
  email: "email",
  call: "a call",
  text: "text",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};

/**
 * True on a phone-width screen. The server has no screen, so it says false
 * and the phone opens the first card right after hydrating (TodayCalmPhone:
 * the first customer is open, with the reply in front of the owner).
 */
const PHONE_QUERY = "(max-width: 639px)";
function usePhone(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(PHONE_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false
  );
}

/** The small channel glyph after a name, as the canvas rows draw it. */
function ChannelGlyph({ channel }: { channel: string | null | undefined }) {
  const cls = "h-3.5 w-3.5 shrink-0 text-ink-faint";
  if (channel === "email") return <Mail className={cls} strokeWidth={1.8} aria-label="Email" />;
  if (channel === "call" || channel === "text") return <Phone className={cls} strokeWidth={1.8} aria-label={channel === "call" ? "Phone" : "Text"} />;
  if (channel === "web") return <Globe className={cls} strokeWidth={1.8} aria-label="Website form" />;
  if (channel === "instagram")
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-label="Instagram" role="img">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    );
  if (channel === "whatsapp" || channel === "messenger")
    return <MessageCircle className={cls} strokeWidth={1.8} aria-label={channel === "whatsapp" ? "WhatsApp" : "Messenger"} />;
  return null;
}

function ApprovalCard({
  item,
  onResolved,
  sendLocked = false,
  laterToday = true,
  featured = false,
}: {
  item: ApprovalItem;
  /** The first customer on Today: opens by itself on a phone (TodayCalmPhone). */
  featured?: boolean;
  /** Done with this card. `result` is what happened, said for a moment before it leaves (A-048). */
  onResolved: (leadId: string, result: string | null, sent?: boolean) => void;
  /** Only admins send, and this person isn't one (A-041). */
  sendLocked?: boolean;
  /** Whether "Later today" (2pm) is still ahead in the owner's day (A-046). */
  laterToday?: boolean;
}) {
  const [busy, setBusy] = useState<"send" | "dismiss" | "talked" | "later" | null>(null);
  const firstName = item.leadName.split(" ")[0] || item.leadName;
  // The canvas Today (TodayCalm): each person is one quiet row; Review
  // opens the reply in place.
  const phone = usePhone();
  // null until the owner opens or closes it; the featured card starts open on a phone.
  const [openChoice, setOpen] = useState<boolean | null>(null);
  const open = openChoice ?? (featured && phone);
  const routine = isSafeToSendInBulk(item) && !hasPriceSlot(item.draftMessage);
  // "Later" (A-046): set aside until a time, back by itself or as soon as
  // the customer writes. Not "handled", so it never counts toward the day.
  const [laterOpen, setLaterOpen] = useState(false);
  const [laterUntil, setLaterUntil] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The price blank (A-060): a price question's reply is written with a
  // gap for the figure. Send stays off until it is filled, and the server
  // refuses the blank anyway (src/lib/priceSlot.ts).
  const needsPrice = hasPriceSlot(item.draftMessage);
  const [price, setPrice] = useState("");
  const priceMissing = needsPrice && !price.trim();
  const message = needsPrice ? fillPriceSlot(item.draftMessage, price.trim()) : item.draftMessage;
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
      onResolved(item.leadId, `Sent to ${firstName}.`, true);
    },
    onNetworkError: () => setError("Couldn't reach FollowUp. Check your connection and try again."),
  });

  async function dontSend() {
    setBusy("dismiss");
    setError(null);
    try {
      const res = await fetch(`/api/leads/${item.leadId}/dismiss-hold`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't dismiss it.");
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

  const why = routine
    ? `“${item.draftMessage.replace(/\s+/g, " ").slice(0, 90)}${item.draftMessage.length > 90 ? "…" : ""}”`
    : item.leadLastMessage
      ? `“${item.leadLastMessage.replace(/\s+/g, " ").slice(0, 80)}${item.leadLastMessage.length > 80 ? "…" : ""}”${item.reason ? ` Held because ${item.reason.replace(/\.\s*$/, "")}.` : ""}`
      : item.reason
        ? `Held because ${item.reason.replace(/\.\s*$/, "")}.`
        : "A reply is written for you.";

  return (
    <div>
      <div className="flex items-center gap-3 px-[18px] py-3.5">
        <Initials name={item.leadName} size={30} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[14.5px] font-medium">
            <Link href={`/leads/${item.leadId}`} className="hover:underline">
              {item.leadName}
            </Link>
            <ChannelGlyph channel={item.leadLastMessageChannel} />
          </div>
          {!open && <p className="mt-0.5 text-[13.5px] leading-snug text-ink-soft line-clamp-2">{why}</p>}
          {open && (
            <p className="mt-0.5 text-[13.5px] text-ink-faint">
              {[CHANNEL_NAME[item.leadLastMessageChannel ?? ""] ?? item.source, item.wait?.toLowerCase()].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        {item.wait && (
          <span className="hidden shrink-0 text-right text-[12.5px] text-ink-faint tabular-nums sm:block sm:w-[104px]">{item.wait}</span>
        )}
        {!open && (
          <>
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                setLaterOpen(true);
              }}
              className="hidden h-8 shrink-0 px-2 text-[13px] text-ink-soft sm:block"
            >
              Later
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                if (routine && !sendLocked) send.start();
              }}
              className="h-8 shrink-0 rounded-full px-3.5 text-[13px] font-medium"
              style={{ background: "var(--accent)", color: "var(--on-accent)" }}
            >
              {routine && !sendLocked ? "Send" : "Review"}
            </button>
          </>
        )}
      </div>
      <AnimatePresence initial={false}>
      {open && (
      // Opens from the row it came from (A-048: open in place).
      <motion.div key="open" {...OPEN_IN_PLACE} className="px-[18px] pb-4 sm:pl-[60px]">

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
        <div className="mt-1 leading-relaxed sm:mt-3">
          <p className="sr-only">
            {item.leadName.split(" ")[0]} wrote, over {CHANNEL_LABEL[item.leadLastMessageChannel ?? ""] ?? "message"}:
          </p>
          <p className="whitespace-pre-wrap text-[17px] leading-[1.45] text-ink sm:text-[15px]">{item.leadLastMessage}</p>
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
      <div className="mt-3.5 rounded-[20px] p-4 sm:p-5" style={WARM_CARD}>
        <Eyebrow>{sendLocked ? "Your reply · an admin sends it" : "Your reply · waits for your OK"}</Eyebrow>
        {item.draftSubject && <p className="mt-2 text-[15px] font-medium">{item.draftSubject}</p>}
        {needsPrice ? (
          <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed">
            {splitAtPriceSlot(item.draftMessage).map((part, i) =>
              i === 0 ? (
                <span key={i}>{part}</span>
              ) : (
                <span key={i}>
                  {i === 1 ? (
                    <input
                      id={`price-${item.leadId}`}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      disabled={send.pending || send.busy}
                      placeholder="$ price"
                      aria-label={`The price for ${firstName}`}
                      autoComplete="off"
                      className="mx-0.5 inline-block h-8 w-28 rounded-md border border-dashed bg-card px-2 align-baseline text-ink disabled:opacity-60"
                      style={{ borderColor: price.trim() ? "var(--line)" : "var(--ink-soft)" }}
                    />
                  ) : (
                    <span>{price.trim() || "$ price"}</span>
                  )}
                  {part}
                </span>
              )
            )}
          </p>
        ) : (
          <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed">{item.draftMessage}</p>
        )}
        {priceMissing && <p className="mt-2 text-[13px] text-ink-soft">Add the price, then send. FollowUp never guesses one.</p>}
        {item.reason && !priceMissing && (
          <p className="mt-2 text-[13px] text-ink-soft">Held because {item.reason.replace(/\.\s*$/, "")}.</p>
        )}
        {item.basis && <p className="mt-2 hidden text-[13px] text-ink-soft sm:block">{item.basis}</p>}
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
              style={{ borderColor: "rgba(10,10,10,0.18)", background: "rgba(255,255,255,0.55)" }}
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
                  onClick={send.start}
                  disabled={busy !== null || send.busy || priceMissing}
                  className="h-[52px] flex-1 rounded-full text-base font-semibold disabled:opacity-60 sm:h-11 sm:flex-none sm:px-7"
                  style={{ backgroundColor: "var(--accent)", color: "var(--on-accent)" }}
                >
                  {send.busy ? "Sending…" : "Send"}
                </button>
              )}
              <Link
                href={`/leads/${item.leadId}`}
                className="inline-flex h-[52px] w-24 items-center justify-center rounded-full border text-base font-medium sm:h-11"
                style={{ borderColor: "rgba(10,10,10,0.18)", background: "rgba(255,255,255,0.55)" }}
              >
                Edit
              </Link>
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-6 sm:justify-start sm:gap-x-4">
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
              <button
                onClick={() => weTalked(false)}
                disabled={busy !== null || send.busy}
                title={`You spoke with ${firstName} on a call or in person. FollowUp stops checking in until they write again.`}
                className="flex min-h-11 items-center text-sm text-ink-soft disabled:opacity-60"
              >
                {busy === "talked" ? "…" : "We talked"}
              </button>
            </div>
          </>
        )}
      </div>
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
      <button type="button" onClick={() => { setOpen(false); setLaterOpen(false); }} className="mt-3 text-[13px] text-ink-faint hover:text-ink-soft">
        Close
      </button>
      </motion.div>
      )}
      </AnimatePresence>
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
  waitingOn = 0,
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
  /** Customers we answered who haven't answered back (A-050). */
  waitingOn?: number;
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
  // Sent from this list: those customers are now waiting on themselves (A-050).
  const [sentHere, setSentHere] = useState(0);
  const resolve = useCallback((leadId: string, result: string | null, sent?: boolean) => {
    if (sent) setSentHere((n) => n + 1);
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
  /**
   * How many needs-you cards each source has been asked to show.
   *
   * Keyed by source name, absent meaning QUEUE_PAGE_SIZE — so a source
   * that appears later (the owner connects Instagram, a first DM lands)
   * starts folded like every other, with no entry to seed.
   *
   * A COUNT and not a set of ids, which is what makes the pile behave
   * like a queue: resolve the top card and the sixth rises into view by
   * itself, because slice(0, 5) now lands one further down a shorter
   * list. A set of "revealed ids" would leave a hole instead.
   */
  const [expanded, setExpanded] = useState<Record<string, number>>({});

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
      <PlacesLine needsYou={0} waitingOn={waitingOn + sentHere} handled={handled} />
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
          <p className="font-medium">{done ? "You're done for today." : "Nothing needs your OK right now."}</p>
          <p className="mt-1 text-sm text-ink-soft">
            {done
              ? `You handled ${handled} ${handled === 1 ? "person" : "people"} today. FollowUp keeps watching, and will tell you when someone writes.`
              : "Anything FollowUp isn't sure about will show up here before it sends."}
            {answeredForYou > 0 &&
              ` It answered ${answeredForYou} ${answeredForYou === 1 ? "customer" : "customers"} on its own this week.`}
          </p>
        </div>
      </motion.div>
      </>
    );
  }

  /*
   * Grouped by source, ordered so the first thing on screen is the thing
   * to deal with first — see @/lib/approvalGroups for the ordering and
   * for what "safe" is allowed to mean.
   *
   * Structure follows A-006 and avoids S-09: the SOURCE is a heading, not
   * a box, so the cards inside it stay the only box level. A box per
   * source with boxes inside it is the card-in-card soup the design brain
   * names, and it was already fixed here once.
   */
  const groups = groupApprovalsBySource(visible);
  const summary = summariseGroups(groupApprovalsBySource(active));
  // How many sources actually contribute a routine draft — not how many
  // groups exist. A group that is all needs-you has no routine row, so
  // counting groups would keep the whole-queue box on screen beside a
  // single routine row and reintroduce the twin buttons.
  const groupsWithRoutine = groups.filter((g) => g.safeToSend.length > 0).length;
  const focusWait = summary.focusOn ? active.find((i) => i.leadId === summary.focusOn?.leadId)?.waitClause ?? null : null;
  const total = handled + active.length;
  // The first customer on screen, opened by itself on a phone (TodayCalmPhone).
  const firstNeedsYou = groups.flatMap((g) => g.needsYou).find((i) => !leaving[i.leadId])?.leadId ?? null;

  return (
    <div className="mt-2">
      {/* The canvas Today: who to start with, how far through the day,
          then the three places (A-046, A-050). */}
      {summary.focusOn ? (
        <p className="text-base leading-relaxed">
          Start with{" "}
          <Link href={`/leads/${summary.focusOn.leadId}`} className="font-semibold hover:underline">
            {summary.focusOn.leadName.split(" ")[0]}
          </Link>
          {focusWait ? `, ${focusWait}.` : ` on ${summary.focusOn.source}.`}
        </p>
      ) : (
        <p className="text-base text-ink-soft">Nothing here needs a decision. The rest are routine.</p>
      )}
      {/* Today has an end (A-031, A-046). Desktop only: the phone gets less (R-015). */}
      <div className="mt-[18px] hidden sm:block max-w-[520px]">
        <div className="h-[3px] rounded-full" style={{ backgroundColor: "var(--line-2)" }}>
          <div
            className="h-[3px] rounded-full"
            style={{ width: `${total > 0 ? Math.round((100 * handled) / total) : 0}%`, backgroundColor: "var(--ink)" }}
          />
        </div>
        <p className="mt-2 text-[13px] text-ink-faint tabular-nums">
          <span className="text-ink font-medium">
            {handled} of {total}
          </span>{" "}
          handled today · When the list is empty, you&apos;re done for today.
          {setAside > 0 && ` ${setAside} set aside for later.`}
        </p>
      </div>
      <PlacesLine needsYou={active.length} waitingOn={waitingOn + sentHere} handled={handled} />

      {/* Said once, above everything, rather than 48 times on 48 cards.
          The cards still carry their own sentence — this is the line that
          stops an owner concluding the product is repeating itself before
          they have read the second one. */}
      {summary.fromBeforePermission > 0 && (
        <p className="mt-2 text-xs text-ink-soft leading-relaxed">
          {/* "of the drafts below", not "of these". This line sits under
              the "Needs your OK (N)" heading and counts BOTH piles, so
              "2 of these" under a heading reading (1) read as the screen
              contradicting itself. Caught by rendering it; the number was
              right and the word it attached to was not. */}
          {summary.fromBeforePermission} of the drafts below were already waiting before you turned sending on. FollowUp
          left them for you rather than sending them all at once — send them whenever you&apos;re ready.
        </p>
      )}

      {/* The one accented control on the screen (A-006: the accent is
          spent once, on the single thing to act on). Whole-queue rather
          than per-source, because an owner facing hundreds wants the
          routine ones gone so they can see what is left — the per-source
          buttons below are for when they do care which channel.

          Suppressed when every routine draft came from ONE source,
          because then this box and that source's row are the same
          button, one above the other, both reading "Send all 12". Two
          identical controls is not a choice, it is a question about
          whether they differ — and the answer is that they don't.
          Caught by rendering a single-source queue; the counts were
          right and the screen asked the owner to pick between twins. */}
      {summary.safeToSend > 0 && groupsWithRoutine > 1 && (
        <div className="mt-4 box px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <p className="font-medium">
              {summary.safeToSend} {summary.safeToSend === 1 ? "draft is" : "drafts are"} routine.
            </p>
            <p className="mt-0.5 text-xs text-ink-soft">
              FollowUp checked each one and found nothing that needs a decision. Nothing goes out until you press.
            </p>
          </div>
          {!sendLocked && <SafePileAction count={summary.safeToSend} source={null} accent />}
        </div>
      )}

      <div className="mt-7 mb-2.5 hidden items-center justify-between sm:flex">
        <Eyebrow>Needs you · {summary.needsYou}</Eyebrow>
        <span className="text-[12.5px] text-ink-faint">Longest waiting first</span>
      </div>
      <LayoutGroup>
      <div className="flex flex-col gap-6 relative">
        {groups.map((group) => {
          const shownHere = visibleCount(group.needsYou.length, expanded[group.source] ?? QUEUE_PAGE_SIZE);
          const hiddenHere = group.needsYou.length - shownHere;
          // Not counting a card that is saying "Sent to Priya" on its way out.
          const needHere = group.needsYou.filter((i) => !leaving[i.leadId]).length;
          return (
          <motion.section key={group.source} layout="position" transition={{ layout: MOTION.layout }}>
            {/* Dense heading, not a box — see the note above. */}
            <div className={(groups.length > 1 ? "flex" : "hidden") + " mb-2 flex-wrap items-baseline justify-between gap-2"}>
              <h3 className="text-sm font-medium">{group.source}</h3>
              <p className="text-xs text-ink-soft tabular-nums">
                {needHere > 0 && `${needHere} need${needHere === 1 ? "s" : ""} you`}
                {needHere > 0 && group.safeToSend.length > 0 && " · "}
                {group.safeToSend.length > 0 && `${group.safeToSend.length} routine`}
              </p>
            </div>

            <div className="relative flex flex-col overflow-hidden rounded-2xl border border-line bg-card divide-y divide-[var(--line-2)]">
              {/* A-048: a finished card folds into what happened, then
                  leaves, and the cards below slide up into its place
                  rather than jumping. Position only, so nothing is
                  stretched; reduced motion skips all of it. */}
              <AnimatePresence initial={false} mode="popLayout">
                {group.needsYou.slice(0, shownHere).map((item) => (
                  <motion.div
                    key={item.leadId}
                    layout="position"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: { duration: MOTION.move, ease: MOTION.easeOut } }}
                    exit={{ opacity: 0, transition: { duration: MOTION.exit, ease: MOTION.easeIn } }}
                    transition={{ layout: MOTION.layout }}
                  >
                    {leaving[item.leadId] ? (
                      <div className="px-[18px] py-3.5 flex items-center gap-2 text-sm text-ink-soft" role="status">
                        <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {leaving[item.leadId]}
                      </div>
                    ) : (
                      <ApprovalCard item={item} onResolved={resolve} sendLocked={sendLocked} laterToday={laterToday} featured={item.leadId === firstNeedsYou} />
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* The folded tail. Same row shape as the routine pile
                  below it — a sentence, the best name in it, and one
                  control — because they are the same kind of thing: a
                  count standing in for cards nobody needs on screen yet.

                  The section heading above still reports the true total,
                  so nothing here hides how much is waiting; it only
                  declines to draw it. */}
              {hiddenHere > 0 && (
                <motion.div layout="position" transition={{ layout: MOTION.layout }} className="px-[18px] py-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-ink-soft">
                    {hiddenHere} more {hiddenHere === 1 ? "needs" : "need"} your OK
                    {group.needsYou[shownHere] && (
                      <span className="text-ink"> — next is {group.needsYou[shownHere].leadName}</span>
                    )}
                  </p>
                  <button
                    onClick={() =>
                      setExpanded((prev) => ({ ...prev, [group.source]: shownHere + QUEUE_PAGE_SIZE }))
                    }
                    className="rounded-lg px-3.5 py-1.5 text-sm font-medium border border-line hover:bg-paper"
                  >
                    {/* Counted, not assumed: QUEUE_TAIL_TOLERANCE means
                        one press often reveals more than the page size,
                        and a button that overstates what it will do is
                        the kind of small lie this product cannot afford. */}
                    Show {nextStep(group.needsYou.length, shownHere)} more
                  </button>
                </motion.div>
              )}

              {group.safeToSend.length > 0 && (
                <motion.div layout="position" transition={{ layout: MOTION.layout }} className="px-[18px] py-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-ink-soft">
                    {group.safeToSend.length} routine {group.safeToSend.length === 1 ? "draft" : "drafts"}
                    {group.source === UNKNOWN_SOURCE_LABEL ? " added by hand" : ` from ${group.source}`}
                    {group.safeToSend[0] && <span className="text-ink"> — top is {group.safeToSend[0].leadName}</span>}
                  </p>
                  {!sendLocked && <SafePileAction count={group.safeToSend.length} source={group.source} />}
                  {/* Full width, so opening it drops the sample below the
                      row rather than squeezing it between the sentence
                      and the button. Closed it is just a link at the end
                      of the row and costs a line of nothing. */}
                  <SafePilePeek items={group.safeToSend} />
                </motion.div>
              )}
            </div>
          </motion.section>
          );
        })}
      </div>
      </LayoutGroup>
    </div>
  );
}

/**
 * The three places a conversation can be (A-050, the Close study): needs
 * you, waiting on the customer, handled. Every customer is in exactly one.
 * Live, so it moves as the owner works. The phone gets the short form
 * (R-015): the queue below already says what needs them.
 */
function PlacesLine({ needsYou, waitingOn, handled }: { needsYou: number; waitingOn: number; handled: number }) {
  // A new account has nothing in any place yet: say nothing rather than three zeros.
  if (needsYou + waitingOn + handled === 0) return null;
  return (
    <>
      <p className="mt-5 hidden sm:block border-y border-line-2 py-3 max-w-[760px] text-sm text-ink-soft tabular-nums">
        Needs you <span className="text-ink font-medium">{needsYou}</span>
        <span aria-hidden="true"> · </span>
        <Link href="/waiting" className="hover:underline underline-offset-4">
          Waiting on customers <span className="text-ink font-medium">{waitingOn}</span>
        </Link>
        <span aria-hidden="true"> · </span>
        Handled today <span className="text-ink font-medium">{handled}</span>
      </p>
      <p className="mt-3 hidden text-sm text-ink-soft tabular-nums">
        <Link href="/waiting" className="underline-offset-4 hover:underline">
          {waitingOn} waiting on customers
        </Link>
        {" · "}
        {handled} handled today
      </p>
    </>
  );
}
