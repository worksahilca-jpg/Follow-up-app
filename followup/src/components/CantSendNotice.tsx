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
        <p className="text-xs text-ink-soft mt-0.5">
          {reconnectEmail
            ? `FollowUp lost access to ${reconnectEmail}, so it can't write to anyone. In the beta, Google ends this access every seven days. Reconnecting takes a few seconds.`
            : "Nothing is connected to send from, so FollowUp can't write to anyone."}
        </p>
      </div>
      <Link
        href="/settings#integrations"
        className="shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-medium"
        style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
      >
        {reconnectEmail ? "Reconnect Gmail" : "Connect an inbox"}
      </Link>
    </div>
  );
}
