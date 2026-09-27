import { getLeads } from "@/lib/leads-data";
import { getSessionContext } from "@/lib/session";
import { getPendingApprovals } from "@/lib/pendingApprovals";
import { getBusinessAutomationRules } from "@/lib/automationStatus";
import { getWaitingOn } from "@/lib/waitingOn";
import { getAtRiskLeads } from "@/lib/rescue";
import { prisma } from "@/lib/db";
import LeadsPageClient from "./LeadsPageClient";

export const dynamic = "force-dynamic";

/**
 * Customers (canvas App board, "People"): the table plus the canvas's four
 * places, All · Needs you · Going quiet · Waiting. Each place is worked out
 * here from the same sources Today uses, so the counts always agree:
 * Needs you is the approval queue, Waiting is the Waiting-on-customers
 * list, Going quiet is About to be lost (minus anyone already needing you).
 */
export default async function LeadsPage() {
  const ctx = await getSessionContext();
  const leads = await getLeads();
  if (!ctx) return <LeadsPageClient leads={leads} places={{ needs: [], quiet: [], waiting: [] }} />;

  const now = new Date();
  const [approvals, business, rules] = await Promise.all([
    getPendingApprovals(ctx.businessId),
    prisma.business.findUnique({ where: { id: ctx.businessId }, select: { timezone: true } }),
    getBusinessAutomationRules(ctx.businessId),
  ]);
  const needs = new Set(approvals.map((a) => a.leadId));
  const waiting = rules
    ? getWaitingOn(leads, rules, now, business?.timezone ?? "America/New_York", needs).map((w) => w.leadId)
    : [];
  const quiet = getAtRiskLeads(leads, now)
    .map((l) => l.id)
    .filter((id) => !needs.has(id));

  return <LeadsPageClient leads={leads} places={{ needs: [...needs], quiet, waiting }} />;
}
