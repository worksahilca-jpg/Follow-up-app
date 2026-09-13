import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import { getA2pRegistration, isA2pAvailable, missingA2pFields, saveA2pRegistrationData } from "@/lib/integrations/twilioA2p";

const a2pDataSchema = z.object({
  legalBusinessName: z.string().trim().max(200).optional(),
  ein: z.string().trim().max(20).optional(),
  businessType: z.string().trim().max(40).optional(),
  businessIndustry: z.string().trim().max(40).optional(),
  websiteUrl: z.string().trim().max(300).optional(),
  addressStreet: z.string().trim().max(200).optional(),
  addressCity: z.string().trim().max(100).optional(),
  addressRegion: z.string().trim().max(100).optional(),
  addressPostalCode: z.string().trim().max(20).optional(),
  addressCountry: z.string().trim().max(2).optional(),
  supportEmail: z.string().trim().max(200).optional(),
  supportPhone: z.string().trim().max(30).optional(),
  authorizedRepName: z.string().trim().max(200).optional(),
  authorizedRepEmail: z.string().trim().max(200).optional(),
  authorizedRepPhone: z.string().trim().max(30).optional(),
  authorizedRepJobTitle: z.string().trim().max(100).optional(),
  campaignDescription: z.string().trim().max(4096).optional(),
  optInDescription: z.string().trim().max(2000).optional(),
  sampleMessage1: z.string().trim().max(500).optional(),
  sampleMessage2: z.string().trim().max(500).optional(),
  monthlyVolumeEstimate: z.number().int().min(0).max(1_000_000).optional(),
});

/**
 * GET/POST /api/twilio/a2p — the per-business A2P 10DLC (SMS carrier
 * compliance) registration: the business/campaign data collected for
 * Twilio's Brand + Campaign submission, and the current status. Submitting
 * to Twilio itself is a separate action — see /api/twilio/a2p/submit — so
 * a business can save partial progress here without triggering a real
 * Twilio call every keystroke.
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const reg = await getA2pRegistration(ctx.businessId);
  return NextResponse.json({
    success: true,
    available: isA2pAvailable(),
    registration: reg
      ? {
          status: reg.status,
          tier: reg.tier,
          brandStatus: reg.brandStatus,
          campaignStatus: reg.campaignStatus,
          rejectionReason: reg.rejectionReason,
          submittedAt: reg.submittedAt,
          approvedAt: reg.approvedAt,
          legalBusinessName: reg.legalBusinessName,
          businessType: reg.businessType,
          businessIndustry: reg.businessIndustry,
          websiteUrl: reg.websiteUrl,
          addressStreet: reg.addressStreet,
          addressCity: reg.addressCity,
          addressRegion: reg.addressRegion,
          addressPostalCode: reg.addressPostalCode,
          addressCountry: reg.addressCountry,
          supportEmail: reg.supportEmail,
          supportPhone: reg.supportPhone,
          authorizedRepName: reg.authorizedRepName,
          authorizedRepEmail: reg.authorizedRepEmail,
          authorizedRepPhone: reg.authorizedRepPhone,
          authorizedRepJobTitle: reg.authorizedRepJobTitle,
          campaignDescription: reg.campaignDescription,
          optInDescription: reg.optInDescription,
          sampleMessage1: reg.sampleMessage1,
          sampleMessage2: reg.sampleMessage2,
          monthlyVolumeEstimate: reg.monthlyVolumeEstimate,
          // EIN is write-only, same treatment as Twilio's own Auth Token
          // (src/app/api/twilio/config/route.ts) — never echoed back once saved.
          hasEin: !!reg.ein,
          missingFields: missingA2pFields(reg),
        }
      : { status: "not_started", tier: "starter", missingFields: missingA2pFields(null) },
  });
}

/** POST — save/update the collected business + campaign data. Doesn't touch Twilio; see /api/twilio/a2p/submit for that. */
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });

  const parsed = await parseJsonBody(request, a2pDataSchema);
  if (!parsed.ok) return parsed.response;

  void recordAudit(ctx, "integration.twilio_a2p.save_data");
  const reg = await saveA2pRegistrationData(ctx.businessId, parsed.data);
  return NextResponse.json({ success: true, status: reg.status, missingFields: missingA2pFields(reg) });
}
