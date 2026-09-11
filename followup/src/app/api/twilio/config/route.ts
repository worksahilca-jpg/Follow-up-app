import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/stripe";
import { requireAdmin } from "@/lib/session";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";

const twilioConfigSchema = z.object({
  authToken: z.string().trim().optional(),
  accountSid: z.string().trim().optional(),
  phoneNumber: z.string().trim().optional(),
  whatsappPhoneNumber: z.string().trim().optional(),
  whatsappTemplateSid: z.string().trim().optional(),
  whatsappTemplateBody: z.string().trim().optional(),
  voiceAgentEnabled: z.boolean().optional(),
});

/**
 * GET/POST /api/twilio/config — this business's Twilio setup: the three
 * webhook URLs to paste into the Twilio Console, whether an Auth Token is
 * saved (never the token's value itself — see below), and the Account SID
 * + phone numbers needed for OUTBOUND sending (src/lib/twilio.ts sendSms/
 * sendWhatsApp). SID and phone numbers aren't secret the way the Auth
 * Token is (Twilio shows all of them openly in the Console), so GET
 * echoes them back.
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: {
      twilioSecret: true,
      twilioAuthToken: true,
      twilioAccountSid: true,
      twilioPhoneNumber: true,
      whatsappPhoneNumber: true,
      whatsappTemplateSid: true,
      whatsappTemplateBody: true,
      voiceAgentEnabled: true,
    },
  });

  const secret = business?.twilioSecret ?? null;
  return NextResponse.json({
    success: true,
    smsUrl: secret ? `${appUrl()}/api/twilio/sms/${secret}` : null,
    voiceUrl: secret ? `${appUrl()}/api/twilio/voice/${secret}` : null,
    whatsappUrl: secret ? `${appUrl()}/api/twilio/whatsapp/${secret}` : null,
    hasAuthToken: !!business?.twilioAuthToken,
    accountSid: business?.twilioAccountSid ?? null,
    phoneNumber: business?.twilioPhoneNumber ?? null,
    whatsappPhoneNumber: business?.whatsappPhoneNumber ?? null,
    whatsappTemplateSid: business?.whatsappTemplateSid ?? null,
    whatsappTemplateBody: business?.whatsappTemplateBody ?? null,
    voiceAgentEnabled: business?.voiceAgentEnabled ?? false,
  });
}

/**
 * POST { authToken?, accountSid?, phoneNumber?, whatsappPhoneNumber?,
 * voiceAgentEnabled? } — generates twilioSecret if it doesn't exist yet
 * (idempotent: calling this again without changing anything keeps the
 * same URLs, unlike the other webhook config routes, since regenerating
 * would silently break a live phone number's console config), and
 * saves/updates whichever fields are passed. authToken is write-only —
 * GET never echoes it back, same treatment as a password, since it's what
 * actually authenticates inbound requests as really being from Twilio.
 * voiceAgentEnabled is a plain boolean toggle, not tied to any secret —
 * see Business.voiceAgentEnabled in schema.prisma for why it defaults off.
 */
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  void recordAudit(ctx, "integration.twilio.update");

  const parsed = await parseJsonBody(request, twilioConfigSchema);
  if (!parsed.ok) return parsed.response;
  const {
    authToken,
    accountSid,
    phoneNumber,
    whatsappPhoneNumber,
    whatsappTemplateSid,
    whatsappTemplateBody,
    voiceAgentEnabled,
  } = parsed.data;

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { twilioSecret: true, voiceAddonEnabled: true },
  });

  // Voice is Plus/Pro-eligible, but only once the business is actually
  // paying for the Voice add-on (research/market/2026-09-11-tier-pricing-
  // recommendation.md §4) — voiceAgentEnabled is the feature toggle,
  // voiceAddonEnabled is the billing fact (synced from Stripe by the
  // webhook), and turning the feature on without the add-on would mean
  // FollowUp eats the per-minute OpenAI Realtime cost with nothing billed
  // for it.
  if (voiceAgentEnabled === true && !business?.voiceAddonEnabled) {
    return NextResponse.json(
      { success: false, message: "Add the Voice add-on in Settings → Billing before turning this on." },
      { status: 400 }
    );
  }

  const secret = business?.twilioSecret ?? randomBytes(24).toString("base64url");
  await prisma.business.update({
    where: { id: ctx.businessId },
    data: {
      twilioSecret: secret,
      ...(authToken !== undefined ? { twilioAuthToken: authToken || null } : {}),
      ...(accountSid !== undefined ? { twilioAccountSid: accountSid || null } : {}),
      ...(phoneNumber !== undefined ? { twilioPhoneNumber: phoneNumber || null } : {}),
      ...(whatsappPhoneNumber !== undefined ? { whatsappPhoneNumber: whatsappPhoneNumber || null } : {}),
      ...(whatsappTemplateSid !== undefined ? { whatsappTemplateSid: whatsappTemplateSid || null } : {}),
      ...(whatsappTemplateBody !== undefined ? { whatsappTemplateBody: whatsappTemplateBody || null } : {}),
      ...(voiceAgentEnabled !== undefined ? { voiceAgentEnabled } : {}),
    },
  });

  return NextResponse.json({
    success: true,
    smsUrl: `${appUrl()}/api/twilio/sms/${secret}`,
    voiceUrl: `${appUrl()}/api/twilio/voice/${secret}`,
    whatsappUrl: `${appUrl()}/api/twilio/whatsapp/${secret}`,
  });
}

/** DELETE — disconnect: clears the full Twilio config, so it stops working until reconnected. */
export async function DELETE() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  void recordAudit(ctx, "integration.twilio.disconnect");

  await prisma.business.update({
    where: { id: ctx.businessId },
    data: {
      twilioSecret: null,
      twilioAuthToken: null,
      twilioAccountSid: null,
      twilioPhoneNumber: null,
      whatsappPhoneNumber: null,
      whatsappTemplateSid: null,
      whatsappTemplateBody: null,
    },
  });
  return NextResponse.json({ success: true });
}
