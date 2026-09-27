import Link from "next/link";
import { getLeads } from "@/lib/leads-data";
import { getSessionContext } from "@/lib/session";
import { getPendingApprovals } from "@/lib/pendingApprovals";
import { Initials, shortAge, GroupLabel } from "@/components/app/canvasBits";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Inbox (canvas Inbox and InboxPhone boards): every conversation in one
 * list. The people waiting on a decision come first ("Needs you", with a
 * dot), then everyone else, newest first ("Earlier"). A row opens the
 * conversation, where the reply is.
 */
export default async function InboxPage() {
  const ctx = await getSessionContext();
  const [leads, approvals] = await Promise.all([getLeads(), ctx ? getPendingApprovals(ctx.businessId) : Promise.resolve([])]);
  const now = new Date();
  const byId = new Map(leads.map((l) => [l.id, l]));

  const needs = approvals
    .map((a) => ({ lead: byId.get(a.leadId), approval: a }))
    .filter((x): x is { lead: Lead; approval: (typeof approvals)[number] } => Boolean(x.lead));
  const needIds = new Set(needs.map((n) => n.lead.id));

  const earlier = leads
    .filter((l) => !needIds.has(l.id) && l.conversation.length > 0)
    .map((l) => ({ lead: l, last: l.conversation[l.conversation.length - 1] }))
    .sort((a, b) => new Date(b.last.date).getTime() - new Date(a.last.date).getTime())
    .slice(0, 40);

  return (
    <div className="max-w-[720px]">
      <h1 className="text-[32px] leading-[1.1]">Inbox</h1>

      {needs.length === 0 && earlier.length === 0 && (
        <p className="mt-4 text-[15px] text-ink-soft">No conversations yet. When a customer writes, it shows up here.</p>
      )}

      {needs.length > 0 && (
        <div className="mt-6">
          <GroupLabel>Needs you</GroupLabel>
          <ul>
            {needs.map(({ lead, approval }, i) => (
              <Row
                key={lead.id}
                href={`/leads/${lead.id}`}
                name={lead.name}
                age={shortAge(approval.heldAt, now)}
                preview={approval.leadLastMessage ?? approval.reason}
                unread
                first={i === 0}
              />
            ))}
          </ul>
        </div>
      )}

      {earlier.length > 0 && (
        <div className="mt-5">
          <GroupLabel>Earlier</GroupLabel>
          <ul>
            {earlier.map(({ lead, last }, i) => (
              <Row
                key={lead.id}
                href={`/leads/${lead.id}`}
                name={lead.name}
                age={shortAge(last.date, now)}
                preview={last.direction === "outbound" ? `${last.trigger ? "FollowUp" : "You"}: ${last.body}` : last.body}
                first={i === 0}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Row({
  href,
  name,
  age,
  preview,
  unread = false,
  first,
}: {
  href: string;
  name: string;
  age: string;
  preview: string;
  unread?: boolean;
  first: boolean;
}) {
  return (
    <li className={first ? "" : "border-t border-line-2"}>
      <Link href={href} className="flex items-center gap-3.5 py-3.5 hover:bg-card-2/60 rounded-lg -mx-2 px-2">
        <Initials name={name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-base" style={{ fontWeight: unread ? 600 : 400 }}>
              {name}
            </span>
            <span className="ml-auto text-[13px] text-ink-faint tabular-nums">{age}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className={"min-w-0 flex-1 truncate text-[14.5px] " + (unread ? "text-ink-soft" : "text-ink-faint")}>
              {preview.replace(/\s+/g, " ")}
            </span>
            {unread && <span aria-label="Needs you" className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--ink)" }} />}
          </div>
        </div>
      </Link>
    </li>
  );
}
