import { Zap, Clock, PauseCircle, Ban, CheckCircle2, Workflow, PlugZap, PenLine } from "lucide-react";
import type { AutomationStatus } from "@/lib/automationStatus";

// One line of "why," shown as the badge's title tooltip (compact mode) or
// its own line underneath (full mode) — the whole point of this component
// is that a business owner should never have to ask "why hasn't this sent"
// the way task #63's real test lead sat unexplained for hours.
const REASON_LABEL: Record<"unanswered" | "dead_lead" | "silence", string> = {
  unanswered: "they wrote and haven't heard back",
  dead_lead: "gone cold — reactivation campaign",
  silence: "gone quiet — due for a follow-up",
};

// The caller already filters out "closed" (and undefined) before this is
// called — excluded here too so the switch below is provably exhaustive
// over what it actually receives, instead of needing a dead branch.
//
// Exported for its tests, which assert on the SHIPPED sentences rather
// than a copy of them: this file's job is one line of honest prose per
// state, and a test that restated the prose would pass while the prose
// drifted. Same reason describeAckOutcome is exported from LeadTrustPanel.
export function describeAutomationStatus(
  status: Exclude<AutomationStatus, { kind: "closed" }>
): { icon: typeof Zap; label: string; detail?: string; bg: string; fg: string; pulse?: boolean; emphasis?: boolean } {
  switch (status.kind) {
    case "workflow":
      return {
        icon: Workflow,
        label: "On a follow-up plan",
        detail: status.dueInDays === 0 ? `${status.sequenceName} — next step today` : `${status.sequenceName} — next step in ${status.dueInDays}d`,
        bg: "var(--slate-soft)",
        fg: "var(--slate)",
      };
    case "workflow_paused":
      return { icon: PauseCircle, label: "Follow-up plan paused", detail: status.sequenceName, bg: "var(--line)", fg: "var(--ink-soft)" };
    case "off":
      return { icon: Ban, label: "Automation off", detail: "This lead is opted out of automated follow-up", bg: "var(--line)", fg: "var(--ink-soft)" };
    // Three coral states in a row — no_send_channel, ai_paused,
    // account_paused — and that is deliberate, not an oversight. To the
    // owner they are one family: nothing is happening, and only they can
    // change it. What separates them is the sentence, which is the whole
    // point of each.
    //
    // Account-wide, shown per lead, because the lead is where the false
    // promise was. The detail names the FIX rather than the diagnosis:
    // "no send channel" is our words for it, "connect an inbox" is the
    // thing to do.
    case "no_send_channel":
      return {
        icon: PlugZap,
        label: "Nothing is connected to send with",
        detail:
          "FollowUp can capture leads but has no way to reply to them — no inbox, no Instagram, no WhatsApp, no number. Connect one in Settings and follow-ups start on their own.",
        bg: "var(--coral-soft)",
        fg: "var(--coral)",
        // Same reasoning as ai_paused: the label states that something
        // stopped, and the sentence is the answer.
        emphasis: true,
      };
    // `detail` is the reason verbatim (src/lib/billing.ts writes it as a
    // complete sentence for exactly this spot) rather than a template
    // wrapped around a fragment, so this wording lives in one place.
    case "ai_paused":
      return {
        icon: PauseCircle,
        // Short enough to survive the compact pill in a list row, and it
        // makes no claim about where the explanation sits — an earlier
        // draft said "see why below", which is only true on the detail
        // page and false in FollowUpCard.
        label: "Paused on this lead",
        detail: status.reason,
        bg: "var(--coral-soft)",
        fg: "var(--coral)",
        // Every other status here has a self-explanatory label with the
        // detail as a footnote, so 12px is right for them. This one
        // inverts that: the label only says that something stopped, and
        // the sentence IS the answer the owner opened the lead to find.
        // Setting the product's most important sentence in its smallest
        // type would undo the point of showing it at all.
        emphasis: true,
      };
    case "account_paused":
      return {
        icon: PauseCircle,
        label: "Paused — your auto follow-up is switched off",
        // Naming only the master switch was a half-instruction on a
        // holding account: turning it on gets a draft written, not a
        // message sent, and an owner who followed the sentence and saw
        // nothing reach their customer would have been told the wrong
        // thing by the badge built to stop exactly that.
        detail: status.heldForApproval
          ? `This would be drafted for your approval now (${REASON_LABEL[status.reason]}), but auto follow-up is off for your whole account — turn on "Auto follow-up on silence" in Settings.`
          : `This would be followed up now (${REASON_LABEL[status.reason]}), but auto follow-up is off for your whole account — turn on "Auto follow-up on silence" in Settings.`,
        bg: "var(--coral-soft)",
        fg: "var(--coral)",
      };
    // The one that mattered most. "Following up soon" is what this badge
    // said on every account from 2026-09-21, when holdAllForApproval
    // became `@default(true)` — on a lead whose reply was about to be
    // written and then held. Not paused (a draft really is coming, and
    // saying "paused" would push an owner to go fix something that isn't
    // broken) and not following up (nothing reaches the customer). The
    // true state is the one an owner can act on: a draft is coming, and
    // it needs them.
    case "due_soon":
      if (status.heldForApproval) {
        return {
          icon: PenLine,
          label: "Writing a reply for you to approve",
          detail: `Next automation check drafts this — ${REASON_LABEL[status.reason]}. It waits in your approvals until you send it.`,
          bg: "var(--rust-soft)",
          fg: "var(--rust)",
          pulse: true,
        };
      }
      return {
        icon: Zap,
        label: "Following up soon",
        detail: `Next automation check will pick this up — ${REASON_LABEL[status.reason]}`,
        bg: "var(--rust-soft)",
        fg: "var(--rust)",
        pulse: true,
      };
    case "waiting":
      // "Next check in ~3h" is literally true either way, but on a
      // holding account an owner reads it as "sending in 3h". Naming the
      // draft costs one word and removes the inference.
      return {
        icon: Clock,
        label: status.heldForApproval
          ? status.etaHours
            ? `Draft ready in ~${status.etaHours}h`
            : "Not due yet"
          : status.etaHours
            ? `Next check in ~${status.etaHours}h`
            : "Not due yet",
        bg: "var(--slate-soft)",
        fg: "var(--slate)",
      };
    case "sent":
      return { icon: CheckCircle2, label: "Waiting on their reply", bg: "var(--sage-soft)", fg: "var(--sage)" };
  }
}

