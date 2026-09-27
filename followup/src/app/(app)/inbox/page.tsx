import Link from "next/link";
import { getLeads } from "@/lib/leads-data";
import { getSessionContext } from "@/lib/session";
import { getPendingApprovals } from "@/lib/pendingApprovals";
import { Initials, shortAge, GroupLabel } from "@/components/app/canvasBits";
import type { Lead } from "@/lib/types";
import { prisma } from "@/lib/db";
import { sendLockedForSession } from "@/lib/sendingControl";
import ConversationPane from "@/components/app/ConversationPane";

export const dynamic = "force-dynamic";

/**
 * Inbox (canvas Inbox and InboxPhone boards): every conversation in one
 * list. The people waiting on a decision come first ("Needs you", with a
 * dot), then everyone else, newest first ("Earlier"). A row opens the
 * conversation, where the reply is.
 */
export default async function InboxPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const ctx = await getSessionContext();
  const [leads, approvals, business, sendLocked] = await Promise.all([
    getLeads(),
    ctx ? getPendingApprovals(ctx.businessId) : Promise.resolve([]),
    ctx ? prisma.business.findUnique({ where: { id: ctx.businessId }, select: { timezone: true } }) : Promise.resolve(null),
    sendLockedForSession(),
  ]);
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

  // Desktop shows the list and one conversation side by side (canvas Inbox
  // board). ?c= picks the conversation; without it, the first one that
  // needs you (or the newest). On a phone ?c= shows that conversation on
  // its own, and no ?c= shows the list.
  const openId = c && byId.has(c) ? c : (needs[0]?.lead.id ?? earlier[0]?.lead.id ?? null);
  const openLead = openId ? byId.get(openId)! : null;
  const openApproval = openId ? (approvals.find((a) => a.leadId === openId) ?? null) : null;
  const timeZone = business?.timezone ?? "America/New_York";

  return (
    <div className="app-bleed lg:grid lg:h-screen lg:grid-cols-[360px_minmax(0,1fr)]">
    <div className={(c ? "hidden lg:block " : "") + "lg:overflow-y-auto lg:border-r lg:border-line lg:px-5 lg:pt-8"}>
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
                href={`/inbox?c=${lead.id}`}
                active={lead.id === openId}
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
                href={`/inbox?c=${lead.id}`}
                active={lead.id === openId}
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
    {openLead && (
      <div className={(c ? "" : "hidden lg:block ") + "lg:overflow-y-auto"}>
        {c && (
          <Link href="/inbox" className="mb-3 inline-block text-[13px] text-ink-faint lg:hidden">
            ← Inbox
          </Link>
        )}
        <ConversationPane lead={openLead} approval={openApproval} timeZone={timeZone} now={now} sendLocked={sendLocked} />
      </div>
    )}
    </div>
  );
}

function Row({
  href,
  active = false,
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
  active?: boolean;
}) {
  return (
    <li className={first ? "" : "border-t border-line-2"}>
      <Link
        href={href}
        aria-current={active ? "true" : undefined}
        className={"flex items-center gap-3.5 py-3.5 rounded-lg -mx-2 px-2 " + (active ? "lg:bg-card lg:ring-1 lg:ring-[var(--line)]" : "hover:bg-card-2/60")}
      >
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
