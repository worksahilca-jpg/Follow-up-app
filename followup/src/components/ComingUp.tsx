import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ComingUpItem } from "@/lib/comingUp";

/**
 * "Coming up" (A-046): who FollowUp writes to next, grouped by day. The
 * full list on desktop Today and on its own page; on the phone Today it
 * is one line that opens that page (R-015).
 */
export function ComingUpList({
  groups,
  holdAll,
}: {
  groups: { day: string; items: ComingUpItem[] }[];
  holdAll: boolean;
}) {
  return (
    <>
      <p className="text-sm text-ink-soft mt-1">
        Who FollowUp writes to next.{holdAll ? " Each one waits for your OK." : ""}
      </p>
      <div className="mt-4 space-y-5">
        {groups.map((g) => (
          <div key={g.day}>
            <p className="text-xs font-medium text-ink-soft">{g.day}</p>
            <ul className="mt-1 divide-y divide-line">
              {g.items.map((it) => (
                <li key={it.leadId}>
                  <Link href={`/leads/${it.leadId}`} className="flex items-baseline justify-between gap-3 py-2.5 hover:underline">
                    <span className="font-medium text-sm">{it.name}</span>
                    <span className="text-xs text-ink-soft text-right">
                      {it.what}
                      {/* A-050: a check-in is a promise with a condition. */}
                      {it.unless && `, unless ${it.name.split(" ")[0] || it.name} writes first`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}

/** The phone's single line: "Coming up: 3 check-ins tomorrow". */
export function ComingUpLine({ first, total }: { first: { day: string; count: number }; total: number }) {
  const lead =
    first.day === "Today" || first.day === "Tomorrow"
      ? `${first.count} ${first.day.toLowerCase()}`
      : `${first.count} on ${first.day}`;
  return (
    <Link
      href="/coming-up"
      className="mt-6 sm:hidden box flex items-center justify-between gap-3 px-4 min-h-[52px] text-sm"
    >
      <span>
        Coming up: {lead}
        {total > first.count ? `, ${total - first.count} more after that` : ""}
      </span>
      <ChevronRight className="h-4 w-4 text-ink-soft" aria-hidden="true" />
    </Link>
  );
}
