/**
 * Per-business data export and full deletion — the GDPR/PIPEDA "right of
 * access" and "right to erasure" pair, kept in one file because both need
 * the same map of every table a business's data actually lives in.
 *
 * No cascade deletes are configured from Business (see schema.prisma — the
 * only 3 onDelete annotations in the whole schema are SequenceStep→Sequence,
 * Lead→Sequence, and SourceRule→Sequence), so a full deletion has to remove
 * every dependent row itself, inside one transaction, in an order Postgres
 * will actually accept: whatever references something else through a
 * required foreign key has to go first (Message before Conversation,
 * SavedFilter/Notification/Integration before User). Mirrors the same
 * leaf-first pattern deleteLeadCascade() uses for a single lead
 * (src/lib/leads-admin.ts), just scoped to every lead a business has
 * instead of one.
 */

import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { getStripe } from "@/lib/stripe";

export interface BusinessExport {
  exportedAt: string;
  business: Record<string, unknown>;
  users: Record<string, unknown>[];
  leads: Record<string, unknown>[];
  conversations: Record<string, unknown>[];
  messages: Record<string, unknown>[];
  deals: Record<string, unknown>[];
  followUps: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  bookings: Record<string, unknown>[];
  sequences: Record<string, unknown>[];
  sourceRules: Record<string, unknown>[];
  savedFilters: Record<string, unknown>[];
  invites: Record<string, unknown>[];
  notifications: Record<string, unknown>[];
  automations: Record<string, unknown>[];
  crmConnection: Record<string, unknown> | null;
  productFeedback: Record<string, unknown>[];
  auditLog: Record<string, unknown>[];
}

/**
 * Everything a business's data actually consists of — never a credential.
 * Deliberately leaves out Gmail/Outlook OAuth tokens, the Twilio auth
 * token, the CRM API key, both webhook secrets, and the raw Stripe
 * customer/subscription IDs: none of that is "your data" in the
 * GDPR-access sense, and a downloadable export is just a new place for a
 * secret to leak from. subscriptionStatus alone (kept) already answers
 * the one billing question this file would otherwise exist to answer.
 */
export async function exportBusinessData(businessId: string): Promise<BusinessExport | null> {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) return null;

  const [
    users,
    leads,
    conversations,
    messages,
    deals,
    followUps,
    tasks,
    bookings,
    sequences,
    sourceRules,
    savedFilters,
    invites,
    notifications,
    automations,
    crmConnection,
    productFeedback,
    auditLog,
  ] = await Promise.all([
    prisma.user.findMany({
      where: { businessId },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    }),
    prisma.lead.findMany({ where: { businessId } }),
    prisma.conversation.findMany({ where: { lead: { businessId } } }),
    prisma.message.findMany({ where: { conversation: { lead: { businessId } } } }),
    prisma.deal.findMany({ where: { lead: { businessId } } }),
    prisma.followUp.findMany({ where: { lead: { businessId } } }),
    prisma.task.findMany({ where: { lead: { businessId } } }),
    prisma.booking.findMany({ where: { businessId } }),
    prisma.sequence.findMany({ where: { businessId }, include: { steps: true } }),
    prisma.sourceRule.findMany({ where: { businessId } }),
    prisma.savedFilter.findMany({ where: { businessId } }),
    prisma.invite.findMany({ where: { businessId } }),
    prisma.notification.findMany({ where: { user: { businessId } } }),
    prisma.automation.findMany({ where: { businessId } }),
    prisma.crmConnection.findUnique({
      where: { businessId },
      select: { id: true, provider: true, accountLabel: true, lastSyncedAt: true, lastSyncError: true, createdAt: true },
    }),
    prisma.productFeedback.findMany({ where: { businessId } }),
    prisma.auditEvent.findMany({ where: { businessId }, orderBy: { createdAt: "desc" } }),
  ]);

  // Picked explicitly (rather than destructuring-and-omitting the secret
  // fields) so a new secret field added to Business later has to be added
  // here on purpose to ever reach an export — the safe default is leaving
  // it out, not accidentally including it.
  const safeBusiness = {
    id: business.id,
    name: business.name,
    industry: business.industry,
    teamSize: business.teamSize,
    avgDealValue: business.avgDealValue,
    primaryChannels: business.primaryChannels,
    onboarded: business.onboarded,
    createdAt: business.createdAt,
    timezone: business.timezone,
    allowModelTraining: business.allowModelTraining,
    voiceAgentEnabled: business.voiceAgentEnabled,
    subscriptionStatus: business.subscriptionStatus,
    currentPeriodEnd: business.currentPeriodEnd,
    outboundWebhookUrl: business.outboundWebhookUrl,
    twilioAccountSid: business.twilioAccountSid,
    twilioPhoneNumber: business.twilioPhoneNumber,
    whatsappPhoneNumber: business.whatsappPhoneNumber,
    instagramUserId: business.instagramUserId,
    facebookPageId: business.facebookPageId,
    facebookPageName: business.facebookPageName,
  };

  return {
    exportedAt: new Date().toISOString(),
    business: safeBusiness,
    users,
    leads,
    conversations,
    messages,
    deals,
    followUps,
    tasks,
    bookings,
    sequences,
    sourceRules,
    savedFilters,
    invites,
    notifications,
    automations,
    crmConnection,
    productFeedback,
    auditLog,
  };
}

