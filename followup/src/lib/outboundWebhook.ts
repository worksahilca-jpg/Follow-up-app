import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import type { Lead } from "@prisma/client";
import { postJsonToTenantUrl } from "@/lib/ssrf";
import { newWebhookSecret, signatureHeader, SIGNATURE_HEADER } from "@/lib/webhookSignature";

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

/**
 * The business's signing secret, made the first time it's needed (a URL saved
 * before events were signed gets one on its next event). Only written where
 * none exists, so two events racing agree on one secret.
 */
export async function ensureWebhookSecret(businessId: string, current: string | null): Promise<string> {
  if (current) return current;
  const fresh = newWebhookSecret();
  const r = await prisma.business.updateMany({ where: { id: businessId, outboundWebhookSecret: null }, data: { outboundWebhookSecret: fresh } });
  if (r.count === 1) return fresh;
  const b = await prisma.business.findUnique({ where: { id: businessId }, select: { outboundWebhookSecret: true } });
  return b?.outboundWebhookSecret ?? fresh;
}

/**
 * The headers every event carries (A-252): what it is, a delivery id the
 * receiver can use to ignore a repeat, and the signature over the exact body
 * sent (src/lib/webhookSignature.ts).
 */
export function signedEventHeaders(secret: string, event: string): (body: string) => Record<string, string> {
  return (body) => ({
    "X-FollowUp-Event": event,
    "X-FollowUp-Delivery": randomUUID(),
    [SIGNATURE_HEADER]: signatureHeader(secret, body),
  });
}

export async function notifyLeadEvent(
  businessId: string,
  event: LeadEventType,
  lead: Pick<Lead, "id" | "name" | "email" | "phone" | "source" | "stage" | "dealValue" | "createdAt">,
  extra?: Record<string, unknown>
): Promise<void> {
  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { outboundWebhookUrl: true, outboundWebhookSecret: true },
    });
    const url = business?.outboundWebhookUrl;
    if (!url) return;
    const secret = await ensureWebhookSecret(businessId, business.outboundWebhookSecret);

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

    // Re-checked on every fire, not just when the URL was saved — a
    // hostname can be re-pointed at an internal address after the fact
    // (DNS rebinding), and this fires on every real lead event, so it's
    // the one place in this codebase that repeatedly calls a
    // tenant-supplied URL server-side. postJsonToTenantUrl validates the
    // URL and then checks the address again at connect time, never
    // follows a redirect, and times out after 8s — best-effort delivery,
    // not a guaranteed one, so there's no retry queue here. See
    // src/lib/ssrf.ts.
    await postJsonToTenantUrl(url, payload, { timeoutMs: 8000, headersFor: signedEventHeaders(secret, event) });
  } catch {
    // Swallow — see file header. The downstream tool being down or the URL
    // being stale is that business's problem to notice, not a reason to
    // fail the lead operation that triggered this.
  }
}
