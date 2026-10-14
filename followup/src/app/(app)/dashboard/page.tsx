import Link from "next/link";
import ApprovalQueue, { type ApprovalItem } from "@/components/ApprovalQueue";
import SetupStrip from "@/components/SetupStrip";
import SendingPausedBanner from "@/components/SendingPausedBanner";
import CantSendNotice from "@/components/CantSendNotice";
import { hasAnySendChannel } from "@/lib/sendChannels";
import TestLeadButton from "@/components/TestLeadButton";
import { getLeads } from "@/lib/leads-data";
import { aboutToBeLost } from "@/lib/rescue";
import { getRescueReport } from "@/lib/rescued";
import { countCustomersAnswered } from "@/lib/weeklyDigest";
import { withBasis } from "@/lib/showTheWork";
import { resultsLine } from "@/lib/workDone";
import { describeWait, describeWaitClause, readyReason, startOfLocalDay, todayTier } from "@/lib/calmToday";
import { countHandledToday } from "@/lib/handledToday";
import { loadComingUp } from "@/lib/comingUpData";
import { medianReplyMs } from "@/lib/waitingOn";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getPendingApprovals, onTodayNow } from "@/lib/pendingApprovals";
import { getCallsToMake } from "@/lib/calls";
import { ordinalCall } from "@/lib/callPlan";
import type { CallCard } from "@/components/app/CallsToMake";
import { getIncompleteSetupSteps } from "@/lib/setupStatus";
import { getGmailStatus } from "@/lib/integrations/gmail";
import { getOutlookStatus } from "@/lib/integrations/outlook";
import { ArrowRight } from "lucide-react";
import FirstValueNote from "@/components/FirstValueNote";
import { FIRST_VALUE_SEND, firstValueNote } from "@/lib/firstValue";
import HabitQuestion from "@/components/HabitQuestion";
import DailyQuestion from "@/components/DailyQuestion";
import { AlertsCard } from "@/components/app/AlertsSetup";
import ReplyForMeCard from "@/components/app/ReplyForMeCard";
import { GoingQuietRow } from "@/components/app/TodayRows";
import { DayDone, DayNumbers, DayTomorrow, type TodayRow } from "@/components/app/TodayDay";
import { clockTime, dayLine, dayOffset, dayProgress, doneLines, greeting, whoIsNext } from "@/lib/todayWords";
import { oneQueue } from "@/lib/approvalGroups";
import { replyForMeOffer } from "@/lib/replyForMeOffer";
import { todaysQuestion } from "@/lib/dailyQuestionData";
import { planLine } from "@/lib/comingUp";
import { findHabitSuggestion } from "@/lib/habits";

// "last checked 2 minutes ago" — deliberately coarse (minutes/hours/days,
// no seconds) since this is a status line, not a live clock.
function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.round(diffMs / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `${Math.round(hours / 24)} day${Math.round(hours / 24) === 1 ? "" : "s"} ago`;
}


// This page reads live leads from the database on every request — never
// bake a stale snapshot into the build.
export const dynamic = "force-dynamic";

