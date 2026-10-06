import Link from "next/link";
import ApprovalQueue, { type ApprovalItem } from "@/components/ApprovalQueue";
import SetupStrip from "@/components/SetupStrip";
import SendingPausedBanner from "@/components/SendingPausedBanner";
import CantSendNotice from "@/components/CantSendNotice";
import { hasAnySendChannel } from "@/lib/sendChannels";
import TestLeadButton from "@/components/TestLeadButton";
import { getLeads, getUpcomingBookings } from "@/lib/leads-data";
import { aboutToBeLost } from "@/lib/rescue";
import { getRescueReport } from "@/lib/rescued";
import { countCustomersAnswered } from "@/lib/weeklyDigest";
import { withBasis } from "@/lib/showTheWork";
import { countWorkSince, resultsLine, workLine } from "@/lib/workDone";
import { describeWait, describeWaitClause, startOfLocalDay } from "@/lib/calmToday";
import { countHandledToday } from "@/lib/handledToday";
import { laterTodayAvailable } from "@/lib/later";
import { loadComingUp } from "@/lib/comingUpData";
import { medianReplyMs } from "@/lib/waitingOn";
import { ComingUpLine } from "@/components/ComingUp";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getPendingApprovals, onTodayNow } from "@/lib/pendingApprovals";
import { getIncompleteSetupSteps } from "@/lib/setupStatus";
import { getGmailStatus } from "@/lib/integrations/gmail";
import { getOutlookStatus } from "@/lib/integrations/outlook";
import { ArrowRight } from "lucide-react";
import { Eyebrow, Initials } from "@/components/app/canvasBits";
import FirstValueNote from "@/components/FirstValueNote";
import { FIRST_VALUE_SEND, firstValueNote } from "@/lib/firstValue";
import HabitQuestion from "@/components/HabitQuestion";
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
export default async function DashboardPage() {
  // Speed (check-up #21, A-089): Today used to make eighteen database trips one after another,
  // each waiting for the last. The independent ones now go together in two rounds: everything
  // that needs only the session, then everything that needs the business's time zone.
  const [leads, upcomingBookings, ctx] = await Promise.all([getLeads(), getUpcomingBookings(), getSessionContext()]);
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
      ? prisma.business.findUnique({ where: { id: ctx.businessId }, select: { timezone: true, holdAllForApproval: true, sendingPausedAt: true, onlyAdminsSend: true } })
      : null,
    // Pause all sending, and Only admins send (A-041). The role is read here
    // rather than trusted from the session, which doesn't carry it.
    ctx ? prisma.user.findUnique({ where: { id: ctx.userId }, select: { role: true } }) : null,
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
  // Set aside with "Later" (A-046): off Today until it comes back.
  const setAside = approvals.filter((a) => a.laterUntil).length;
  const [withBasisItems, handledToday, comingUp, workDone, filteredCount, anySendChannel] = await Promise.all([
    withBasis(onTodayNow(approvals), timezone),
    ctx ? countHandledToday(ctx.businessId, startOfLocalDay(now, timezone)) : 0,
    // Who FollowUp writes to next (A-046), leaving out anyone already waiting for your OK.
    ctx && leads.length > 0 ? loadComingUp(ctx.businessId, leads, awaitingOk, timezone, now) : null,
    // Round 2 (A-088): what FollowUp did since yesterday.
    ctx ? countWorkSince(ctx.businessId, startOfLocalDay(new Date(now.getTime() - 24 * 60 * 60 * 1000), timezone)) : null,
    // A quiet inbox (A-088): whether FollowUp has read anything yet, so "no customers" can say what it checked.
    ctx && leads.length === 0 ? prisma.filteredEmail.count({ where: { businessId: ctx.businessId } }) : 0,
    // Nothing to send from: every rule still reads "on" in Settings, and none
    // of them can do anything (A-044). Only asked once there are people.
    ctx && leads.length > 0 ? hasAnySendChannel(ctx.businessId) : true,
  ]);
  const approvalItems: ApprovalItem[] = withBasisItems.map((a) => ({
    ...a,
    wait: describeWait(a, now),
    waitClause: describeWaitClause(a, now),
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
  // A booked call is one line under the list (A-080), only when one exists.
  const nextCall = upcomingBookings[0]
    ? {
        ...upcomingBookings[0],
        when: new Date(upcomingBookings[0].scheduledAt).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: timezone }),
      }
    : null;
  // Round 2 (A-088). What came of the week goes to the end of the day, where the owner finishes
  // (peak-end); the foot of a working Today says what FollowUp did since yesterday instead.
  const weekResults = resultsLine({
    heardBackMs: medianReplyMs(leads, weekStart, weekEnd),
    answered: answeredThisWeek,
    cameBack: rescue?.rescued ?? 0,
    booked: rescue?.booked ?? 0,
  });
  const work = workDone ? workLine(workDone) : null;
  const checkedAny = filteredCount > 0;
  // Business.holdAllForApproval — as of 2026-09-20 this stops every
  // automated message including the instant reply, so it changes what
  // this screen can honestly promise.
  const holdAll = business?.holdAllForApproval ?? false;
  const isAdmin = me?.role === "ADMIN";
  // "FollowUp learns what you do" (A-099): asked of an admin only, once.
  const habitSuggestion = ctx && isAdmin && leads.length > 0 ? await findHabitSuggestion(ctx.businessId, now) : null;
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

  /**
   * The banner's one computed sentence, replacing the fixed string "Here's
   * what needs your attention today." — which was the same words whether the
   * owner had nine drafts waiting or a completely clear morning. A line that
   * never changes tells you nothing, and it sat at the top of the screen this
   * ICP opens twenty times a day (S-12).
   *
   * Order matters: the thing blocked on a human first, then the thing the
   * product exists to prevent. When neither is true the sentence says so
   * outright rather than leaving the owner to infer calm from an empty page.
   */
  function headline(): string {
    const parts: string[] = [];
    if (approvalItems.length > 0) {
      parts.push(`${approvalItems.length} draft${approvalItems.length === 1 ? "" : "s"} need${approvalItems.length === 1 ? "s" : ""} your OK`);
    }
    if (lost.total > 0) {
      parts.push(`${lost.total} customer${lost.total === 1 ? "" : "s"} going quiet`);
    }
    if (parts.length > 0) return parts.join(" · ");

    const answered = rescue?.answeredForYou ?? 0;
    if (answered > 0) {
      return `Nothing needs your OK. FollowUp answered ${answered} for you this week.`;
    }

    /*
     * Nothing has ever arrived. Checked BEFORE the calm sentence, because
     * on a brand-new account that sentence is true and still misleading.
     *
     * "Nothing needs your OK right now" is what a product says to someone
     * who has been working and is caught up. A tester who signed up two
     * minutes ago and connected nothing read it as their very first line
     * — a reassurance the account has not earned, sitting directly above
     * a box explaining that FollowUp is not watching anything yet. The
     * page contradicted itself the same way Settings did (#301): one
     * true-sounding sentence, one accurate one, in the same glance.
     *
     * Deliberately says nothing about what IS or ISN'T connected. This
     * screen can see an inbox, and cannot see a website snippet someone
     * pasted into their own site — so "nothing is connected" would be a
     * guess, and guessing is what caused the sentence above. The box
     * below owns that explanation and has three properly-reasoned
     * branches for it; this line only has to stop claiming calm.
     */
    if (leads.length === 0) return "No customers yet.";

    return "Nothing needs your OK right now.";
  }

  return (
    <div>
      {/* The greeting and the one computed sentence under it, in the app's
          one page-header shape. This used to sit inside a bordered box with
          an animated colour wash behind it — the last coloured ornament in
          the app, retired with the move to the monochrome system
          (2026-09-19). A working tool people open twenty times a day does
          not need a hero. */}
      {/* The canvas Today header (TodayCalm): the date, then one sentence
          that says how many people are waiting on the owner. */}
      <div className="text-[13px] text-ink-faint">
        {new Intl.DateTimeFormat(undefined, { timeZone: timezone, weekday: "long", month: "long", day: "numeric" }).format(now)}
      </div>
      <h1 className="mt-1.5 text-[30px] sm:text-[34px] leading-[1.1]">
        {approvalItems.length > 0 ? (
          <>
            {/* The phone's shorter line, as TodayCalmPhone draws it. */}
            <span className="sm:hidden">{`${approvalItems.length} ${approvalItems.length === 1 ? "customer needs" : "customers need"} you.`}</span>
            <span className="hidden sm:inline">{`${approvalItems.length} ${approvalItems.length === 1 ? "customer is" : "customers are"} waiting on you.`}</span>
          </>
        ) : (
          headline()
        )}
      </h1>

      {sendingPaused && <SendingPausedBanner canResume={isAdmin} />}
      {cantSend && (
        <CantSendNotice reconnectEmail={"needsReconnect" in gmail && gmail.needsReconnect ? (gmail.email ?? "your inbox") : null} />
      )}
      {firstValue && <FirstValueNote title={firstValue.title} body={firstValue.body} />}
      {/* One decision per screen (A-080): the queue is the page. The
          Coming up card went; automated check-ins live on their own page,
          and a booked call is the one line below. */}
      <div className="mt-4">
      <div className="min-w-0">
      {/* With no customers at all, the box below says what FollowUp checked; a second
          "Nothing needs your OK" card above it said the same thing twice (A-088). */}
      {leads.length > 0 && (
        <ApprovalQueue items={approvalItems} weekResults={weekResults} answeredForYou={rescue?.answeredForYou ?? 0} sendLocked={sendLocked} handledToday={handledToday} laterToday={laterTodayAvailable(now, timezone)} setAside={setAside} holdAll={holdAll} />
      )}

      {habitSuggestion && <HabitQuestion kind={habitSuggestion.kind} count={habitSuggestion.count} example={habitSuggestion.example} />}

      {nextCall && (
        <p className="mt-6 text-sm text-ink-soft">
          Booked call ·{" "}
          <Link href={`/leads/${nextCall.leadId}`} className="font-medium text-ink hover:underline">
            {nextCall.leadName}
          </Link>
          , {nextCall.when}
          {upcomingBookings.length > 1 && (
            <>
              {" · "}
              <Link href="/coming-up" className="hover:underline">
                {upcomingBookings.length - 1} more
              </Link>
            </>
          )}
        </p>
      )}
      {comingUp && comingUp.total > 0 && (
        <ComingUpLine first={{ day: comingUp.groups[0].day, count: comingUp.groups[0].items.length }} total={comingUp.total} />
      )}

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
            ) : (
              <>
                <p className="text-lg leading-relaxed">
                  {/* No inbox means no pushActive to read, so this cannot
                      promise the one-minute path — it says what every
                      connected inbox gets at minimum instead. */}
                  No inbox is connected yet, so FollowUp isn&apos;t watching for leads. Connect one and it starts
                  answering the people who write in, within minutes.
                </p>
                <div className="mt-4">
                  <Link
                    href="/settings"
                    className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium"
                    style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
                  >
                    Connect an inbox
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

          {/* About to be lost, under the list, as drawn. Anyone already in
              Needs you is left out (A-046, once each). */}
          {atRisk.length > 0 && (
            <section className="mt-7">
              <div className="mb-2.5">
                <Eyebrow>About to be lost · {lost.total}</Eyebrow>
              </div>
              <div className="overflow-hidden rounded-2xl border border-line bg-card divide-y divide-[var(--line-2)]">
                {atRisk.map((lead) => (
                  <Link key={lead.id} href={`/leads/${lead.id}`} className="flex items-center gap-3 px-[18px] py-3.5 hover:bg-paper">
                    <Initials name={lead.name} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-medium">{lead.name}</span>
                      <span className="block text-[13.5px] leading-snug text-ink-soft">{lead.rescue.reason}</span>
                    </span>
                    <span className="h-8 shrink-0 rounded-full border border-line bg-card px-3.5 text-[13px] font-medium leading-8">Open</span>
                  </Link>
                ))}
              </div>
              <p className="mt-2 px-0.5 text-[13px] text-ink-faint">Anyone already above isn&apos;t listed again.</p>
            </section>
          )}

          {/* What FollowUp did since yesterday, in one quiet line at the foot
              of a working Today (A-088, the labour illusion); it opens
              Numbers. The week's results moved to the end of the day.
              Desktop only (R-015). */}
          {work && approvalItems.length > 0 && (
            <Link href="/analytics" className="mt-6 hidden max-w-[400px] text-sm leading-relaxed text-ink-soft tabular-nums hover:text-ink sm:block">
              {work}
            </Link>
          )}
        </>
      )}
      </div>
      </div>
    </div>
  );
}