export type DeletionResult = { success: true } | { success: false; message: string };

/**
 * Permanently deletes a business and everything under it. Irreversible —
 * callers must get their own explicit confirmation (e.g. the business name
 * typed back) before calling this; this function itself only guards against
 * a bad businessId, not against being called by mistake.
 */
export async function deleteBusinessData(
  businessId: string,
  initiatedBy: { userId: string; email: string }
): Promise<DeletionResult> {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) return { success: false, message: "Business not found." };

  // Stop billing before touching any data — a business asking to be erased
  // should never keep being charged while the deletion is in flight, and
  // this has to happen outside the transaction below since it's a call to
  // Stripe, not the database.
  if (business.stripeSubscriptionId) {
    try {
      await getStripe().subscriptions.cancel(business.stripeSubscriptionId);
    } catch (err) {
      // Already canceled, or billing isn't configured in this environment
      // — either way, that can never block the business's own request to
      // be erased.
      console.error(`Stripe cancellation failed for business ${businessId} during deletion:`, err);
    }
  }

  await prisma.$transaction([
    prisma.message.deleteMany({ where: { conversation: { lead: { businessId } } } }),
    prisma.conversation.deleteMany({ where: { lead: { businessId } } }),
    prisma.aIInsight.deleteMany({ where: { lead: { businessId } } }),
    prisma.deal.deleteMany({ where: { lead: { businessId } } }),
    prisma.followUp.deleteMany({ where: { lead: { businessId } } }),
    prisma.task.deleteMany({ where: { lead: { businessId } } }),
    prisma.booking.deleteMany({ where: { businessId } }),
    prisma.lead.deleteMany({ where: { businessId } }),
    prisma.savedFilter.deleteMany({ where: { businessId } }),
    prisma.sourceRule.deleteMany({ where: { businessId } }),
    // SequenceStep isn't listed here — onDelete: Cascade on its own
    // relation to Sequence (schema.prisma) removes those automatically.
    prisma.sequence.deleteMany({ where: { businessId } }),
    prisma.automation.deleteMany({ where: { businessId } }),
    prisma.invite.deleteMany({ where: { businessId } }),
    prisma.productFeedback.deleteMany({ where: { businessId } }),
    prisma.rateLimitHit.deleteMany({ where: { businessId } }),
    prisma.filteredEmail.deleteMany({ where: { businessId } }),
    prisma.crmConnection.deleteMany({ where: { businessId } }),
    prisma.notification.deleteMany({ where: { user: { businessId } } }),
    prisma.integration.deleteMany({ where: { user: { businessId } } }),
    prisma.user.deleteMany({ where: { businessId } }),
    prisma.business.delete({ where: { id: businessId } }),
  ]);

  // AuditEvent is deliberately not a relation to Business or User
  // (schema.prisma: "an audit row must outlive the thing it describes") —
  // this write survives the transaction above by design, so the erasure
  // itself leaves a permanent record even though everything else is gone.
  await recordAudit({ businessId, userId: initiatedBy.userId }, "business.delete", {
    targetType: "business",
    targetId: businessId,
    meta: { businessName: business.name, initiatedByEmail: initiatedBy.email },
  });

  return { success: true };
}
