import { ShieldCheck, ShieldAlert, History } from "lucide-react";
import { deriveConsentBasis } from "@/lib/consent";
import { formatDate } from "@/lib/demo-data";
import type { LeadAuditTrail } from "@/lib/leads-data";

/**
 * Synthesis rec #2 (research/market/2026-09-08-product-direction-
 * synthesis.md): the consent basis and AI audit trail were already real,
 * written data (task #67) — Lead.source, Lead.optedOutAt, AuditEvent —
 * with no UI reading any of it. This is that UI: a plain-English answer
 * to "why is this contact okay" plus a chronological "what did the AI
 * actually do to this lead" log, on the one page a business owner
 * already looks at per lead. No new fields, no migration — every input
 * here was already being written before this component existed.
 */

const ACTION_COPY: Record<string, (meta: Record<string, unknown> | null) => { label: string; detail?: string }> = {
  "lead.send": () => ({ label: "You sent a message", detail: "Reviewed and sent by your team" }),
  "ai.send": (meta) => ({
    label: "FollowUp sent a message automatically",
    detail: [describeTrigger(meta, "sent"), describeAckOutcome(meta)].filter(Boolean).join(" ") || undefined,
  }),
  "ai.hold": (meta) => ({
    label: "FollowUp drafted a reply and held it for review",
    detail: (meta?.reason as string) || describeTrigger(meta, "held"),
  }),
};

/**
 * Task #63's live test kept showing a generic acknowledgement to a
 * clearly-engaged lead, with nothing on this page saying why. The instant
 * ack (src/lib/acknowledge.ts) now merges its own decision into this same
 * "ai.send" event (source: "generated" | "fallback", reason) — this turns
 * that decision into the one sentence a business owner actually needs:
 * did the AI answer specifically, or fall back to the safe line, and why.
 * Silent when a specific reply went out — that's the expected case and
 * doesn't need explaining.
 */
export function describeAckOutcome(meta: Record<string, unknown> | null): string | undefined {
  if (meta?.trigger !== "instant_ack" || meta?.source !== "fallback") return undefined;
  const reason = (meta?.reason as string) || "";
  if (reason === "generation failed") return "Used the safe default reply — the specific one failed to generate.";
  if (reason === "no inbound text") return "Used the safe default reply — nothing specific to respond to yet.";
  if (reason === "risk check failed") return "Used the safe default reply — the safety check itself failed to run.";
  const shapeMatch = /^shape: (.+)$/.exec(reason);
  if (shapeMatch) return `Held back the specific reply — it didn't pass an automatic safety check (${shapeMatch[1]}).`;
  const notOkMatch = /^ack not_ok:\s*(.*)$/.exec(reason);
  if (notOkMatch) {
    const explanation = notOkMatch[1];
    return `Held back the specific reply as not safe enough to send unreviewed${explanation ? ` — ${explanation}` : ""}.`;
  }
  // Legacy rows from before this gate was rewritten (research/product/
  // 2026-09-10-instant-ack-safety-gate.md) — the old assessSendRisk-based
  // gate recorded "risk <level>: <explanation>". Kept so a lead's older
  // audit history still renders a sentence instead of the generic line.
  const legacyRiskMatch = /^risk \w+:\s*(.*)$/.exec(reason);
  if (legacyRiskMatch) {
    const explanation = legacyRiskMatch[1];
    return `Held back the specific reply as not safe enough to send unreviewed${explanation ? ` — ${explanation}` : ""}.`;
  }
  return "Used the safe default reply.";
}

function describeTrigger(meta: Record<string, unknown> | null, verb: "sent" | "held"): string | undefined {
  const trigger = meta?.trigger as string | undefined;
  const channel = meta?.channel as string | undefined;
  const map: Record<string, string> = {
    instant_ack: "the instant acknowledgement sent to every new lead",
    unanswered: "this lead replied and nobody followed up",
    silence: "this lead had gone quiet",
    sequence: "a scheduled workflow step",
    manual: "a manual trigger",
  };
  const reason = trigger ? map[trigger] : undefined;
  if (!reason && !channel) return undefined;
  const parts = [channel ? `via ${channel}` : null, reason ? `— ${reason}` : null].filter(Boolean);
  return parts.length ? `${verb === "sent" ? "Sent" : "Held"} ${parts.join(" ")}` : undefined;
}

export default function LeadTrustPanel({
  source,
  optedOutAt,
  auditTrail,
}: {
  source: string;
  optedOutAt?: string | null;
  auditTrail: LeadAuditTrail;
}) {
  const consent = deriveConsentBasis(source);
  const { events, totalCount } = auditTrail;
  const truncated = totalCount > events.length;

  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <ShieldCheck className="h-4 w-4" style={{ color: "var(--sage)" }} />
        Consent &amp; AI activity
      </h3>

      <div className="mt-3 space-y-3">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-ink-soft">Consent basis</span>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}
            >
              {consent.label}
            </span>
          </div>
          <p className="text-sm text-ink-soft mt-1.5 leading-relaxed">{consent.explanation}</p>
        </div>

        {optedOutAt ? (
          <div className="flex items-start gap-2 rounded-lg p-2 text-xs" style={{ backgroundColor: "rgba(217,95,79,0.08)" }}>
            <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "var(--coral)" }} />
            <span style={{ color: "var(--coral)" }}>
              Opted out of SMS/WhatsApp on {formatDate(optedOutAt)} (replied STOP) — texts and WhatsApp are blocked for
              this lead until they reply START.
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg p-2 text-xs" style={{ backgroundColor: "rgba(122,157,127,0.08)" }}>
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "var(--sage)" }} />
            <span style={{ color: "var(--sage)" }}>No opt-out on file — SMS and WhatsApp sends are allowed.</span>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-line">
        <h4 className="text-xs uppercase tracking-wide text-ink-soft flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" />
          AI activity log
        </h4>
        {events.length === 0 ? (
          <p className="text-sm text-ink-soft mt-2">Nothing sent or held for this lead yet.</p>
        ) : (
          <>
            <ul className="mt-2 space-y-2.5">
              {events.map((entry) => {
                const copy = (ACTION_COPY[entry.action] ?? (() => ({ label: entry.action })))(entry.meta);
                return (
                  <li key={entry.id} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{copy.label}</span>
                      <span className="text-xs text-ink-soft shrink-0">{formatDate(entry.createdAt)}</span>
                    </div>
                    {copy.detail && <p className="text-xs text-ink-soft mt-0.5">{copy.detail}</p>}
                  </li>
                );
              })}
            </ul>
            {truncated && (
              // task #85: this log used to just stop at 25 with nothing
              // saying so — a lead with a longer history looked fully
              // audited when it wasn't. Nothing here is lost (AuditEvent
              // rows are permanent), only what's rendered is capped.
              <p className="text-xs text-ink-soft mt-2.5 italic">
                Showing the 25 most recent of {totalCount} actions.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
