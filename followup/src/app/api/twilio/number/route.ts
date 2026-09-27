import { NextResponse } from "next/server";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { inboundBaseUrl } from "@/lib/siteUrl";
import { getTwilioNumberConfig, listRecentTwilioCalls, setTwilioNumberWebhooks } from "@/lib/twilio";
import { publicErrorMessage } from "@/lib/publicError";

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
      voiceUrl: `${inboundBaseUrl()}/api/twilio/voice/${business.twilioSecret}`,
      smsUrl: `${inboundBaseUrl()}/api/twilio/sms/${business.twilioSecret}`,
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
      { success: false, message: publicErrorMessage(err, "Twilio didn't respond.", "twilio/number") },
      { status: 502 }
    );
  }
}

export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  // Admin-only, for consistency with every other Twilio setting — this
  // rewrites the number's webhook config in the business's own Twilio
  // account using their stored credentials. It only ever writes FollowUp's
  // own expected URLs, so there's no exfiltration path here the way there
  // was on the outbound webhook; it's gated because a third-party account
  // mutation isn't a SALES teammate's call. Same 2026-09-15 bug-hunt pass.
  if (!(await requireAdmin(ctx)))
    return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });

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
      { success: false, message: publicErrorMessage(err, "Twilio didn't respond.", "twilio/number") },
      { status: 502 }
    );
  }
}