/**
 * "What is FollowUp doing with this lead, and why" — see
 * src/lib/automationStatus.ts for how the status itself is computed.
 * `compact` (list rows) shows an icon-led pill with the full reasoning in
 * its title tooltip; the default (lead detail page) also prints that
 * reasoning as its own line, since a detail page has the room and this is
 * exactly the "why is nothing happening" answer a business owner opens the
 * lead to find.
 */
export default function AutomationStatusBadge({ status, compact = false }: { status: AutomationStatus | undefined; compact?: boolean }) {
  if (!status || status.kind === "closed") return null;
  const { icon: Icon, label, detail, bg, fg, pulse, emphasis } = describeAutomationStatus(status);

  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ backgroundColor: bg, color: fg }}
        title={detail ?? label}
      >
        {pulse ? <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: fg }} /> : <Icon className="h-3 w-3" />}
        {label}
      </span>
    );
  }

  return (
    <div className="rounded-lg px-3 py-2.5" style={{ backgroundColor: bg }}>
      <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: fg }}>
        {pulse ? <span className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: fg }} /> : <Icon className="h-4 w-4" />}
        {label}
      </div>
      {detail && (
        <p className={`mt-1 leading-relaxed ${emphasis ? "text-sm" : "text-xs"}`} style={{ color: fg }}>
          {detail}
        </p>
      )}
    </div>
  );
}
