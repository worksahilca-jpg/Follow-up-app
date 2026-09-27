import { prisma } from "@/lib/db";
import { getBusinessAutomationRules } from "@/lib/automationStatus";
import { getComingUp, groupByDay } from "@/lib/comingUp";
import type { Lead } from "@/lib/types";

/**
 * Coming up for one business, grouped by day in its own time zone.
 * `exclude` is everyone already in "Needs your OK": each person once (A-046).
 */
export async function loadComingUp(businessId: string, leads: Lead[], exclude: Set<string>, timeZone: string, now = new Date()) {
  const [rules, business] = await Promise.all([
    getBusinessAutomationRules(businessId),
    prisma.business.findUnique({ where: { id: businessId }, select: { holdAllForApproval: true } }),
  ]);
  const items = getComingUp(leads, rules, now, exclude);
  return { groups: groupByDay(items, now, timeZone), total: items.length, holdAll: business?.holdAllForApproval ?? true };
}
