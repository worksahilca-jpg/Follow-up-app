import { prisma } from "@/lib/db";
import { CRM_PROVIDERS, isCrmProvider } from "@/lib/crm";
import type { CrmStage } from "@/lib/crm/types";
import { writeToCrm } from "@/lib/crm/writes";
import type { Qualification, Tier } from "@/lib/qualification";

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
  /** Why they moved (A-303), shown on the record: "They said: “probably in about 3 months”". */
  why?: string;
}

export function stageWriteText(w: StageWrite): string {
  return JSON.stringify(w);
}

export function readStageWrite(text: string): StageWrite | null {
  try {
    const v = JSON.parse(text) as Partial<StageWrite>;
    if (typeof v.stageId !== "string" || typeof v.label !== "string" || typeof v.name !== "string") return null;
    return { stageId: v.stageId, label: v.label, name: v.name, ...(typeof v.why === "string" && v.why ? { why: v.why } : {}) };
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

/*
 * "When FollowUp sorts them" (A-303, founder 2026-10-20: "Yes" to the drawing, after the first realtor asked for it to
 * be fully automatic): when a customer becomes Ready, Warm or Later (src/lib/qualification.ts), they move to the
 * owner's own stage for it in their CRM, and back again when what they say changes. Same writes, on record and tried
 * again, as the booked move above. A customer with a meeting booked stays where the booking put them.
 */

export type SortTier = "ready" | "warm" | "later";
export const SORT_TIERS: readonly SortTier[] = ["ready", "warm", "later"];
const isSortTier = (t: unknown): t is SortTier => typeof t === "string" && (SORT_TIERS as readonly string[]).includes(t);

/** The owner's choice for each: one of their stages, or null for "Don't move them". A tier left out isn't chosen yet. */
export type TierStages = Partial<Record<SortTier, CrmStage | null>>;

/** A stored choice, read defensively: anything off-shape counts as not chosen. */
export function readTierStages(value: unknown): TierStages {
  if (!value || typeof value !== "object") return {};
  const out: TierStages = {};
  for (const tier of SORT_TIERS) {
    const v = (value as Record<string, unknown>)[tier];
    if (v === null) out[tier] = null;
    else if (v && typeof v === "object") {
      const s = v as Record<string, unknown>;
      if (typeof s.id === "string" && s.id && typeof s.name === "string") out[tier] = { id: s.id, name: s.name };
    }
  }
  return out;
}

const LATER = /long[\s-]*term|\bcold\b|\blater\b|\bfuture\b/i;
const READY = /\bhot\b|\bready\b/i;
const WARM = /\bwarm\b|\bnurtur/i;

/** FollowUp's pick until the owner chooses: the stage whose name reads like it ("Hot", "Nurture", "Long-term Nurture"). */
export function tierStageByName(tier: SortTier, stages: CrmStage[]): CrmStage | null {
  const pattern = tier === "ready" ? READY : tier === "warm" ? WARM : LATER;
  return stages.find((s) => pattern.test(s.name) && (tier === "later" || !LATER.test(s.name))) ?? null;
}

/** Where a customer in this tier goes: the owner's choice, or FollowUp's pick by name. null: don't move them. */
export async function tierStage(conn: { provider: string; apiKey: string; tierStages: unknown }, tier: SortTier): Promise<CrmStage | null> {
  const chosen = readTierStages(conn.tierStages)[tier];
  if (chosen === null) return null;
  if (chosen) return chosen;
  if (!isCrmProvider(conn.provider)) return null;
  return tierStageByName(tier, await CRM_PROVIDERS[conn.provider].client.listStages(conn.apiKey));
}

/**
 * Why they moved, in the words that moved them: what decided the tier, quoted. "They said: …", or "From your note: …"
 * for the owner's own note (A-303). null when nothing quotable decided it.
 */
export function tierMoveWhy(q: Qualification | null, tier: Tier | null | undefined): string | null {
  if (!q || !isSortTier(tier)) return null;
  const keys = tier === "ready" ? ["viewing", "financing", "timing"] : ["timing", "financing"];
  for (const key of keys) {
    const item = q.items.find((i) => i.key === key && i.quote.trim());
    if (item) return `${item.source === "note" ? "From your note" : "They said"}: “${item.quote.trim()}”`;
  }
  return null;
}

/**
 * When a customer's tier changes: move them to the owner's stage for it. Once per change (Lead.crmTierMoved, claimed
 * so two passes never both move them), never while a meeting is booked, and only in the CRM the business is still
 * connected to. Never throws; never holds up the reply that called it.
 */
export async function moveLeadForTier(
  lead: { id: string; businessId: string; name: string; crmProvider: string | null; crmId: string | null },
  tier: Tier | null | undefined,
  why: string | null
): Promise<void> {
  try {
    if (!isSortTier(tier) || !lead.crmProvider || !lead.crmId || !isCrmProvider(lead.crmProvider)) return;
    const conn = await prisma.crmConnection.findUnique({ where: { businessId: lead.businessId }, select: { provider: true, apiKey: true, tierStages: true } });
    if (!conn?.apiKey || conn.provider !== lead.crmProvider) return;
    const booked = await prisma.booking.findFirst({
      where: { leadId: lead.id, businessId: lead.businessId, status: "confirmed", scheduledAt: { gte: new Date() } },
      select: { id: true },
    });
    if (booked) return;
    // Claimed first: whichever pass gets here first moves them; a "Don't move them" is remembered the same way.
    const claimed = await prisma.lead.updateMany({
      where: { id: lead.id, OR: [{ crmTierMoved: null }, { crmTierMoved: { not: tier } }] },
      data: { crmTierMoved: tier },
    });
    if (claimed.count === 0) return;
    const stage = await tierStage({ ...conn, apiKey: conn.apiKey }, tier);
    if (!stage) return;
    await writeToCrm({
      businessId: lead.businessId,
      leadId: lead.id,
      provider: lead.crmProvider,
      crmId: lead.crmId,
      kind: "stage",
      text: stageWriteText({ stageId: stage.id, label: stage.name, name: lead.name, ...(why ? { why } : {}) }),
    });
  } catch (err) {
    console.error(`Moving lead ${lead.id} in the CRM for its tier failed:`, err instanceof Error ? err.message : err);
  }
}
