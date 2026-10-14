/**
 * The dates behind /admin's "Who reaches first value" (design brain A-047).
 * Founder-only and cross-tenant like admin-data.ts, gated the same two
 * ways. Nothing new is tracked: every date is read from rows FollowUp
 * already writes. Bounded by the tester list (at most 100), never by leads.
 */

import { NOT_AN_ANSWER_TRIGGERS } from "@/lib/notAnAnswer";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platformAdmin";
import { FIRST_VALUE_SEND, ACTIVATION_WINDOW_MS } from "@/lib/firstValue";
import {
  buildActivation,
  findStopped,
  isActivated,
  STOPPED_WAIT_DAYS,
  type Activation,
  type StepAt,
  type StoppedFacts,
  type StoppedTester,
  type TesterJourney,
} from "@/lib/activation";
import { getPendingApprovals, onTodayNow } from "@/lib/pendingApprovals";
import { APP_OPEN } from "@/lib/appOpens";

// Any source, not only an inbox: the audit actions each connect route writes.
const CONNECT_ACTIONS = [
  "integration.gmail.connect",
  "integration.outlook.connect",
  "integration.instagram.connect",
  "integration.facebook.connect",
  "integration.whatsapp.connect",
];
const WEEK = ACTIVATION_WINDOW_MS;
const DAY = 24 * 60 * 60 * 1000;
// Practice customers (the setup's "Send a test lead" and practice list) are not people waiting.
const TEST_LEAD_SOURCE = "Test lead";

function earliest(...dates: (Date | null | undefined)[]): Date | null {
  let out: Date | null = null;
  for (const d of dates) if (d && (!out || d < out)) out = d;
  return out;
}

/** The approved testers, and the login each signed up with (if any). */
async function loadTesterUsers() {
  const testers = await prisma.accessRequest.findMany({
    where: { status: "approved" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, name: true, email: true, business: true, decidedAt: true, createdAt: true },
  });
  const users = testers.length
    ? await prisma.user.findMany({
        where: { email: { in: testers.map((t) => t.email) } },
        select: { email: true, businessId: true, createdAt: true },
      })
    : [];
  const userByEmail = new Map(users.filter((u) => u.email).map((u) => [u.email as string, u]));
  return { testers, users, userByEmail };
}

export async function getActivation(now: Date = new Date()): Promise<Activation> {
  await requirePlatformAdmin();
  return loadActivation(now);
}

/**
 * The same, without the sign-in check, for the daily stuck-testers email
 * (src/lib/stuckTesters.ts), which runs from a cron that has no session and
 * is guarded by CRON_SECRET instead. Every other caller goes through
 * getActivation.
 */
export async function loadActivation(now: Date = new Date()): Promise<Activation> {
  const { testers, users, userByEmail } = await loadTesterUsers();
  const bizIds = [...new Set(users.map((u) => u.businessId).filter((id): id is string => !!id))];

  const [connectAudits, inboxes, metaBiz, firstLeads, firstHolds, perBusiness] = await Promise.all([
    prisma.auditEvent.groupBy({
      by: ["businessId"],
      where: { businessId: { in: bizIds }, action: { in: CONNECT_ACTIONS } },
      _min: { createdAt: true },
    }),
    prisma.integration.findMany({
      where: { provider: { in: ["gmail", "outlook"] }, user: { businessId: { in: bizIds } } },
      select: { status: true, connectedAt: true, user: { select: { businessId: true } } },
    }),
    prisma.business.findMany({
      where: { id: { in: bizIds } },
      select: { id: true, instagramUserId: true, facebookPageId: true, whatsappPhoneNumberId: true },
    }),
    prisma.lead.groupBy({ by: ["businessId"], where: { businessId: { in: bizIds } }, _min: { createdAt: true } }),
    prisma.auditEvent.groupBy({
      by: ["businessId"],
      where: { businessId: { in: bizIds }, action: "ai.hold" },
      _min: { createdAt: true },
    }),
    Promise.all(
      bizIds.map(async (businessId) => {
        const [value, answer, autoDraft] = await Promise.all([
          prisma.followUp.findFirst({
            where: { ...FIRST_VALUE_SEND, lead: { businessId } },
            orderBy: { sentAt: "asc" },
            select: { sentAt: true },
          }),
          prisma.followUp.findFirst({
            where: { ...FIRST_VALUE_SEND, lead: { businessId }, repliedAt: { not: null } },
            orderBy: { repliedAt: "asc" },
            select: { repliedAt: true },
          }),
          prisma.followUp.findFirst({
            where: { automated: true, lead: { businessId }, OR: [{ trigger: null }, { trigger: { notIn: [...NOT_AN_ANSWER_TRIGGERS] } }] },
            orderBy: { createdAt: "asc" },
            select: { createdAt: true },
          }),
        ]);
        return { businessId, valueAt: value?.sentAt ?? null, answeredAt: answer?.repliedAt ?? null, autoDraftAt: autoDraft?.createdAt ?? null };
      })
    ),
  ]);

  const connectAuditAt = new Map(connectAudits.map((g) => [g.businessId, g._min.createdAt]));
  const leadAt = new Map(firstLeads.map((g) => [g.businessId, g._min.createdAt]));
  const holdAt = new Map(firstHolds.map((g) => [g.businessId, g._min.createdAt]));
  const byBiz = new Map(perBusiness.map((b) => [b.businessId, b]));
  const metaById = new Map(metaBiz.map((b) => [b.id, b]));

  const journeys: TesterJourney[] = [];
  for (const t of testers) {
    const user = userByEmail.get(t.email);
    const businessId = user?.businessId ?? null;
    const at: Record<string, StepAt> = {
      invited: t.decidedAt ?? t.createdAt,
      signedIn: null,
      connected: null,
      firstCustomer: null,
      replyReady: null,
      replySent: null,
      answered: null,
    };
    let inboxDisconnected = false;
    if (user) {
      at.signedIn = user.createdAt;
    }
    if (businessId) {
      const bizInboxes = inboxes.filter((i) => i.user.businessId === businessId);
      const meta = metaById.get(businessId);
      const connectedAt = earliest(connectAuditAt.get(businessId), ...bizInboxes.map((i) => i.connectedAt));
      const everConnected = bizInboxes.length > 0 || !!(meta?.instagramUserId || meta?.facebookPageId || meta?.whatsappPhoneNumberId);
      at.connected = connectedAt ?? (everConnected ? "unknown" : null);
      inboxDisconnected = bizInboxes.length > 0 && !bizInboxes.some((i) => i.status === "connected");
      const b = byBiz.get(businessId);
      at.firstCustomer = leadAt.get(businessId) ?? null;
      at.replyReady = earliest(holdAt.get(businessId), b?.autoDraftAt, b?.valueAt);
      at.replySent = b?.valueAt ?? null;
      at.answered = b?.answeredAt ?? null;
    }
    journeys.push({
      id: t.id,
      name: t.name,
      email: t.email,
      business: t.business,
      at: at as TesterJourney["at"],
      inboxDisconnected,
      cameBackWeek2: null,
    });
  }

  // Week 2: did a person from the business do anything 7–14 days after
  // first value? A person, not the scheduler: an audit row with a user on
  // it, or a sign-in.
  await Promise.all(
    journeys.map(async (j) => {
      const valueAt = j.at.replySent;
      const businessId = userByEmail.get(j.email)?.businessId;
      if (!isActivated(j) || !(valueAt instanceof Date) || !businessId) return;
      const from = new Date(valueAt.getTime() + WEEK);
      const to = new Date(valueAt.getTime() + 2 * WEEK);
      if (now < from) return;
      const until = now < to ? now : to;
      const [acted, signedIn] = await Promise.all([
        prisma.auditEvent.count({ where: { businessId, userId: { not: null }, createdAt: { gte: from, lt: until } } }),
        prisma.signIn.count({ where: { user: { businessId }, createdAt: { gte: from, lt: until } } }),
      ]);
      if (acted + signedIn > 0) j.cameBackWeek2 = true;
      else if (now >= to) j.cameBackWeek2 = false;
    })
  );

  return buildActivation(journeys, now);
}

