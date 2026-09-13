/**
 * The roster.
 *
 * These five are the same five lanes described in `.claude/agents/` — that
 * directory stays the source of truth for *how* each one works (its tools,
 * its conventions, what it must refuse, its "before you're done" checks).
 * This file is the source of truth for how the office sees them: when they
 * wake up, what they may do without a human press, and whether a runner
 * exists for them yet.
 *
 * `live: false` is not a placeholder to be embarrassed about — a desk shows
 * on the floor whether or not it can be staffed today, because the gap
 * between "lanes I've written" and "lanes that run on their own" is the
 * single most useful number in this whole feature.
 *
 * Keep the keys matching the filenames in `.claude/agents/`. When a lane is
 * renamed there, rename it here in the same change: the floor showing a
 * desk that no longer exists is worse than showing nothing.
 */

import { prisma } from "@/lib/db";

export interface RoleSpec {
  key: string;
  title: string;
  brief: string;
  wakesOn: string;
  gate: string;
  live: boolean;
  dailyCostCeilingUsd: number;
}

export const ROLES: RoleSpec[] = [
  {
    key: "product-ux-agent",
    title: "Product & UX",
    brief:
      "Owns copy, positioning, onboarding wording and flow decisions — and the customer research behind them. Reads what the people actually using FollowUp said about it and reports the themes in their words rather than ours.",
    wakesOn: "Monday 06:00 UTC, and whenever you press Run now",
    gate: "Writes a findings note. Changes nothing.",
    live: true,
    dailyCostCeilingUsd: 0.5,
  },
  {
    key: "manager-agent",
    title: "Manager",
    brief: "Takes a goal rather than a ticket, splits it into workstreams, and hands each to the lane that owns it.",
    wakesOn: "Monday 07:00 UTC, and any goal you hand it",
    gate: "Plans and delegates. Has no Edit or Write access on purpose.",
    live: false,
    dailyCostCeilingUsd: 1.0,
  },
  {
    key: "backend-ai-agent",
    title: "Backend & AI",
    brief:
      "API routes, the Prisma schema, integrations, scoring and drafting, the voice agent, and the automation that sends anything.",
    wakesOn: "A workstream from the manager; a red CI run",
    gate: "Pushes a branch. Never opens the pull request, never merges.",
    live: false,
    dailyCostCeilingUsd: 2.0,
  },
  {
    key: "frontend-3d-agent",
    title: "Frontend & 3D",
    brief: "Every UI surface — the authenticated app, the landing page, and the motion and 3D work on both.",
    wakesOn: "A workstream from the manager",
    gate: "Pushes a branch. Never opens the pull request, never merges.",
    live: false,
    dailyCostCeilingUsd: 2.0,
  },
  {
    key: "qa-security-agent",
    title: "QA & security",
    brief:
      "Code audits, security review, the trust-guarantee tests, and what each integration really needs before it is safe to ship.",
    wakesOn: "An integration crossing its error threshold; before a release",
    gate: "Writes findings and tests. Hands the fix to backend-ai-agent.",
    live: false,
    dailyCostCeilingUsd: 1.0,
  },
];

export function findRoleSpec(key: string): RoleSpec | undefined {
  return ROLES.find((r) => r.key === key);
}

/**
 * Upsert the roster into the database. Idempotent, and safe to call on
 * every cron tick — the spec fields above are authoritative, but `enabled`
 * is not touched here: switching a desk off is an operator decision that
 * must survive a deploy.
 */
export async function syncRoles(): Promise<void> {
  for (const spec of ROLES) {
    const { key, ...rest } = spec;
    await prisma.agentRole.upsert({
      where: { key },
      create: { key, ...rest },
      update: {
        title: rest.title,
        brief: rest.brief,
        wakesOn: rest.wakesOn,
        gate: rest.gate,
        live: rest.live,
        dailyCostCeilingUsd: rest.dailyCostCeilingUsd,
      },
    });
  }
}
