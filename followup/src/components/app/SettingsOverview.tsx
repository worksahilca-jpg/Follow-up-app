"use client";

import Link from "next/link";

/**
 * The left side of Settings (A-069, SettingsAll): the follow-up plan and
 * Pause first, then the pages that left the menu (A-027). Where customers
 * write, the team and sign-ins moved into the list beside it
 * (SettingsList), where each opens its own page.
 */
export default function SettingsOverview({
  checkInDays,
  instantAck,
  holdAll,
  paused,
  pauseSaving,
  onPause,
  isAdmin,
}: {
  checkInDays: number[];
  instantAck: boolean;
  holdAll: boolean;
  paused: boolean;
  pauseSaving: boolean;
  onPause: (paused: boolean) => void;
  isAdmin: boolean;
}) {
  const days = checkInDays.length > 1 ? `Day ${checkInDays.slice(0, -1).join(", ")}, ${checkInDays[checkInDays.length - 1]}` : `Day ${checkInDays[0] ?? 3}`;

  return (
    <div className="max-w-[560px] space-y-5">
      <Card label="Your follow-up plan" action={<Link href="/workflows" className="text-sm underline underline-offset-[3px]">Change</Link>}>
        {instantAck && <PlanRow when="Right away" what="A quick “got your message” reply." first />}
        <PlanRow when={days} what="A check-in, if they go quiet." first={!instantAck} />
        <PlanRow when="Then" what="It stops. And it stops the moment they answer." />
        <PlanRow when="Always" what={holdAll ? "Every reply waits for your OK." : "Prices and dates always come to you."} />
      </Card>

      <Card label="Sending">
        <div className="flex items-center gap-3.5 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="text-base">{paused ? "Sending is paused" : "Pause all sending"}</div>
            <div className="mt-0.5 text-[13.5px] leading-snug text-ink-faint">
              {paused
                ? "Everything waits for your OK until you resume. Your settings stayed as they were."
                : "Everything waits for your OK until you resume. Your settings stay."}
            </div>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => onPause(!paused)}
              disabled={pauseSaving}
              className="h-11 shrink-0 rounded-full border bg-card px-4.5 px-[18px] text-[15px] font-medium disabled:opacity-60"
              style={{ borderColor: "rgba(10,10,10,0.18)" }}
            >
              {pauseSaving ? "…" : paused ? "Resume" : "Pause"}
            </button>
          )}
        </div>
      </Card>

      <div>
        <div className="text-sm text-ink-faint">Everything else</div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-[15px]">
          {[
            ["/leads", "Customers"],
            ["/waiting", "Waiting on customers"],
            ["/coming-up", "Coming up"],
            ["/workflows", "Follow-up plans"],
            ["/pipeline", "Pipeline"],
            ["/analytics", "Numbers"],
            ["/activity", "Activity"],
          ].map(([href, name]) => (
            <Link key={href} href={href} className="text-ink-soft underline-offset-[3px] hover:text-ink hover:underline">
              {name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Card({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-ink-faint">{label}</span>
        {action}
      </div>
      <div className="mt-2 rounded-[20px] border border-line bg-card px-[18px] py-1">{children}</div>
    </section>
  );
}

function PlanRow({ when, what, first = false }: { when: string; what: string; first?: boolean }) {
  return (
    <div className={"flex gap-3.5 py-3 " + (first ? "" : "border-t border-line-2")}>
      <span className="w-[92px] shrink-0 text-sm text-ink-faint">{when}</span>
      <span className="text-[15.5px] leading-snug">{what}</span>
    </div>
  );
}

