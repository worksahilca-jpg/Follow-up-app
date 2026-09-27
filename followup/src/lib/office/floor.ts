/**
 * The floor: what the office looks like right now, in one query set.
 *
 * The headline number here is deliberately unflattering — `liveDesks` out
 * of `totalDesks`. Seven job descriptions that only exist while someone has
 * a session open is not an office, and the page should say so until it
 * isn't true any more.
 */

import { prisma } from "@/lib/db";
import { startOfUtcDay } from "@/lib/office/runner";
import { requirePlatformAdmin } from "@/lib/platformAdmin";

export interface DeskView {
  key: string;
  title: string;
  brief: string;
  wakesOn: string;
  gate: string;
  live: boolean;
  enabled: boolean;
  dailyCostCeilingUsd: number;
  spentTodayUsd: number;
  lastRun: {
    id: string;
    status: string;
    summary: string;
    trigger: string;
    startedAt: Date;
    costUsd: number;
    hasOutput: boolean;
  } | null;
}

export interface RunView {
  id: string;
  roleTitle: string;
  status: string;
  summary: string;
  trigger: string;
  startedAt: Date;
  costUsd: number;
  output: string;
  error: string | null;
}

export interface Floor {
  desks: DeskView[];
  recent: RunView[];
  liveDesks: number;
  totalDesks: number;
  spentTodayUsd: number;
  runsToday: number;
}

export async function getFloor(now: Date = new Date()): Promise<Floor> {
  // Its own check, not only the page's: the same belt-and-braces rule
  // getPlatformAdminData() follows. A layout is not a security boundary in
  // the App Router (see the note in src/app/admin/office/page.tsx), so the
  // function that reads cross-tenant rows proves the caller itself.
  await requirePlatformAdmin();
  const dayStart = startOfUtcDay(now);

  const [roles, todayByRole, recent, runsToday] = await Promise.all([
    prisma.agentRole.findMany({
      orderBy: [{ live: "desc" }, { title: "asc" }],
      include: {
        runs: {
          orderBy: { startedAt: "desc" },
          take: 1,
          select: { id: true, status: true, summary: true, trigger: true, startedAt: true, costUsd: true, output: true },
        },
      },
    }),
    prisma.agentRun.groupBy({
      by: ["roleId"],
      where: { startedAt: { gte: dayStart } },
      _sum: { costUsd: true },
    }),
    prisma.agentRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 12,
      include: { role: { select: { title: true } } },
    }),
    prisma.agentRun.count({ where: { startedAt: { gte: dayStart } } }),
  ]);

  const spendByRole = new Map(todayByRole.map((r) => [r.roleId, r._sum.costUsd ?? 0]));

  const desks: DeskView[] = roles.map((role) => {
    const last = role.runs[0];
    return {
      key: role.key,
      title: role.title,
      brief: role.brief,
      wakesOn: role.wakesOn,
      gate: role.gate,
      live: role.live,
      enabled: role.enabled,
      dailyCostCeilingUsd: role.dailyCostCeilingUsd,
      spentTodayUsd: spendByRole.get(role.id) ?? 0,
      lastRun: last
        ? {
            id: last.id,
            status: last.status,
            summary: last.summary,
            trigger: last.trigger,
            startedAt: last.startedAt,
            costUsd: last.costUsd,
            hasOutput: last.output.length > 0,
          }
        : null,
    };
  });

  return {
    desks,
    recent: recent.map((r) => ({
      id: r.id,
      roleTitle: r.role.title,
      status: r.status,
      summary: r.summary,
      trigger: r.trigger,
      startedAt: r.startedAt,
      costUsd: r.costUsd,
      output: r.output,
      error: r.error,
    })),
    liveDesks: desks.filter((d) => d.live && d.enabled).length,
    totalDesks: desks.length,
    spentTodayUsd: [...spendByRole.values()].reduce((a, b) => a + b, 0),
    runsToday,
  };
}
