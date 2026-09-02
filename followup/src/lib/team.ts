/**
 * Real team management — invites, roles, membership. Replaces the demo
 * `team` array (src/lib/demo-data.ts) that used to render the Settings
 * page's Team section; this reads real Users for the signed-in business
 * and computes each one's stats from their actually-assigned leads.
 *
 * Roles: ADMIN can invite, change roles, and remove members; SALES can
 * only view the team. Every mutating function here takes an explicit
 * actingUserId and re-checks that user's role itself — never trust a
 * client-sent "I'm an admin" claim.
 *
 * Multi-tenant: every query is scoped to businessId, including invites
 * (an email can be invited to more than one business over time, but only
 * ever holds one live Invite per business — see @@unique([businessId,
 * email]) on the schema).
 */

import { prisma } from "@/lib/db";
import type { TeamRole } from "@prisma/client";

export interface TeamMemberSummary {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  assignedLeads: number;
  followUpsCompleted: number;
  overdueFollowUps: number;
  dealsWon: number;
  revenueGenerated: number;
}

export interface PendingInvite {
  id: string;
  email: string;
  role: TeamRole;
  createdAt: string;
}

export interface TeamData {
  members: TeamMemberSummary[];
  invites: PendingInvite[];
  currentUserRole: TeamRole;
}

async function memberStats(userId: string, businessId: string): Promise<Omit<TeamMemberSummary, "id" | "name" | "email" | "role">> {
  const [assignedLeads, followUpsCompleted, overdueFollowUps, wonLeads] = await Promise.all([
    prisma.lead.count({ where: { businessId, assignedToId: userId } }),
    prisma.followUp.count({ where: { status: "sent", lead: { businessId, assignedToId: userId } } }),
    prisma.lead.count({
      where: {
        businessId,
        assignedToId: userId,
        stage: { notIn: ["WON", "LOST"] },
        nextFollowUp: { lt: new Date() },
      },
    }),
    prisma.lead.findMany({ where: { businessId, assignedToId: userId, stage: "WON" }, select: { dealValue: true } }),
  ]);

  return {
    assignedLeads,
    followUpsCompleted,
    overdueFollowUps,
    dealsWon: wonLeads.length,
    revenueGenerated: wonLeads.reduce((sum, l) => sum + l.dealValue, 0),
  };
}

/** Everything the Settings page's Team section needs, for the signed-in user's own business. */
export async function getTeamData(businessId: string, actingUserId: string): Promise<TeamData | null> {
  const [users, invites, actingUser] = await Promise.all([
    prisma.user.findMany({ where: { businessId }, orderBy: { createdAt: "asc" } }),
    prisma.invite.findMany({ where: { businessId }, orderBy: { createdAt: "asc" } }),
    prisma.user.findUnique({ where: { id: actingUserId }, select: { role: true, businessId: true } }),
  ]);
  if (!actingUser || actingUser.businessId !== businessId) return null;

  const members = await Promise.all(
    users.map(async (u) => ({
      id: u.id,
      name: u.name ?? u.email.split("@")[0],
      email: u.email,
      role: u.role,
      ...(await memberStats(u.id, businessId)),
    }))
  );

  return {
    members,
    invites: invites.map((i) => ({ id: i.id, email: i.email, role: i.role, createdAt: i.createdAt.toISOString() })),
    currentUserRole: actingUser.role,
  };
}

async function requireAdmin(businessId: string, actingUserId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const actingUser = await prisma.user.findUnique({ where: { id: actingUserId }, select: { role: true, businessId: true } });
  if (!actingUser || actingUser.businessId !== businessId) return { ok: false, message: "Not found." };
  if (actingUser.role !== "ADMIN") return { ok: false, message: "Only admins can manage the team." };
  return { ok: true };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function inviteMember(
  businessId: string,
  actingUserId: string,
  emailRaw: string,
  role: TeamRole
): Promise<{ success: true } | { success: false; message: string }> {
  const admin = await requireAdmin(businessId, actingUserId);
  if (!admin.ok) return { success: false, message: admin.message };

  const email = emailRaw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { success: false, message: "That doesn't look like a valid email." };

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser?.businessId === businessId) {
    return { success: false, message: "That person is already on your team." };
  }
  if (existingUser?.businessId) {
    return { success: false, message: "That email already belongs to a different team." };
  }

  await prisma.invite.upsert({
    where: { businessId_email: { businessId, email } },
    update: { role },
    create: { businessId, email, role },
  });
  return { success: true };
}

export async function cancelInvite(inviteId: string, businessId: string, actingUserId: string): Promise<{ success: boolean; message?: string }> {
  const admin = await requireAdmin(businessId, actingUserId);
  if (!admin.ok) return { success: false, message: admin.message };

  const invite = await prisma.invite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.businessId !== businessId) return { success: false, message: "Invite not found." };

  await prisma.invite.delete({ where: { id: inviteId } });
  return { success: true };
}

async function countAdmins(businessId: string): Promise<number> {
  return prisma.user.count({ where: { businessId, role: "ADMIN" } });
}

export async function updateMemberRole(
  targetUserId: string,
  businessId: string,
  actingUserId: string,
  role: TeamRole
): Promise<{ success: true } | { success: false; message: string }> {
  const admin = await requireAdmin(businessId, actingUserId);
  if (!admin.ok) return { success: false, message: admin.message };

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target || target.businessId !== businessId) return { success: false, message: "Team member not found." };

  if (target.role === "ADMIN" && role !== "ADMIN" && (await countAdmins(businessId)) <= 1) {
    return { success: false, message: "Can't demote the only admin — promote someone else first." };
  }

  await prisma.user.update({ where: { id: targetUserId }, data: { role } });
  return { success: true };
}

export async function removeMember(
  targetUserId: string,
  businessId: string,
  actingUserId: string
): Promise<{ success: true; warning?: string } | { success: false; message: string }> {
  const admin = await requireAdmin(businessId, actingUserId);
  if (!admin.ok) return { success: false, message: admin.message };
  if (targetUserId === actingUserId) return { success: false, message: "You can't remove yourself — ask another admin." };

  const target = await prisma.user.findUnique({ where: { id: targetUserId }, include: { integrations: true } });
  if (!target || target.businessId !== businessId) return { success: false, message: "Team member not found." };

  if (target.role === "ADMIN" && (await countAdmins(businessId)) <= 1) {
    return { success: false, message: "Can't remove the only admin — promote someone else first." };
  }

  // Their leads shouldn't stay assigned to someone no longer on the team;
  // free them up rather than leaving a dangling "assigned to" that no
  // longer shows up anywhere real.
  await prisma.$transaction([
    prisma.lead.updateMany({ where: { businessId, assignedToId: targetUserId }, data: { assignedToId: null } }),
    prisma.user.update({ where: { id: targetUserId }, data: { businessId: null } }),
  ]);

  const hadConnectedIntegration = target.integrations.some((i) => i.status === "connected");
  return {
    success: true,
    warning: hadConnectedIntegration
      ? "This person had a connected integration (Gmail/Calendar) — that connection will stop working. Reconnect it under a remaining team member if your business relies on it."
      : undefined,
  };
}
