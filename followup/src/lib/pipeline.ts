/**
 * Pure, client-safe pipeline grouping — deliberately its own file, not part
 * of leads-data.ts. getPipelineData() only ever groups an already-fetched
 * Lead[] by stage; it never touches Prisma. But leads-data.ts (where it
 * used to live) imports { prisma } from "@/lib/db" at module scope for its
 * *other* exports (getLeads, getWeeklyReport, etc.) — and PipelinePageClient
 * ("use client") importing getPipelineData from that file forced the whole
 * module, Prisma import included, into the browser bundle. @prisma/client
 * throws immediately when evaluated outside Node ("PrismaClient is unable
 * to run in this browser environment"), which is exactly the error users
 * hit opening /pipeline. Moving the pure function here, with no server-only
 * import in sight, is the fix — see leads-data.ts's re-export for why
 * nothing else had to change.
 */
import type { Lead } from "@/lib/types";
import { PIPELINE_STAGES } from "@/lib/demo-data";

export function getPipelineData(leads: Lead[]) {
  return PIPELINE_STAGES.map((stage) => {
    const stageLeads = leads.filter((l) => l.stage === stage.id);
    return {
      ...stage,
      leads: stageLeads,
      value: stageLeads.reduce((sum, l) => sum + l.dealValue, 0),
    };
  });
}
