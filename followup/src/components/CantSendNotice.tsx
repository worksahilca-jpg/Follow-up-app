import Link from "next/link";

/**
 * "Replies and check-ins can't go out" at the top of Today (design brain
 * A-044, the Zapier study: a rule that can't run says so where the owner
 * looks).
 *
 * With nothing connected to send from, every rule in Settings still reads
 * "on", and automation.ts stops before it looks at a single lead. Until
 * this, the only sign was a badge on each person's page, and the setup
 * strip at the foot of Today, below both lists. Shown only once there are
 * people to answer; an empty account has its own sentence for this.
 */
export default function CantSendNotice({ reconnectEmail }: { reconnectEmail: string | null }) {
  return (
    <div role="status" className="mt-6 box px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">Replies and check-ins can&apos;t go out</p>
        <p className="text-[13px] text-ink-soft mt-0.5">
          {reconnectEmail
            ? `FollowUp lost access to ${reconnectEmail}, so it can't write to anyone. Connections made before October 3 ended after 7 days; reconnect once and it stays connected. It takes a few seconds.`
            : "Nothing is connected to send from, so FollowUp can't write to anyone."}
        </p>
      </div>
      <Link
        href="/settings#integrations"
        // Outline, not black: Send is the one black thing on Today (A-080).
        className="shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium"
        style={{ borderColor: "var(--line-strong)", backgroundColor: "var(--card)", color: "var(--ink)" }}
      >
        {reconnectEmail ? "Reconnect Gmail" : "Connect an inbox"}
      </Link>
    </div>
  );
}
