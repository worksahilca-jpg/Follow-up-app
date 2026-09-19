import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import { exchangeWhatsAppSignupCode, lookupWhatsAppNumber, subscribeAppToWaba, whatsappSignupAvailable } from "@/lib/whatsappCloud";

/**
 * POST /api/whatsapp/connect — the second half of "Connect WhatsApp".
 *
 * Meta's Embedded Signup runs in a popup the browser opens
 * (src/components/WhatsAppConfig.tsx). When the owner finishes, the page
 * gets two things: a one-time `code` from the login callback, and the
 * `phone_number_id` + `waba_id` from a message event the popup posts.
 * The browser sends all three here. This exchanges the code for a
 * business token, subscribes FollowUp's app to the account (without
 * which Meta sends no webhooks), reads the number for display, and saves.
 *
 * `event` names which flow finished: the WhatsApp Business app onboarding
 * (Coexistence — the normal path, the number stays on the owner's phone)
 * or the plain one (a number that lives only in the API). Settings words
 * the two differently. Only the code is secret; the ids are not.
 */
const schema = z.object({
  code: z.string().trim().min(1),
  phoneNumberId: z.string().trim().regex(/^\d+$/),
  wabaId: z.string().trim().regex(/^\d+$/),
  event: z.enum(["FINISH", "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING"]).optional(),
});

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can connect WhatsApp." }, { status: 403 });
  if (!whatsappSignupAvailable()) return NextResponse.json({ success: false, message: "WhatsApp connect isn't set up yet." }, { status: 400 });

  const parsed = await parseJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;
  const { code, phoneNumberId, wabaId, event } = parsed.data;

  const exchanged = await exchangeWhatsAppSignupCode(code);
  if ("error" in exchanged) return NextResponse.json({ success: false, message: exchanged.error }, { status: 400 });

  const number = await lookupWhatsAppNumber(phoneNumberId, exchanged.accessToken);
  if (!number) {
    return NextResponse.json({ success: false, message: "Meta connected, but the number couldn't be read back — try connecting again." }, { status: 400 });
  }
  const sub = await subscribeAppToWaba(wabaId, exchanged.accessToken);
  if (!sub.ok) {
    return NextResponse.json({ success: false, message: `Meta wouldn't let FollowUp subscribe to that account: ${sub.message}` }, { status: 400 });
  }

  const connectMode = event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING" ? "coexistence" : event === "FINISH" ? "cloud" : null;
  try {
    await prisma.business.update({
      where: { id: ctx.businessId },
      data: {
        whatsappAccessToken: exchanged.accessToken,
        whatsappPhoneNumberId: phoneNumberId,
        whatsappWabaId: wabaId,
        whatsappDisplayNumber: number.displayNumber,
        whatsappConnectMode: connectMode,
      },
    });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json({ success: false, message: "That WhatsApp number is already connected to another FollowUp account." }, { status: 409 });
    }
    throw err;
  }
  void recordAudit(ctx, "integration.whatsapp.connect", { meta: { via: "embedded_signup", phoneNumberId, mode: connectMode ?? "unknown" } });

  return NextResponse.json({ success: true, displayNumber: number.displayNumber, connectMode });
}