/**
 * research/product/2026-09-10-ux-simplification.md, implementation plan
 * items #1 and #3: this used to open on 13 stat tiles across three
 * separate rows and a ranked list of problems, with no screen anywhere
 * answering "what needs my OK right now" (§0.6 — the single biggest
 * structural gap in an approval-first product). Now: the approval queue
 * is pinned at the top, the tile count is cut to the 3 that actually
 * answer an owner's real questions (§2), and "Today's follow-ups", the
 * pipeline snapshot, and the 5-tile weekly AI report all move behind a
 * single "See all numbers" link to /analytics — same data, just not
 * shouting for attention on the one screen that should read as a queue
 * of decisions, not a wall of numbers.
 */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ alerts?: string | string[] }> }) {
  // The link a computer hands to the phone (src/lib/alertsSetup.ts) opens the alerts card.
  const alertsOpen = (await searchParams).alerts === "on";
  // Speed (check-up #21, A-089): Today used to make eighteen database trips one after another,
  // each waiting for the last. The independent ones now go together in two rounds: everything
  // that needs only the session, then everything that needs the business's time zone.
  const [leads, ctx] = await Promise.all([getLeads(), getSessionContext()]);
  // "This week" (design brain A-042, the Ramp study): customers, not
  // messages, the same count the Monday email uses.
  const weekEnd = new Date();
  const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [rescue, answeredThisWeek, approvals, setupSteps, business, me, gmail, outlook, firstSend] = await Promise.all([
    ctx ? getRescueReport(ctx.businessId, 7, undefined, { includeOwnerSends: true }) : null,
    ctx ? countCustomersAnswered(ctx.businessId, weekStart, weekEnd) : 0,
    ctx ? getPendingApprovals(ctx.businessId) : [],
    // Passed straight through. This used to be re-mapped field by field,
    // which dropped whatever the mapping had not been told about — see
    // ApprovalItem's own note.
    ctx ? getIncompleteSetupSteps(ctx.businessId) : [],
    // The owner's own wall clock, for the greeting. This is a server
    // component, so without it "Good morning" came from the server's
    // clock — UTC on Vercel — and greeted a Toronto owner at 8pm with it.
    ctx
      ? prisma.business.findUnique({ where: { id: ctx.businessId }, select: { timezone: true, holdAllForApproval: true, sendingPausedAt: true, onlyAdminsSend: true, instagramUsername: true } })
      : null,
    // Pause all sending, and Only admins send (A-041). The role is read here
    // rather than trusted from the session, which doesn't carry it.
    ctx ? prisma.user.findUnique({ where: { id: ctx.userId }, select: { role: true, name: true } }) : null,
    ctx ? getGmailStatus(ctx.businessId) : ({ connected: false } as Awaited<ReturnType<typeof getGmailStatus>>),
    ctx ? getOutlookStatus(ctx.businessId) : ({ connected: false } as Awaited<ReturnType<typeof getOutlookStatus>>),
    // "Your first reply went out through FollowUp" (A-047): only on the day
    // the business's first value happened, so it is said once with nothing stored.
    ctx
      ? prisma.followUp.findFirst({
          where: { ...FIRST_VALUE_SEND, lead: { businessId: ctx.businessId } },
          orderBy: { sentAt: "asc" },
          select: { sentAt: true, channel: true, repliedAt: true, lead: { select: { name: true } } },
        })
      : null,
  ]);
  // Each person once on Today (A-046): anyone already waiting for the
  // owner's OK is left out of "About to be lost".
  const awaitingOk = new Set(approvals.map((a) => a.leadId));
  // One count for the headline and the section's label (aboutToBeLost).
  const lost = aboutToBeLost(leads, awaitingOk);
  const atRisk = lost.shown;
  const timezone = business?.timezone ?? "America/New_York";
  // "Based on" under each waiting reply, and "sent as written" (A-043).
  // "Waiting 5 h" on each card and in the "Start with" line (A-046), worked
  // out here so the server and the browser show the same words.
  const now = new Date();
  const [withBasisItems, handledToday, comingUp, filteredCount, anySendChannel, instagramCount] = await Promise.all([
    withBasis(onTodayNow(approvals), timezone, ctx?.businessId),
    ctx ? countHandledToday(ctx.businessId, startOfLocalDay(now, timezone)) : 0,
    // Who FollowUp writes to next (A-046), leaving out anyone already waiting for your OK.
    ctx && leads.length > 0 ? loadComingUp(ctx.businessId, leads, awaitingOk, timezone, now) : null,
    // A quiet inbox (A-088): whether FollowUp has read anything yet, so "no customers" can say what it checked.
    ctx && leads.length === 0 ? prisma.filteredEmail.count({ where: { businessId: ctx.businessId } }) : 0,
    // Nothing to send from: every rule still reads "on" in Settings, and none
    // of them can do anything (A-044). Only asked once there are people.
    ctx && leads.length > 0 ? hasAnySendChannel(ctx.businessId) : true,
    // Instagram counts as connected (A-241): an id and a token, as
    // sendChannels.ts counts it. Only the empty state asks.
    ctx && leads.length === 0
      ? prisma.business.count({ where: { id: ctx.businessId, instagramUserId: { not: null }, instagramAccessToken: { not: null } } })
      : 0,
  ]);
  const instagramConnected = instagramCount > 0;
  // Calls to make (A-103, the realtor team pilot): empty unless the business
  // has "Your team calls customers" on. Anyone already waiting for an OK is
  // left out: their text goes first (once each, A-046).
  const callsDue = ctx && leads.length > 0 ? (await getCallsToMake(ctx.businessId, ctx.userId, now)).filter((c) => !awaitingOk.has(c.leadId)) : [];
  const callCards: CallCard[] = callsDue.map((c) => {
    const first = c.name.split(" ")[0] || c.name;
    const tried = c.lastTriedAt
      ? new Date(c.lastTriedAt).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: timezone })
      : null;
    return {
      leadId: c.leadId,
      name: c.name,
      phone: c.phone,
      sub: [c.source, ordinalCall(c.callNumber)].filter(Boolean).join(" · "),
      todo: c.callNumber === 1 ? `Call ${first}. Nobody has called yet.` : `Call ${first} again.`,
      last: tried ? `Last call ${tried}: no answer.${c.texted ? ` Your text asked for a good time. No reply yet.` : ""}` : null,
    };
  });
  const approvalItems: ApprovalItem[] = withBasisItems.map((a) => ({
    ...a,
    wait: describeWait(a, now),
    waitClause: describeWaitClause(a, now),
    // Today's order and the reason a ready customer is on top (A-230), once, here.
    tier: todayTier(a, now),
    why: readyReason(a),
    // "asked you by email, 2 days ago" (A-243), here for the same reason as `wait`.
    asked: a.leadLastMessageAt ? timeAgo(a.leadLastMessageAt) : null,
    // "FollowUp told Sarah you're on it · 6:40 pm" (A-060), in the
    // business's own time, worked out here for the same reason as `wait`.
    toldAt: a.customerToldAt
      ? new Date(a.customerToldAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone })
      : null,
  }));
  const firstValue = firstValueNote(
    firstSend?.sentAt ? { sentAt: firstSend.sentAt, channel: firstSend.channel, repliedAt: firstSend.repliedAt, leadName: firstSend.lead.name } : null,
    now,
    timezone
  );
  // Round 2 (A-088). What came of the week goes to the end of the day, where the owner finishes
  // (peak-end). A working Today says nothing else under the customer (A-243).
  const weekResults = resultsLine({
    heardBackMs: medianReplyMs(leads, weekStart, weekEnd),
    answered: answeredThisWeek,
    cameBack: rescue?.rescued ?? 0,
    booked: rescue?.booked ?? 0,
  });
  // Everyone waiting on the owner: replies for an OK, and calls to make (A-103).
  const needYou = approvalItems.length + callCards.length;
  const checkedAny = filteredCount > 0;
  // Business.holdAllForApproval — as of 2026-09-20 this stops every
  // automated message including the instant reply, so it changes what
  // this screen can honestly promise.
  const holdAll = business?.holdAllForApproval ?? false;
  const isAdmin = me?.role === "ADMIN";
  // "FollowUp learns what you do" (A-099): asked of an admin only, once.
  const habitSuggestion = ctx && isAdmin && leads.length > 0 && needYou === 0 ? await findHabitSuggestion(ctx.businessId, now) : null;
  // One question a day (A-101): only when nobody is waiting on the owner and
  // nothing else is being asked, so it never stands in front of real work.
  const dailyQuestion = ctx && isAdmin && approvalItems.length === 0 && callCards.length === 0 && !habitSuggestion ? await todaysQuestion(ctx.businessId, now) : null;
  const sendingPaused = Boolean(business?.sendingPausedAt);
  const sendLocked = Boolean(business?.onlyAdminsSend) && !isAdmin;
  const cantSend = !anySendChannel;
  // An inbox is connected if EITHER provider is. Checking only Gmail is what
  // made the empty state claim "FollowUp is watching your inbox" to a business
  // that had connected Outlook and never got the confirmation line, and to a
  // business that had connected nothing at all. Normalised to one shape here
  // so the view doesn't have to know which provider it got — only Gmail
  // reports a last-sync time, so that field is optional.
  //
  // `instant` is how fast a new lead is actually SEEN, and it is the one
  // field the old shape dropped. The reply itself is quick either way —
  // /api/cron/instant-ack runs every minute — but it can only answer a
  // lead FollowUp already has. Gmail hands those over in seconds when
  // Google's push watch is live (gmail.pushActive) and otherwise waits
  // for the ten-minute poll; Outlook has no push at all. So on a poll-only
  // inbox "replies within a minute" is off by ten, and it was being
  // printed to every Outlook owner and to every Gmail owner on a
  // deployment without GMAIL_PUSH_TOPIC — which is the state this one is
  // in. Promising a minute and taking eleven is the exact failure this
  // product exists to prevent, said about itself.
  const inbox: { email?: string; lastSyncedAt?: string | null; instant: boolean } | null = gmail.connected
    ? { email: gmail.email, lastSyncedAt: gmail.lastSyncedAt, instant: !!gmail.pushActive }
    : outlook.connected
      ? { email: outlook.email, instant: false }
      : null;

  /*
   * The headline (A-220): one number, "3 customers need you", the same
   * count the tab badge uses. On a clear day it says 0 and the card under
   * it says what that means, so the line never has to claim calm itself.
   *
   * A brand-new account gets a sentence instead. "0 customers need you" is
   * what a product says to someone who has been working and is caught up;
   * a tester who signed up two minutes ago and connected nothing read the
   * old calm line ("Nothing needs your OK right now") as their very first
   * words, above a box explaining that FollowUp is not watching anything
   * yet (#301). It says nothing about what is or isn't connected: the box
   * below owns that, with its three reasoned branches.
   */
  function headline(): string | null {
    if (leads.length === 0) return "No customers yet.";
    return null;
  }
  const sentence = headline();

  // "Let FollowUp reply for you?" (A-217, A-218): an admin, asked once, with
  // their own proof. Never on the visit the phone link opened (that visit
  // is for alerts), so Today asks one thing at a time. Only once nobody is
  // waiting (A-243): the question never stands in front of a customer.
  const offer = ctx && isAdmin && leads.length > 0 && needYou === 0 && !alertsOpen ? await replyForMeOffer(ctx.businessId) : null;

  // The owner's whole day (A-244, R-114): calls booked for today and
  // tomorrow, what got booked today, and how many customers FollowUp wrote
  // to today. Every time is said on the owner's own clock.
  const dayStart = startOfLocalDay(now, timezone);
  const [nearBookings, bookedToday, wroteForToday] = ctx && leads.length > 0
    ? await Promise.all([
        prisma.booking.findMany({
          where: { businessId: ctx.businessId, status: "confirmed", scheduledAt: { gte: now, lt: new Date(dayStart.getTime() + 50 * 60 * 60 * 1000) } },
          select: { id: true, leadId: true, scheduledAt: true, durationMinutes: true, lead: { select: { name: true } } },
          orderBy: { scheduledAt: "asc" },
          take: 20,
        }),
        prisma.booking.findMany({
          where: { businessId: ctx.businessId, status: "confirmed", createdAt: { gte: dayStart } },
          select: { scheduledAt: true, lead: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 3,
        }),
        prisma.followUp.findMany({
          where: { automated: true, status: "sent", sentAt: { gte: dayStart }, lead: { businessId: ctx.businessId } },
          select: { leadId: true },
          distinct: ["leadId"],
        }),
      ])
    : [[], [], []];
  const bookingRow = (b: (typeof nearBookings)[number]): TodayRow => ({
    key: `booking-${b.id}`,
    kind: "booking",
    title: `Call with ${b.lead.name}`,
    sub: `Booked through your booking link · ${b.durationMinutes} min`,
    time: clockTime(b.scheduledAt, timezone),
    href: `/leads/${b.leadId}`,
  });
  const bookingsToday = nearBookings.filter((b) => dayOffset(b.scheduledAt, now, timezone) === 0);
  const bookingsTomorrow = nearBookings.filter((b) => dayOffset(b.scheduledAt, now, timezone) === 1);
  // Calls to make (A-103) as rows: the customer's page has the call and its buttons.
  const callRows: TodayRow[] = callCards.map((c) => ({
    key: `call-${c.leadId}`,
    kind: "call",
    title: `Call ${c.name}`,
    sub: c.last ?? "Nobody has called yet.",
    time: null,
    href: `/leads/${c.leadId}`,
  }));
  // FollowUp's own check-ins tomorrow (A-046's coming up), as one row: nothing for the owner to do.
  const checkInsTomorrow = comingUp?.groups.find((g) => g.day === "Tomorrow")?.items ?? [];
  const tomorrowRows: TodayRow[] = [
    ...bookingsTomorrow.map(bookingRow),
    ...(checkInsTomorrow.length > 0
      ? [
          {
            key: "checkins",
            kind: "checkin" as const,
            title: `FollowUp checks in with ${checkInsTomorrow.length} ${checkInsTomorrow.length === 1 ? "customer" : "customers"}`,
            sub: `${whoIsNext(checkInsTomorrow.map((c) => c.name))}. Nothing for you to do.`,
            time: null,
            href: "/coming-up",
          },
        ]
      : []),
  ];
  const tomorrowDate = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long", month: "short", day: "numeric" }).format(
    new Date(dayStart.getTime() + 36 * 60 * 60 * 1000)
  );
  const bookedWhen = (at: Date) => {
    const day = dayOffset(at, now, timezone);
    const time = clockTime(at, timezone);
    if (day === 0) return `today at ${time}`;
    if (day === 1) return `tomorrow at ${time}`;
    return `${new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", month: "short", day: "numeric" }).format(at)} at ${time}`;
  };
  const done = doneLines({
    handled: handledToday,
    wroteFor: wroteForToday.length,
    booked: bookedToday.map((b) => ({ name: b.lead.name, when: bookedWhen(b.scheduledAt) })),
  });
  const progress = dayProgress(handledToday, approvalItems.length + callCards.length + bookingsToday.length);
  // Who to start with: the first reply in Today's order (A-230), else the first call.
  const firstUp = oneQueue(approvalItems).flatMap((g) => g.needsYou)[0]?.leadName ?? callCards[0]?.name ?? null;
  const firstUpName = firstUp ? firstUp.split(" ")[0] || firstUp : null;
  // The next booked call still to come today, for "1 booked call at 3:00 PM" (A-250).
  const nextBooked = bookingsToday.filter((b) => b.scheduledAt >= now).sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())[0];
  const numbers = (
    <DayNumbers
      replies={approvalItems.length}
      calls={callCards.length}
      booked={bookingsToday.length}
      nextBookedAt={nextBooked ? clockTime(nextBooked.scheduledAt, timezone) : null}
      progress={progress}
    />
  );

  return (
    <div>
      {/* The owner's day (A-244): the date, a greeting on their own clock,
          and who to start with. A brand-new account gets a sentence instead
          (#301): "No customers yet." */}
      <div className="text-[12.5px] text-ink-faint">
        {new Intl.DateTimeFormat(undefined, { timeZone: timezone, weekday: "long", month: "long", day: "numeric" }).format(now)}
      </div>
      {sentence ? (
        <h1 className="title-serif mt-1 text-[28px] leading-[1.15] sm:text-[32px]">{sentence}</h1>
      ) : (
        <>
          <h1 className="title-serif mt-0.5 text-[28px] leading-[1.15] sm:text-[32px]">{greeting(now, timezone, me?.name)}</h1>
          <p className="mt-1.5 text-[16px] leading-snug text-ink-soft">{dayLine(firstUpName, needYou + bookingsToday.length > 0)}</p>
        </>
      )}

      {/* On a phone one column, the cards a little wider than the text (12px
          from the edge, A-220). On a computer two columns (A-244): the work
          on the left; the day in numbers, tomorrow and what's done on the right. */}
      <div className={`-mx-2 sm:mx-0 ${leads.length > 0 ? "lg:max-w-[1040px]" : "sm:max-w-[640px]"}`}>
      {sendingPaused && <SendingPausedBanner canResume={isAdmin} />}
      {cantSend && (
        <CantSendNotice reconnectEmail={"needsReconnect" in gmail && gmail.needsReconnect ? (gmail.email ?? "your inbox") : null} />
      )}
      {firstValue && <FirstValueNote title={firstValue.title} body={firstValue.body} />}
      {leads.length > 0 && progress && <div className="mt-5 lg:hidden">{numbers}</div>}
      <div className={leads.length > 0 ? "mt-5 lg:grid lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start lg:gap-8" : "mt-3.5 sm:mt-5"}>
      <div className="min-w-0">
      {/* A buzz on the owner's phone when a customer needs them (A-216): shown
          until this device has alerts on, or "Not now". Not on the visit
          that asks the one-time question below: one question at a time.
          Not above a waiting customer either (A-243), except on the visit
          the phone link opened, which is for alerts. */}
      {!offer && (needYou === 0 || alertsOpen) && <div className="mb-4"><AlertsCard open={alertsOpen} /></div>}
      {/* Do this first, then everything still to do today (A-244). With no
          customers at all, the box below says what FollowUp checked. */}
      {leads.length > 0 && (() => {
        const queue = (
          <ApprovalQueue
            items={approvalItems}
            rows={[...callRows, ...bookingsToday.map(bookingRow)]}
            plan={approvalItems.length === 0 && comingUp ? planLine(comingUp.groups) : null}
            weekResults={weekResults}
            answeredForYou={rescue?.answeredForYou ?? 0}
            sendLocked={sendLocked}
            handledToday={handledToday}
            holdAll={holdAll}
          />
        );
        return offer ? (
          <ReplyForMeCard proof={offer} first={null}>
            {queue}
          </ReplyForMeCard>
        ) : (
          queue
        );
      })()}

      {/* Going quiet, as one row. Anyone already waiting above is left out (A-046, once each). */}
      {atRisk.length > 0 && <GoingQuietRow first={{ id: atRisk[0].id, name: atRisk[0].name, reason: atRisk[0].rescue.reason }} total={lost.total} />}

      {isAdmin && needYou === 0 && <HabitQuestion suggestion={habitSuggestion} />}
      {isAdmin && <DailyQuestion question={dailyQuestion} />}

      {leads.length === 0 ? (
        <div className="mt-10">
          {/* research/product/2026-09-10-ux-simplification.md §3/§7.1: the
              old empty state was four zeroed stat tiles and a generic
              "No leads yet" box — a worse first impression than one
              honest sentence. This says what's actually true right now
              (watching, or not yet set up) and gives one real action:
              seeing the core promise work today rather than waiting for
              a real lead to arrive. */}
          {/* This sentence used to be printed unconditionally: an owner who
              tapped "I'll do this later" in onboarding was told, on their very
              first screen, that FollowUp was watching an inbox it had no access
              to. The comment above this block always said it should say
              "watching, OR not yet set up" — that branch was never written.
              Claiming a capability you don't have is the worst possible first
              impression for a product whose entire pitch is being trusted to
              act on its own. */}
          <div
            className="box p-8 text-center"
          >
            {inbox ? (
              <>
                {/* Three states, because there are three. Holding is
                    checked FIRST: on a holding account nothing is sent at
                    all, so how fast capture runs decides when the DRAFT
                    is ready, not when the lead hears back. Saying "it
                    replies" to an owner whose account never replies on
                    its own is the same class of lie as the ten-minute
                    one fixed this morning — and it became true of every
                    beta account a few hours later, when the instant
                    reply started waiting for approval too. */}
                <p className="text-lg leading-relaxed">
                  {/* A quiet inbox says what was checked (A-088), so an empty
                      Today reads as "nothing to do", not "it isn't working". */}
                  {checkedAny
                    ? `FollowUp checked your email from the last 90 days. No customer there is waiting for an answer, so there's nothing to send. When a customer writes, ${holdAll ? "their reply will be here for you to send" : "FollowUp answers and shows you here"} within a few minutes.`
                    : holdAll
                    ? "FollowUp is watching your inbox. When a customer writes, FollowUp writes the reply and puts it in Today for you — nothing goes out until you send it."
                    : inbox.instant
                      ? "FollowUp is watching your inbox. The moment a customer writes, it replies within a minute and shows you here."
                      : "FollowUp is watching your inbox. It checks for new customers every ten minutes, then replies and shows you here."}
                </p>
                <p className="text-sm text-ink-soft mt-3 flex items-center justify-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--sage)" }} />
                  Watching {inbox.email}
                  {inbox.lastSyncedAt && ` — last checked ${timeAgo(inbox.lastSyncedAt)}`}
                </p>
              </>
            ) : gmail.needsReconnect ? (
              /* Google revoked the token — the owner disconnected FollowUp in
                 their Google account, changed their password, or (while the
                 OAuth app is still in Testing mode) hit the seven-day test
                 token expiry. This is NOT the same as never having connected:
                 leads were being captured and have silently stopped, and only
                 the owner can fix it. It gets its own sentence. */
              <>
                {/* The comment above has always known the likeliest cause
                    and the sentence never said it: while the OAuth app is
                    unverified, Google expires the token after seven days,
                    for everyone, on its own. Naming only "access removed
                    or password changed" sent a tester hunting through
                    their Google account for something they never did —
                    and left them thinking FollowUp had broken, rather
                    than that this is a known seven-day beta limit with a
                    one-click fix. */}
                <p className="text-lg leading-relaxed">
                  FollowUp has lost access to {gmail.email ?? "your inbox"}, so it isn&apos;t catching new leads
                  right now. Connections made before October 3 ended after 7 days while Google reviewed FollowUp;
                  reconnect once and it stays connected. It takes a few seconds. It can also mean access was
                  removed in Google, or a password changed.
                </p>
                <div className="mt-4">
                  <Link
                    href="/settings#integrations"
                    className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium"
                    style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
                  >
                    Reconnect Gmail
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </>
            ) : instagramConnected ? (
              /* Instagram alone (A-241): an owner whose customers write by
                 DM has no inbox, and was told nothing was being watched.
                 DMs are read every few minutes (instagramPoll.ts, every 3
                 in vercel.json), faster when Meta's webhook arrives. */
              <>
                <p className="text-lg leading-relaxed">
                  {holdAll
                    ? "FollowUp is watching your Instagram DMs. When a customer writes, FollowUp writes the reply and puts it in Today for you. Nothing goes out until you send it."
                    : "FollowUp is watching your Instagram DMs. When a customer writes, it replies within a few minutes and shows you here."}
                </p>
                <p className="text-sm text-ink-soft mt-3 flex items-center justify-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--sage)" }} />
                  Watching {business?.instagramUsername ? `@${business.instagramUsername}` : "your Instagram"}
                </p>
              </>
            ) : (
              <>
                <p className="text-lg leading-relaxed">
                  {/* Nothing connected means no pushActive to read, so this
                      cannot promise the one-minute path — it says what every
                      connection gets at minimum instead. */}
                  Nothing is connected yet, so FollowUp isn&apos;t watching for customers. Connect Instagram or your
                  email and it starts answering the people who write in, within minutes.
                </p>
                <div className="mt-4">
                  <Link
                    href="/settings"
                    className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium"
                    style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
                  >
                    Connect Instagram or email
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </>
            )}
            <div className="mt-6">
              <TestLeadButton />
            </div>
          </div>
          {/* getIncompleteSetupSteps() was being run for every dashboard
              load and then rendered only in the branch below — so the one
              account guaranteed to have unfinished setup, the brand-new
              one with no leads, was the only account never shown its next
              step. SetupStrip returns null when there is nothing left, so
              it is safe in both branches. */}
          <SetupStrip steps={setupSteps} />
        </div>
      ) : (
        <>
          {/* The canvas Today (TodayCalm) has no setup or demo blocks between
              the work: they show only once nothing needs the owner, so the
              first screen is the people waiting (founder, 2026-09-27: "I
              don't see the design on live"). Setup steps also live in
              Settings. */}
          {approvalItems.length === 0 && (
            <>
              <SetupStrip steps={setupSteps} />
              {setupSteps.length > 0 && (
                <div className="mt-6">
                  <TestLeadButton />
                </div>
              )}
            </>
          )}
        </>
      )}
      </div>
      {leads.length > 0 && (
        <div className="mt-9 flex flex-col gap-8 lg:mt-0">
          {progress && <div className="hidden lg:block">{numbers}</div>}
          <DayTomorrow date={tomorrowDate} rows={tomorrowRows} />
          <DayDone lines={done} />
        </div>
      )}
      </div>
      </div>
    </div>
  );
}
