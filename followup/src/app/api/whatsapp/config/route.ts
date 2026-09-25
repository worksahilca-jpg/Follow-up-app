import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { inboundBaseUrl } from "@/lib/siteUrl";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import { WEBHOOK_VERIFY_TOKEN } from "@/lib/instagram";
import {
  lookupWhatsAppNumber,
  subscribeAppToWaba,
  unsubscribeAppFromWaba,
  whatsappSignupAvailable,
} from "@/lib/whatsappCloud";

/**
 * GET/POST/DELETE /api/whatsapp/config — this business's WhatsApp
 * connection through Meta (src/lib/whatsappCloud.ts). The one-click path
 * is /api/whatsapp/connect (Embedded Signup); this route reports state,
 * saves the post-24-hour template, takes a pasted token as the fallback,
 * and disconnects. The token itself is never echoed back.
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const b = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: {
      whatsappWabaId: true,
      whatsappPhoneNumberId: true,
      whatsappDisplayNumber: true,
      whatsappConnectMode: true,
      whatsappCloudTemplateName: true,
      whatsappCloudTemplateLanguage: true,
      whatsappCloudTemplateBody: true,
      // The earlier Twilio sender — shown as "still connected the old way"
      // so a business on it is not told WhatsApp is off.
      whatsappPhoneNumber: true,
      twilioAccountSid: true,
    },
    // Neither token is selected. src/lib/db.ts decrypts on read, so this
    // route was decrypting TWO real credentials on every Settings page
    // load to compute two booleans. Both tokens are written and cleared in
    // the same statements as the ids beside them (see POST and DELETE), so
    // the ids answer the same questions without touching a secret.
  });

  return NextResponse.json({
    success: true,
    connected: !!b?.whatsappPhoneNumberId,
    displayNumber: b?.whatsappDisplayNumber ?? null,
    connectMode: b?.whatsappConnectMode ?? null,
    wabaId: b?.whatsappWabaId ?? null,
    phoneNumberId: b?.whatsappPhoneNumberId ?? null,
    templateName: b?.whatsappCloudTemplateName ?? null,
    templateLanguage: b?.whatsappCloudTemplateLanguage ?? null,
    templateBody: b?.whatsappCloudTemplateBody ?? null,
    twilioLegacy: !!b?.whatsappPhoneNumber && !!b?.twilioAccountSid,
    signupAvailable: whatsappSignupAvailable(),
    // Public by nature (it is in every Facebook Login URL); the secret and
    // the token never leave the server.
    appId: process.env.FACEBOOK_APP_ID ?? null,
    configId: process.env.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID ?? null,
    webhookUrl: `${inboundBaseUrl()}/api/whatsapp/webhook`,
    verifyToken: WEBHOOK_VERIFY_TOKEN,
  });
}

const schema = z.object({
  // The follow-up past 24 hours — the template's name and language code
  // exactly as WhatsApp Manager shows them, and the approved wording for
  // reference. Blank clears.
  templateName: z.string().trim().max(512).optional(),
  templateLanguage: z.string().trim().max(16).optional(),
  templateBody: z.string().trim().max(2000).optional(),
  // The paste-a-token fallback: all three together, or none.
  accessToken: z.string().trim().min(1).optional(),
  phoneNumberId: z.string().trim().regex(/^\d+$/, "The phone number ID is digits only.").optional(),
  wabaId: z.string().trim().regex(/^\d+$/, "The WhatsApp Business Account ID is digits only.").optional(),
});

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });

  const parsed = await parseJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;
  const { templateName, templateLanguage, templateBody, accessToken, phoneNumberId, wabaId } = parsed.data;

  const data: Record<string, string | null> = {};
  if (templateName !== undefined) data.whatsappCloudTemplateName = templateName || null;
  if (templateLanguage !== undefined) data.whatsappCloudTemplateLanguage = templateLanguage || null;
  if (templateBody !== undefined) data.whatsappCloudTemplateBody = templateBody || null;

  if (accessToken || phoneNumberId || wabaId) {
    if (!accessToken || !phoneNumberId || !wabaId) {
      return NextResponse.json(
        { success: false, message: "To connect by hand, all three are needed: the token, the phone number ID and the WhatsApp Business Account ID." },
        { status: 400 }
      );
    }
    // Same posture as the Instagram paste path: prove the token works
    // before saving it, so a bad paste fails now and not on the first lead.
    const number = await lookupWhatsAppNumber(phoneNumberId, accessToken);
    if (!number) {
      return NextResponse.json(
        { success: false, message: "That token and phone number ID don't work together — double-check both in WhatsApp Manager." },
        { status: 400 }
      );
    }
    const sub = await subscribeAppToWaba(wabaId, accessToken);
    if (!sub.ok) {
      return NextResponse.json({ success: false, message: `Meta wouldn't let FollowUp subscribe to that account: ${sub.message}` }, { status: 400 });
    }
    data.whatsappAccessToken = accessToken;
    data.whatsappPhoneNumberId = phoneNumberId;
    data.whatsappWabaId = wabaId;
    data.whatsappDisplayNumber = number.displayNumber;
    data.whatsappConnectMode = null;
  }

  try {
    await prisma.business.update({ where: { id: ctx.businessId }, data });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json({ success: false, message: "That WhatsApp number is already connected to another FollowUp account." }, { status: 409 });
    }
    throw err;
  }
  // Recorded only once the save has held. Written before it, a refused
  // connect (the 409 above: the number is on another account) still left
  // "WhatsApp connected" in the trail (security pass 2026-09-25 F6) — the
  // same order whatsapp/connect/route.ts already uses.
  if (data.whatsappAccessToken) {
    void recordAudit(ctx, "integration.whatsapp.connect", { meta: { via: "token", phoneNumberId } });
  } else {
    void recordAudit(ctx, "integration.whatsapp.update");
  }
  return NextResponse.json({ success: true, displayNumber: data.whatsappDisplayNumber ?? undefined });
}

/** DELETE — disconnect: drops the token and the number; the Twilio fields are not touched. */
export async function DELETE() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  void recordAudit(ctx, "integration.whatsapp.disconnect");

  const b = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { whatsappWabaId: true, whatsappAccessToken: true },
  });
  // Unsubscribing is per WhatsApp Business ACCOUNT, not per number: Meta
  // stops every webhook for every number in it. An agency or franchise can
  // have two numbers in one account on two FollowUp businesses, and one of
  // them disconnecting must not silently deafen the other (security pass
  // 2026-09-25 F5). So only the last business on that account unsubscribes.
  if (b?.whatsappWabaId && b.whatsappAccessToken) {
    const sharedWith = await prisma.business.count({
      where: { id: { not: ctx.businessId }, whatsappWabaId: b.whatsappWabaId },
    });
    if (sharedWith === 0) await unsubscribeAppFromWaba(b.whatsappWabaId, b.whatsappAccessToken);
  }

  await prisma.business.update({
    where: { id: ctx.businessId },
    data: {
      whatsappWabaId: null,
      whatsappPhoneNumberId: null,
      whatsappAccessToken: null,
      whatsappDisplayNumber: null,
      whatsappConnectMode: null,
    },
  });
  return NextResponse.json({ success: true });
}
