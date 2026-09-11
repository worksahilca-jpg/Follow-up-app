import { Zap, Clock, PauseCircle, Ban, CheckCircle2, Workflow } from "lucide-react";
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
function describe(
  status: Exclude<AutomationStatus, { kind: "closed" }>
): { icon: typeof Zap; label: string; detail?: string; bg: string; fg: string; pulse?: boolean } {
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
    case "account_paused":
      return {
        icon: PauseCircle,
        label: "Paused — your auto follow-up is switched off",
        detail: `This would be followed up now (${REASON_LABEL[status.reason]}), but auto follow-up is off for your whole account — turn on "Auto follow-up on silence" in Settings.`,
        bg: "var(--coral-soft)",
        fg: "var(--coral)",
      };
    case "due_soon":
      return {
        icon: Zap,
        label: "Following up soon",
        detail: `Next automation check will pick this up — ${REASON_LABEL[status.reason]}`,
        bg: "var(--rust-soft)",
        fg: "var(--rust)",
        pulse: true,
      };
    case "waiting":
      return {
        icon: Clock,
        label: status.etaHours ? `Next check in ~${status.etaHours}h` : "Not due yet",
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
  const { icon: Icon, label, detail, bg, fg, pulse } = describe(status);

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
        <p className="mt-1 text-xs leading-relaxed" style={{ color: fg }}>
          {detail}
        </p>
      )}
    </div>
  );
}
