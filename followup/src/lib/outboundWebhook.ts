import { prisma } from "@/lib/db";
import type { Lead } from "@prisma/client";

/**
 * Outbound lead-event webhook — the reverse direction of the inbound one
 * (src/app/api/webhooks/lead/[secret]/route.ts). That one lets other tools
 * push leads INTO FollowUp; this lets FollowUp push lead events OUT to
 * whatever a business already uses downstream — their real CRM via a
 * Zapier/Make step, a Slack channel, a spreadsheet, anything that can
 * receive a webhook. Configured per-business in Settings (see
 * src/app/api/webhooks/outbound/route.ts), null until they set one.
 *
 * Fire-and-forget by design: a slow or dead downstream URL must never slow
 * down or fail the actual lead-creation/stage-change request it's reporting
 * on, so every call site does `notifyLeadEvent(...).catch(() => {})` (or
 * just doesn't await it) rather than awaiting this inline. Errors are
 * swallowed here too, for the same reason — this is a best-effort notify,
 * not a critical path.
 *
 * Scope for v1: fired on new-lead creation from the three external-facing
 * sources (manual add, embed widget, generic inbound webhook) and on
 * Gmail-synced new leads, plus every pipeline stage change. Deliberately
 * NOT fired from CSV bulk import — a 500-row import would otherwise fire
 * 500 requests at whatever URL is configured, which is more likely to look
 * like an accidental flood than a useful notification.
 */

type LeadEventType = "lead.created" | "lead.stage_changed";

export async function notifyLeadEvent(
  businessId: string,
  event: LeadEventType,
  lead: Pick<Lead, "id" | "name" | "email" | "phone" | "source" | "stage" | "dealValue" | "createdAt">,
  extra?: Record<string, unknown>
): Promise<void> {
  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { outboundWebhookUrl: true },
    });
    const url = business?.outboundWebhookUrl;
    if (!url) return;

    const payload = {
      event,
      leadId: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      source: lead.source,
      stage: lead.stage,
      dealValue: lead.dealValue,
      createdAt: lead.createdAt.toISOString(),
      timestamp: new Date().toISOString(),
      ...extra,
    };

    // AbortSignal.timeout keeps a dead/slow endpoint from ever hanging this
    // request past a few seconds — this is best-effort delivery, not a
    // guaranteed one, so there's no retry queue here.
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // Swallow — see file header. The downstream tool being down or the URL
    // being stale is that business's problem to notice, not a reason to
    // fail the lead operation that triggered this.
  }
}
