import Link from "next/link";
import { getLeads } from "@/lib/leads-data";
import { getSessionContext } from "@/lib/session";
import { getPendingApprovals } from "@/lib/pendingApprovals";
import { Initials, shortAge, GroupLabel, Eyebrow, restingState, type StateKey } from "@/components/app/canvasBits";
import { ChannelIcon, channelFromSource } from "@/components/app/ChannelIcon";
import type { Lead } from "@/lib/types";
import { prisma } from "@/lib/db";
import { sendLockedForSession } from "@/lib/sendingControl";
import ConversationPane from "@/components/app/ConversationPane";

export const dynamic = "force-dynamic";

/**
 * PARKED (A-082, 2026-10-04): no longer routed; /inbox redirects to
 * Customers. Kept, unrouted, under A-027's 30-account guard.
 *
 * Inbox (canvas Inbox and InboxPhone boards): every conversation in one
 * list. The people waiting on a decision come first ("Needs you"), then
 * everyone else, newest first. A row opens the conversation, where the
 * reply is. Desktop follows the Inbox board exactly: a 380px list with a
 * 56px bar, mono group labels, compact rows with the channel and a state
 * dot; the phone keeps InboxPhone's larger rows and one black dot.
 */
export default async function InboxList({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
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

  const total = needs.length + earlier.length;

  return (
    <div className="app-bleed lg:grid lg:h-screen lg:grid-cols-[380px_minmax(0,1fr)]">
    <div className={(c ? "hidden lg:block " : "") + "lg:overflow-y-auto lg:border-r lg:border-line"}>
      {/* Phone: the big title (InboxPhone). Desktop: the Inbox board's 56px bar with the count. */}
      <h1 className="title-serif text-[32px] leading-[1.1] lg:hidden">Inbox</h1>
      <div className="hidden h-14 items-baseline gap-2 border-b border-line px-4 lg:flex lg:items-center">
        <h1 className="text-[16px] leading-none" style={{ fontWeight: 600, letterSpacing: 0 }}>
          Inbox
        </h1>
        <span className="text-[13px] text-ink-faint">
          {total} {total === 1 ? "conversation" : "conversations"}
        </span>
      </div>

      {total === 0 && <p className="mt-4 text-[15px] text-ink-soft lg:px-4">No conversations yet. When a customer writes, it shows up here.</p>}

      {needs.length > 0 && (
        <div className="mt-6 lg:mt-0">
          <Label phone="Needs you" desk="Needs you" />
          <ul>
            {needs.map(({ lead, approval }, i) => (
              <Row
                key={lead.id}
                href={`/inbox?c=${lead.id}`}
                active={lead.id === openId}
                name={lead.name}
                channel={channelOf(lead)}
                age={shortAge(approval.heldAt, now)}
                preview={approval.leadLastMessage ?? approval.reason}
                state="needs"
                first={i === 0}
              />
            ))}
          </ul>
        </div>
      )}

      {earlier.length > 0 && (
        <div className="mt-5 lg:mt-0">
          <Label phone="Earlier" desk="Everyone else" />
          <ul>
            {earlier.map(({ lead, last }, i) => (
              <Row
                key={lead.id}
                href={`/inbox?c=${lead.id}`}
                active={lead.id === openId}
                name={lead.name}
                channel={channelOf(lead)}
                age={shortAge(last.date, now)}
                preview={last.direction === "outbound" ? `${last.trigger ? "FollowUp" : "You"}: ${last.body}` : last.body}
                state={restingState(lead).state}
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

function channelOf(lead: Lead): string | null {
  const lastIn = [...lead.conversation].reverse().find((m) => m.direction === "inbound");
  return (lastIn ?? lead.conversation[0])?.channel ?? channelFromSource(lead.source);
}

/** Phone: the quiet grey label. Desktop: the board's mono eyebrow ("NEEDS YOU"). */
function Label({ phone, desk }: { phone: string; desk: string }) {
  return (
    <>
      <div className="lg:hidden">
        <GroupLabel>{phone}</GroupLabel>
      </div>
      <div className="hidden px-4 pb-1.5 pt-3.5 lg:block">
        <Eyebrow>{desk}</Eyebrow>
      </div>
    </>
  );
}

function Row({
  href,
  active = false,
  name,
  channel,
  age,
  preview,
  state,
  first,
}: {
  href: string;
  name: string;
  channel: string | null;
  age: string;
  preview: string;
  state: StateKey;
  first: boolean;
  active?: boolean;
}) {
  const unread = state === "needs";
  return (
    <li className={(first ? "" : "border-t border-line-2 ") + "lg:border-t-0 lg:border-b lg:border-line-2"}>
      <Link
        href={href}
        aria-current={active ? "true" : undefined}
        className={
          "-mx-2 flex items-center gap-3.5 rounded-lg px-2 py-3.5 lg:mx-0 lg:items-start lg:gap-3 lg:rounded-none lg:px-4 lg:py-3 " +
          (active ? "lg:bg-card-2 lg:shadow-[inset_2px_0_0_var(--ink)]" : "hover:bg-card-2/60")
        }
      >
        <span className="lg:hidden">
          <Initials name={name} />
        </span>
        <span className="hidden lg:inline-flex">
          <Initials name={name} size={32} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 lg:gap-1.5">
            <span className="truncate text-base lg:text-[14px]" style={{ fontWeight: unread ? 600 : 400 }}>
              <span className="lg:hidden">{name}</span>
              <span className="hidden font-medium lg:inline">{name}</span>
            </span>
            <span className="hidden lg:inline-flex">
              <ChannelIcon channel={channel} className="h-[13px] w-[13px] shrink-0 text-ink-faint" />
            </span>
            <span className="ml-auto whitespace-nowrap text-[13px] tabular-nums text-ink-faint lg:text-[12.5px]">{age}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 lg:mt-[3px]">
            <span
              className={
                "min-w-0 flex-1 truncate text-[14.5px] lg:text-[13.5px] " +
                (unread || state === "quiet" ? "text-ink-soft" : "text-ink-faint")
              }
            >
              {preview.replace(/\s+/g, " ")}
            </span>
            {/* Phone: one black dot for "needs you" (A-029). Desktop: every state's coloured dot. */}
            {unread && <span aria-hidden className="h-2 w-2 shrink-0 rounded-full lg:hidden" style={{ background: "var(--ink)" }} />}
            <span
              title={unread ? "Needs you" : undefined}
              aria-label={unread ? "Needs you" : undefined}
              className="hidden h-[7px] w-[7px] shrink-0 rounded-full lg:block"
              style={{ background: `var(--state-${state})` }}
            />
          </div>
        </div>
      </Link>
    </li>
  );
}
