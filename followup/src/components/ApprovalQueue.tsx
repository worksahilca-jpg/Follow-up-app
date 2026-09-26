"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { groupApprovalsBySource, summariseGroups, UNKNOWN_SOURCE_LABEL } from "@/lib/approvalGroups";
import { QUEUE_PAGE_SIZE, nextStep, visibleCount } from "@/lib/queuePaging";
import { useUndoableSend } from "@/components/useUndoableSend";
import type { PendingApproval } from "@/lib/pendingApprovals";
import SafePileAction from "@/components/SafePileAction";
import SafePilePeek from "@/components/SafePilePeek";

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
export type ApprovalItem = PendingApproval;

const CHANNEL_LABEL: Record<string, string> = {
  email: "email",
  call: "a call",
  text: "text",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};

function ApprovalCard({
  item,
  onResolved,
  sendLocked = false,
}: {
  item: ApprovalItem;
  onResolved: (leadId: string) => void;
  /** Only admins send, and this person isn't one (A-041). */
  sendLocked?: boolean;
}) {
  const [busy, setBusy] = useState<"send" | "dismiss" | "talked" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // "We talked" (design brain A-039): the card stays for a few seconds
  // saying what happened, with Undo, then leaves the queue.
  const [talked, setTalked] = useState(false);
  useEffect(() => {
    if (!talked) return;
    const timer = setTimeout(() => onResolved(item.leadId), 8000);
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
      message: item.draftMessage,
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
      onResolved(item.leadId);
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
      onResolved(item.leadId);
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

  const firstName = item.leadName.split(" ")[0] || item.leadName;
  if (talked) {
    return (
      <div className="box px-4 py-4 flex flex-wrap items-center justify-between gap-3" role="status">
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

  return (
    <div className="box px-4 py-4">
      <Link href={`/leads/${item.leadId}`} className="font-medium hover:underline">
        {item.leadName}
      </Link>
      {/* The reason moves directly under the name, above everything else. It
          used to render last, at 12px, after the draft — but the reason is
          what tells you what to check the draft FOR. Reading it afterwards
          means re-reading the draft, or approving without having done the one
          piece of judgement you were asked for.

          Also no longer lowercased mid-sentence: `.toLowerCase()` on the most
          trust-critical string in the product mangled names and acronyms, and
          paired with a trailing period after a reason that already ended in
          one, it produced "Held because the lead asked about pricing.." */}
      {item.reason && (
        <p className="mt-1 text-xs text-ink-soft">
          Held because {item.reason.replace(/\.\s*$/, "")}.
        </p>
      )}
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
        <div className="mt-3 text-sm leading-relaxed">
          <p className="text-xs font-medium text-ink-soft">
            {item.leadName.split(" ")[0]} said, over {CHANNEL_LABEL[item.leadLastMessageChannel ?? ""] ?? "message"}:
          </p>
          <p className="text-ink whitespace-pre-wrap mt-1">{item.leadLastMessage}</p>
        </div>
      )}
      <div className="mt-3 pt-3 border-t border-line text-sm leading-relaxed">
        <p className="text-xs font-medium text-ink-soft">The draft reply:</p>
        {item.draftSubject && <p className="font-medium mt-1">{item.draftSubject}</p>}
        <p className="text-ink-soft whitespace-pre-wrap mt-1">{item.draftMessage}</p>
      </div>
      {error && (
        <p className="text-xs mt-1.5" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
      {/* The grace period replaces the whole button row, rather than
          sitting beside it. Same decision as the routine pile: one
          control at a time, and while the clock is running the only
          thing to press is the one that stops it. Leaving Edit and
          Don't-send alive here would offer two more ways to act on a
          draft that is already on its way out. */}
      {send.pending ? (
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <p className="text-sm">
            {/* Present tense, and the lead's own first name — this row
                can be one of three on screen, and "Sending in 7s" with
                no name does not say which draft is leaving. */}
            Sending to {item.leadName.split(" ")[0]} in {send.secs}s
          </p>
          <button
            onClick={send.undo}
            className="rounded-lg px-3 py-1.5 text-sm font-medium border"
            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
          >
            Undo
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {/* Only admins send (A-041): a teammate keeps Edit, We talked and
              Don't send, and is told who sends instead of seeing a button
              the server would refuse. */}
          {sendLocked ? (
            <span className="text-sm text-ink-soft mr-1">An admin sends this one.</span>
          ) : (
            <button
              onClick={send.start}
              disabled={busy !== null || send.busy}
              className="rounded-lg px-3.5 py-1.5 text-sm font-medium disabled:opacity-60"
              style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
            >
              {send.busy ? "Sending…" : "Approve & send"}
            </button>
          )}
          <Link
            href={`/leads/${item.leadId}`}
            className="rounded-lg px-3.5 py-1.5 text-sm font-medium border border-line hover:bg-paper"
          >
            Edit
          </Link>
          <button
            onClick={() => weTalked(false)}
            disabled={busy !== null || send.busy}
            title={`You spoke with ${firstName} on a call or in person. FollowUp stops checking in until they write again.`}
            className="rounded-lg px-3.5 py-1.5 text-sm font-medium text-ink-soft hover:bg-paper disabled:opacity-60"
          >
            {busy === "talked" ? "…" : "We talked"}
          </button>
          <button
            onClick={dontSend}
            disabled={busy !== null || send.busy}
            className="rounded-lg px-3.5 py-1.5 text-sm font-medium text-ink-soft hover:bg-paper disabled:opacity-60"
          >
            {busy === "dismiss" ? "…" : "Don't send"}
          </button>
        </div>
      )}
      {/* Says what IS true (nothing left) rather than "Cancelled", which
          describes the press instead of the outcome. */}
      {send.cancelled && <p className="mt-1.5 text-xs text-ink-soft">Stopped — nothing was sent.</p>}
    </div>
  );
}

export default function ApprovalQueue({
  items,
  answeredForYou = 0,
  sendLocked = false,
}: {
  items: ApprovalItem[];
  /** Only admins send, and this person isn't one (A-041). */
  sendLocked?: boolean;
  /** Replies FollowUp sent on its own this week — what it did instead of asking. */
  answeredForYou?: number;
}) {
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const visible = items.filter((i) => !resolved.has(i.leadId));
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
  if (visible.length === 0) {
    return (
      <div className="mt-6">
        <div
          className="relative box py-3 pl-4 pr-3"
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-[3px] rounded-l-[var(--radius-box)]"
            style={{ backgroundColor: "var(--sage)" }}
          />
          <p className="text-sm font-medium">Nothing needs your OK right now.</p>
          <p className="mt-1 text-xs text-ink-soft">
            {answeredForYou > 0
              ? `FollowUp answered ${answeredForYou} ${answeredForYou === 1 ? "lead" : "leads"} on its own this week. Anything it wasn't sure about would be here.`
              : "Anything FollowUp isn't sure about will show up here before it sends."}
          </p>
        </div>
      </div>
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
  const summary = summariseGroups(groups);
  // How many sources actually contribute a routine draft — not how many
  // groups exist. A group that is all needs-you has no routine row, so
  // counting groups would keep the whole-queue box on screen beside a
  // single routine row and reintroduce the twin buttons.
  const groupsWithRoutine = groups.filter((g) => g.safeToSend.length > 0).length;

  return (
    <div className="mt-6">
      <h2 className="font-display text-xl flex items-center gap-2">
        <ShieldCheck className="h-4 w-4" style={{ color: "var(--ink)" }} />
        Needs your OK ({summary.needsYou})
      </h2>

      {/* The answer to "whom do I focus on", said in words rather than
          left for the reader to infer from the order. Derived from the
          ordered groups, so it can never name a lead the list does not
          show first. */}
      {summary.focusOn ? (
        <p className="text-sm text-ink-soft mt-1">
          Start with{" "}
          <Link href={`/leads/${summary.focusOn.leadId}`} className="font-medium text-ink hover:underline">
            {summary.focusOn.leadName}
          </Link>{" "}
          — {summary.focusOn.source}, scored {summary.focusOn.score}.
        </p>
      ) : (
        <p className="text-sm text-ink-soft mt-1">
          Nothing here needs a decision — the rest are routine.
        </p>
      )}

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

      <div className="mt-6 flex flex-col gap-6">
        {groups.map((group) => {
          const shownHere = visibleCount(group.needsYou.length, expanded[group.source] ?? QUEUE_PAGE_SIZE);
          const hiddenHere = group.needsYou.length - shownHere;
          return (
          <section key={group.source}>
            {/* Dense heading, not a box — see the note above. */}
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-medium">{group.source}</h3>
              <p className="text-xs text-ink-soft tabular-nums">
                {group.needsYou.length > 0 && `${group.needsYou.length} need${group.needsYou.length === 1 ? "s" : ""} you`}
                {group.needsYou.length > 0 && group.safeToSend.length > 0 && " · "}
                {group.safeToSend.length > 0 && `${group.safeToSend.length} routine`}
              </p>
            </div>

            <div className="mt-2 flex flex-col gap-2">
              {group.needsYou.slice(0, shownHere).map((item) => (
                <ApprovalCard
                  key={item.leadId}
                  item={item}
                  onResolved={(leadId) => setResolved((prev) => new Set(prev).add(leadId))}
                  sendLocked={sendLocked}
                />
              ))}

              {/* The folded tail. Same row shape as the routine pile
                  below it — a sentence, the best name in it, and one
                  control — because they are the same kind of thing: a
                  count standing in for cards nobody needs on screen yet.

                  The section heading above still reports the true total,
                  so nothing here hides how much is waiting; it only
                  declines to draw it. */}
              {hiddenHere > 0 && (
                <div className="box px-4 py-3 flex flex-wrap items-center justify-between gap-3">
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
                </div>
              )}

              {group.safeToSend.length > 0 && (
                <div className="box px-4 py-3 flex flex-wrap items-center justify-between gap-3">
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
                </div>
              )}
            </div>
          </section>
          );
        })}
      </div>
    </div>
  );
}
