import { prisma } from "@/lib/db";
import { CRM_PROVIDERS, isCrmProvider } from "@/lib/crm";
import type { CrmStage } from "@/lib/crm/types";
import { writeToCrm } from "@/lib/crm/writes";

/**
 * "When they book a meeting, move them to …" (A-275, founder 2026-10-17: "If the CRM is his main thing … we got to
 * move it in his CRM. Plus, we'll say 'booked' in our memory too, so that we don't text him."). FollowUp remembers the
 * booking itself (Booking stops the follow-ups); this moves the person to the owner's chosen stage in their CRM, on
 * record and tried again like every other write (src/lib/crm/writes.ts).
 */

/** The stage whose name reads like a meeting: FollowUp's pick until the owner chooses one. */
const MEETING = /appoint|book|meeting|showing|scheduled|tour|consult/i;

export function meetingStage(stages: CrmStage[]): CrmStage | null {
  return stages.find((s) => MEETING.test(s.name)) ?? null;
}

/** What a stage write carries: kept as the write's text, so a later try moves them to the same place. */
export interface StageWrite {
  stageId: string;
  label: string;
  name: string;
}

export function stageWriteText(w: StageWrite): string {
  return JSON.stringify(w);
}

export function readStageWrite(text: string): StageWrite | null {
  try {
    const v = JSON.parse(text) as Partial<StageWrite>;
    return typeof v.stageId === "string" && typeof v.label === "string" && typeof v.name === "string" ? (v as StageWrite) : null;
  } catch {
    return null;
  }
}

/**
 * The stage to move a booked customer to: the owner's choice, or, while they haven't chosen, the one that reads like a
 * meeting. null: "Don't move them", or nothing fits.
 */
export async function bookedStage(conn: { provider: string; apiKey: string; bookedStage: string | null; bookedStageLabel: string | null }): Promise<CrmStage | null> {
  if (conn.bookedStage === "") return null;
  if (conn.bookedStage) return { id: conn.bookedStage, name: conn.bookedStageLabel ?? conn.bookedStage };
  if (!isCrmProvider(conn.provider)) return null;
  return meetingStage(await CRM_PROVIDERS[conn.provider].client.listStages(conn.apiKey));
}

/** After a booking: the customer moves to that stage in their CRM. Never throws; never fails the booking. */
export async function moveBookedLead(lead: { id: string; businessId: string; name: string; crmProvider: string | null; crmId: string | null }): Promise<void> {
  try {
    if (!lead.crmProvider || !lead.crmId || !isCrmProvider(lead.crmProvider)) return;
    const conn = await prisma.crmConnection.findUnique({
      where: { businessId: lead.businessId },
      select: { provider: true, apiKey: true, bookedStage: true, bookedStageLabel: true },
    });
    if (!conn?.apiKey || conn.provider !== lead.crmProvider) return;
    const stage = await bookedStage({ ...conn, apiKey: conn.apiKey });
    if (!stage) return;
    await writeToCrm({
      businessId: lead.businessId,
      leadId: lead.id,
      provider: lead.crmProvider,
      crmId: lead.crmId,
      kind: "stage",
      text: stageWriteText({ stageId: stage.id, label: stage.name, name: lead.name }),
    });
  } catch (err) {
    console.error(`Moving booked lead ${lead.id} in the CRM failed:`, err);
  }
}