/**
 * Testers past their first reply who have stalled since (findStopped in
 * src/lib/activation.ts), for the daily stuck-testers email only. Like
 * loadActivation it reads every tester without a sign-in check, so it runs
 * only from that email, behind the cron secret. "Waiting" is the queue the
 * tester's own Today shows (getPendingApprovals, Later set aside), so the
 * email can never count a reply their screen doesn't show them.
 */
export async function loadStopped(now: Date = new Date()): Promise<StoppedTester[]> {
  const { testers, userByEmail } = await loadTesterUsers();
  const cutoff = now.getTime() - STOPPED_WAIT_DAYS * DAY;
  const read = async (t: (typeof testers)[number]): Promise<StoppedFacts | null> => {
    const businessId = userByEmail.get(t.email)?.businessId;
    if (!businessId) return null;
    // Short of a first reply: the stuck list already names them.
    const sentOnce = await prisma.followUp.findFirst({ where: { ...FIRST_VALUE_SEND, lead: { businessId } }, select: { id: true } });
    if (!sentOnce) return null;
    const [approvals, inboxes, opened, signedIn] = await Promise.all([
      getPendingApprovals(businessId, now),
      prisma.integration.findMany({
        where: { provider: { in: ["gmail", "outlook"] }, user: { businessId } },
        select: { status: true },
      }),
      prisma.auditEvent.findFirst({ where: { businessId, action: APP_OPEN }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      prisma.signIn.findFirst({ where: { user: { businessId } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    ]);
    const waiting = onTodayNow(approvals).filter((a) => a.source !== TEST_LEAD_SOURCE && a.heldAt.getTime() <= cutoff);
    const oldest = waiting.length ? Math.min(...waiting.map((a) => a.heldAt.getTime())) : null;
    const seen = [opened?.createdAt, signedIn?.createdAt].filter((d): d is Date => !!d);
    const lastSeen = seen.length ? Math.max(...seen.map((d) => d.getTime())) : null;
    return {
      id: t.id,
      name: t.name,
      email: t.email,
      business: t.business,
      waiting: waiting.length,
      oldestWaitDays: oldest === null ? null : Math.floor((now.getTime() - oldest) / DAY),
      inboxDisconnected: inboxes.length > 0 && !inboxes.some((i) => i.status === "connected"),
      quietDays: lastSeen === null ? null : Math.floor((now.getTime() - lastSeen) / DAY),
    };
  };
  // A few testers at a time: each reads its whole Today queue, and the
  // daily job that sends this has other work inside the same minute.
  const facts: (StoppedFacts | null)[] = [];
  for (let i = 0; i < testers.length; i += 5) facts.push(...(await Promise.all(testers.slice(i, i + 5).map(read))));
  return findStopped(facts.filter((f): f is StoppedFacts => f !== null));
}
