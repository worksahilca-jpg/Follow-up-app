import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/stripe";
import { getTwilioNumberConfig, listRecentTwilioCalls, setTwilioNumberWebhooks } from "@/lib/twilio";

/**
 * GET/POST /api/twilio/number — the business's Twilio number, as Twilio
 * itself sees it. GET reports whether the number's "A call comes in" /
 * "A message comes in" webhooks actually point at this app (and the last
 * few inbound calls with any Twilio error codes); POST sets them. Uses
 * the Account SID + Auth Token already saved for outbound sending — no
 * new credential, and no trip to the Twilio Console, which hides exactly
 * these pages behind an upgrade wall on trial accounts.
 */
async function loadTwilio(businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { twilioAccountSid: true, twilioAuthToken: true, twilioPhoneNumber: true, twilioSecret: true },
  });
  if (!business?.twilioAccountSid || !business.twilioAuthToken || !business.twilioPhoneNumber) {
    return { error: "Save your Account SID, Auth Token, and Twilio number first." };
  }
  if (!business.twilioSecret) return { error: "Generate your webhook URLs first." };
  return {
    accountSid: business.twilioAccountSid,
    authToken: business.twilioAuthToken,
    phoneNumber: business.twilioPhoneNumber,
    expected: {
      voiceUrl: `${appUrl()}/api/twilio/voice/${business.twilioSecret}`,
      smsUrl: `${appUrl()}/api/twilio/sms/${business.twilioSecret}`,
    },
  };
}

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const t = await loadTwilio(ctx.businessId);
  if ("error" in t) return NextResponse.json({ success: false, message: t.error });

  try {
    const [config, calls] = await Promise.all([
      getTwilioNumberConfig(t.accountSid, t.authToken, t.phoneNumber),
      listRecentTwilioCalls(t.accountSid, t.authToken, t.phoneNumber),
    ]);
    return NextResponse.json({
      success: true,
      config,
      expected: t.expected,
      voiceMatches: !!config && config.voiceUrl === t.expected.voiceUrl,
      smsMatches: !!config && config.smsUrl === t.expected.smsUrl,
      calls,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Twilio didn't respond." },
      { status: 502 }
    );
  }
}

export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const t = await loadTwilio(ctx.businessId);
  if ("error" in t) return NextResponse.json({ success: false, message: t.error });

  try {
    const config = await getTwilioNumberConfig(t.accountSid, t.authToken, t.phoneNumber);
    if (!config) {
      return NextResponse.json({
        success: false,
        message: `${t.phoneNumber} isn't in this Twilio account — check the number and Account SID.`,
      });
    }
    await setTwilioNumberWebhooks(t.accountSid, t.authToken, config.sid, t.expected);
    const updated = await getTwilioNumberConfig(t.accountSid, t.authToken, t.phoneNumber);
    return NextResponse.json({
      success: true,
      config: updated,
      expected: t.expected,
      voiceMatches: !!updated && updated.voiceUrl === t.expected.voiceUrl,
      smsMatches: !!updated && updated.smsUrl === t.expected.smsUrl,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Twilio didn't respond." },
      { status: 502 }
    );
  }
}
