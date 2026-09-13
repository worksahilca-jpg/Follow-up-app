import { prisma } from "@/lib/db";
import type { A2pRegistration } from "@prisma/client";

/**
 * A2P 10DLC brand + campaign registration, built as FollowUp acting as a
 * Twilio ISV (Independent Software Vendor) — see A2pRegistration in
 * schema.prisma and research/integrations/2026-09-08-twilio-a2p-self-serve
 * -api-scoping.md, which this whole file is scoped from. Flagged there as
 * table-stakes credibility work (a customer shouldn't have to leave the app
 * to make their own texts deliver), not a moat.
 *
 * Three real, separately-vetted Twilio/TCR resources, created in order:
 *   1. Trust Hub Secondary Customer Profile — this business's identity,
 *      under FollowUp's own (ISV) Trust Hub Primary Customer Profile.
 *   2. BrandRegistration — submits that identity to The Campaign Registry.
 *   3. Usa2p (Campaign) — the actual use-case authorization, once the
 *      Brand is approved.
 *
 * FollowUp's own Primary Customer Profile has to reach Twilio-approved
 * ISV/Reseller status before step 1 can ever succeed for real — that is a
 * one-time, human/account-level approval with Twilio, not something this
 * file can do, and it hasn't happened yet. isA2pAvailable() below is the
 * one gate for that: everything else in this file is written and callable
 * today against Twilio's Test Credentials (Console → Account → API keys &
 * tokens → "Test credentials"), which mock every endpoint used here with
 * the same request/response shapes as production — so this is real,
 * exercisable code now, not a stub, and needs no changes once the real ISV
 * approval lands and TWILIO_ISV_ACCOUNT_SID/TWILIO_ISV_AUTH_TOKEN are
 * swapped from test to live values.
 */

// FollowUp's OWN Twilio account credentials — never a business's own
// Business.twilioAccountSid/twilioAuthToken (those authenticate a specific
// business's own number for sending, see src/lib/twilio.ts). These
// authenticate FollowUp as the ISV creating a Secondary Customer Profile
// on a business's behalf.
const ISV_ACCOUNT_SID = process.env.TWILIO_ISV_ACCOUNT_SID;
const ISV_AUTH_TOKEN = process.env.TWILIO_ISV_AUTH_TOKEN;

/** Whether FollowUp's ISV Twilio credentials are configured at all — see the file comment above for what still has to happen before this is true for real (non-test) credentials. */
export function isA2pAvailable(): boolean {
  return !!ISV_ACCOUNT_SID && !!ISV_AUTH_TOKEN;
}

async function twilioIsvApi(
  url: string,
  init?: { method?: "GET" | "POST"; form?: Record<string, string> }
): Promise<Record<string, unknown>> {
  if (!ISV_ACCOUNT_SID || !ISV_AUTH_TOKEN) {
    throw new Error("FollowUp's Twilio ISV account isn't configured yet (TWILIO_ISV_ACCOUNT_SID/TWILIO_ISV_AUTH_TOKEN).");
  }
  const auth = Buffer.from(`${ISV_ACCOUNT_SID}:${ISV_AUTH_TOKEN}`).toString("base64");
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      ...(init?.form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: init?.form ? new URLSearchParams(init.form).toString() : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = typeof data.message === "string" ? data.message : `Twilio API error ${res.status}`;
    throw new Error(message);
  }
  return data;
}

// Twilio's fixed "vertical" values relevant to FollowUp's actual customer
// base (contractors, agencies, small local service businesses) — the full
// Twilio enum has ~20 verticals; only the ones a FollowUp customer would
// plausibly pick are surfaced in the form (src/components/TwilioConfig.tsx),
// with REAL_ESTATE / PROFESSIONAL / HOSPITALITY / RETAIL / OTHER covering
// the researched customer shape from research/market/2026-09-07-why-followup
// -evidence-for-and-against.md.
export const TWILIO_BRAND_VERTICALS = [
  { value: "REAL_ESTATE", label: "Real estate" },
  { value: "CONSTRUCTION", label: "Construction / home services" },
  { value: "PROFESSIONAL", label: "Professional services" },
  { value: "HOSPITALITY", label: "Hospitality" },
  { value: "RETAIL", label: "Retail" },
  { value: "HEALTHCARE", label: "Healthcare" },
  { value: "NOT_FOR_PROFIT", label: "Non-profit" },
  { value: "OTHER", label: "Other" },
] as const;

export const TWILIO_BUSINESS_TYPES = [
  { value: "sole_proprietor", label: "Sole proprietor" },
  { value: "partnership", label: "Partnership" },
  { value: "llc", label: "LLC" },
  { value: "corporation", label: "Corporation" },
  { value: "non_profit", label: "Non-profit" },
] as const;

/** Fields required before a Brand + Starter Campaign can be submitted. Returns a human-readable list of what's still missing, empty when ready. */
export function missingA2pFields(reg: Partial<A2pRegistration> | null): string[] {
  const missing: string[] = [];
  const need = (v: string | null | undefined, label: string) => {
    if (!v || !v.trim()) missing.push(label);
  };
  need(reg?.legalBusinessName, "Legal business name");
  need(reg?.businessType, "Business type");
  need(reg?.businessIndustry, "Industry");
  need(reg?.addressStreet, "Business address");
  need(reg?.addressCity, "City");
  need(reg?.addressRegion, "State");
  need(reg?.addressPostalCode, "ZIP code");
  need(reg?.supportEmail, "Support email");
  need(reg?.supportPhone, "Support phone number");
  need(reg?.authorizedRepName, "Authorized representative name");
  need(reg?.authorizedRepEmail, "Authorized representative email");
  need(reg?.authorizedRepPhone, "Authorized representative phone");
  need(reg?.authorizedRepJobTitle, "Authorized representative job title");
  need(reg?.campaignDescription, "Campaign description");
  need(reg?.optInDescription, "How leads opt in to texting");
  need(reg?.sampleMessage1, "A sample message");
  // EIN is deliberately not required here: Twilio's Starter Brand tier
  // (the default — see A2pRegistration.tier) accepts a lighter identity
  // bar than Standard, and forcing an EIN on a sole proprietor who may not
  // have one would block exactly the small-business customer this tier is
  // for. Standard-tier upgrades (not yet built) would need to require it.
  return missing;
}

/** Upsert the collected business/campaign data for this business's A2P registration, without touching status/SIDs — those only change via submit/refresh below. */
export async function saveA2pRegistrationData(
  businessId: string,
  data: Partial<
    Pick<
      A2pRegistration,
      | "legalBusinessName"
      | "ein"
      | "businessType"
      | "businessIndustry"
      | "websiteUrl"
      | "addressStreet"
      | "addressCity"
      | "addressRegion"
      | "addressPostalCode"
      | "addressCountry"
      | "supportEmail"
      | "supportPhone"
      | "authorizedRepName"
      | "authorizedRepEmail"
      | "authorizedRepPhone"
      | "authorizedRepJobTitle"
      | "campaignDescription"
      | "optInDescription"
      | "sampleMessage1"
      | "sampleMessage2"
      | "monthlyVolumeEstimate"
    >
  >
): Promise<A2pRegistration> {
  return prisma.a2pRegistration.upsert({
    where: { businessId },
    create: { businessId, ...data },
    update: data,
  });
}

export async function getA2pRegistration(businessId: string): Promise<A2pRegistration | null> {
  return prisma.a2pRegistration.findUnique({ where: { businessId } });
}

/**
 * Trust Hub: create this business's Secondary Customer Profile under
 * FollowUp's own Primary Customer Profile. Idempotent per business — a
 * SID already stored is reused rather than creating a duplicate profile.
 */
async function ensureCustomerProfile(reg: A2pRegistration): Promise<{ sid: string; status: string }> {
  if (reg.customerProfileSid) {
    const existing = await twilioIsvApi(`https://trusthub.twilio.com/v1/CustomerProfiles/${reg.customerProfileSid}`);
    return { sid: reg.customerProfileSid, status: String(existing.status ?? reg.customerProfileStatus ?? "draft") };
  }
  const created = await twilioIsvApi("https://trusthub.twilio.com/v1/CustomerProfiles", {
    method: "POST",
    form: {
      FriendlyName: `${reg.legalBusinessName ?? "FollowUp customer"} — A2P Secondary Profile`,
      Email: reg.supportEmail ?? "",
      // Twilio's Secondary Customer Profile policy SID is a fixed value
      // shown in the Twilio Console under Trust Hub → Policies (it's the
      // same across ISV accounts, but this file doesn't hardcode a guessed
      // value — WebFetch was blocked for the research this was scoped
      // from, so it's confirmed from the Console at deploy time instead of
      // guessed here). Required before this call can succeed for real.
      PolicySid: process.env.TWILIO_A2P_SECONDARY_PROFILE_POLICY_SID ?? "",
    },
  });
  return { sid: String(created.sid), status: String(created.status ?? "draft") };
}

/**
 * Trust Hub: attaches the business-information and authorized-representative
 * End User objects, plus the business address, to the Customer Profile, then
 * triggers Twilio's evaluation and submits it for review. Best-effort and
 * resumable: each sub-step is independent, and a failure here leaves
 * customerProfileSid already saved so a retry doesn't start over from a new
 * profile. Twilio's own error message on a rejected field name/shape
 * surfaces as-is to the caller — the honest failure mode given this exact
 * End User `Attributes` schema hasn't been exercised against a live Twilio
 * account here yet (see the file header).
 */
async function attachAndSubmitCustomerProfile(customerProfileSid: string, reg: A2pRegistration): Promise<void> {
  const businessInfo = await twilioIsvApi("https://trusthub.twilio.com/v1/EndUsers", {
    method: "POST",
    form: {
      FriendlyName: `${reg.legalBusinessName ?? ""} — business information`,
      Type: "customer_profile_business_information",
      Attributes: JSON.stringify({
        business_name: reg.legalBusinessName ?? "",
        business_identity: "direct_customer",
        business_type: reg.businessType ?? "",
        business_registration_identifier: reg.ein ? "EIN" : "",
        business_registration_number: reg.ein ?? "",
        business_industry: reg.businessIndustry ?? "",
        website_url: reg.websiteUrl ?? "",
      }),
    },
  });

  const authorizedRep = await twilioIsvApi("https://trusthub.twilio.com/v1/EndUsers", {
    method: "POST",
    form: {
      FriendlyName: `${reg.authorizedRepName ?? ""} — authorized representative`,
      Type: "authorized_representative_1",
      Attributes: JSON.stringify({
        job_position: reg.authorizedRepJobTitle ?? "",
        first_name: (reg.authorizedRepName ?? "").split(" ")[0] ?? "",
        last_name: (reg.authorizedRepName ?? "").split(" ").slice(1).join(" ") || (reg.authorizedRepName ?? ""),
        email: reg.authorizedRepEmail ?? "",
        phone_number: reg.authorizedRepPhone ?? "",
      }),
    },
  });

  const address = await twilioIsvApi(`https://api.twilio.com/2010-04-01/Accounts/${ISV_ACCOUNT_SID}/Addresses.json`, {
    method: "POST",
    form: {
      CustomerName: reg.legalBusinessName ?? "",
      Street: reg.addressStreet ?? "",
      City: reg.addressCity ?? "",
      Region: reg.addressRegion ?? "",
      PostalCode: reg.addressPostalCode ?? "",
      IsoCountry: reg.addressCountry ?? "US",
    },
  });

  for (const objectSid of [String(businessInfo.sid), String(authorizedRep.sid), String(address.sid)]) {
    await twilioIsvApi(`https://trusthub.twilio.com/v1/CustomerProfiles/${customerProfileSid}/CustomerProfilesEntityAssignments`, {
      method: "POST",
      form: { ObjectSid: objectSid },
    });
  }

  await twilioIsvApi(`https://trusthub.twilio.com/v1/CustomerProfiles/${customerProfileSid}/Evaluations`, { method: "POST" });
  await twilioIsvApi(`https://trusthub.twilio.com/v1/CustomerProfiles/${customerProfileSid}`, {
    method: "POST",
    form: { Status: "pending-review" },
  });
}

/** Messaging API: create the BrandRegistration tied to the (submitted) Customer Profile. */
async function createBrandRegistration(customerProfileSid: string, tier: string): Promise<{ sid: string; status: string }> {
  const created = await twilioIsvApi("https://messaging.twilio.com/v1/a2p/BrandRegistrations", {
    method: "POST",
    form: {
      CustomerProfileBundleSid: customerProfileSid,
      A2PProfileBundleSid: customerProfileSid,
      // Starter Brand: Twilio covers the Brand + Campaign fee at this tier
      // (research doc §"Starter Brand API") — a business only ever pays for
      // this itself once it's moved to "standard".
      SkipAutomaticSecVet: tier === "starter" ? "true" : "false",
    },
  });
  return { sid: String(created.sid), status: String(created.status ?? "PENDING") };
}

async function getBrandStatus(brandSid: string): Promise<{ status: string; failureReason: string | null }> {
  const data = await twilioIsvApi(`https://messaging.twilio.com/v1/a2p/BrandRegistrations/${brandSid}`);
  const failureReasons = data.failure_reason;
  return {
    status: String(data.status ?? "PENDING"),
    failureReason: typeof failureReasons === "string" && failureReasons ? failureReasons : null,
  };
}

/** Messaging API: create a dedicated Messaging Service for this business's Campaign (Usa2p is scoped under one), then the Campaign itself. Only called once the Brand is APPROVED. */
async function createCampaign(reg: A2pRegistration): Promise<{ messagingServiceSid: string; sid: string; status: string }> {
  let messagingServiceSid = reg.messagingServiceSid;
  if (!messagingServiceSid) {
    const service = await twilioIsvApi("https://messaging.twilio.com/v1/Services", {
      method: "POST",
      form: { FriendlyName: `${reg.legalBusinessName ?? reg.businessId} — A2P Campaign` },
    });
    messagingServiceSid = String(service.sid);
  }

  const created = await twilioIsvApi(`https://messaging.twilio.com/v1/Services/${messagingServiceSid}/Compliance/Usa2p`, {
    method: "POST",
    form: {
      BrandRegistrationSid: reg.brandSid ?? "",
      Description: reg.campaignDescription ?? "",
      MessageFlow: reg.optInDescription ?? "",
      UsAppToPersonUsecase: reg.useCase ?? "STARTER",
      HasEmbeddedLinks: "false",
      HasEmbeddedPhone: "false",
      SampleOne: reg.sampleMessage1 ?? "",
      ...(reg.sampleMessage2 ? { SampleTwo: reg.sampleMessage2 } : {}),
    },
  });
  return { messagingServiceSid, sid: String(created.sid), status: String(created.campaignStatus ?? created.status ?? "PENDING") };
}

async function getCampaignStatus(messagingServiceSid: string, campaignSid: string): Promise<{ status: string; failureReason: string | null }> {
  const data = await twilioIsvApi(`https://messaging.twilio.com/v1/Services/${messagingServiceSid}/Compliance/Usa2p/${campaignSid}`);
  const reason = data.failure_reason;
  return {
    status: String(data.campaignStatus ?? data.status ?? "PENDING"),
    failureReason: typeof reason === "string" && reason ? reason : null,
  };
}

/** Twilio's own per-stage status strings -> the coarse rollup this app reads everywhere else. */
function rollupStatus(customerProfileStatus: string | null, brandStatus: string | null, campaignStatus: string | null): "not_started" | "pending" | "approved" | "rejected" {
  if (customerProfileStatus === "twilio-rejected" || brandStatus === "FAILED" || campaignStatus === "FAILED") return "rejected";
  if (campaignStatus === "APPROVED" || campaignStatus === "VERIFIED") return "approved";
  if (customerProfileStatus) return "pending";
  return "not_started";
}

/**
 * Kicks off registration: Customer Profile -> attach + submit -> Brand.
 * Campaign is deliberately NOT created here — it only makes sense once the
 * Brand is actually APPROVED (Twilio itself will reject a Campaign against
 * a pending Brand), so refreshA2pStatus() below creates it lazily the first
 * time it observes an approved Brand. Returns the updated row either way;
 * throws only if isA2pAvailable() is false (caller's job to check first and
 * give a clear "not available yet" response instead of calling this at
 * all).
 */
export async function submitA2pRegistration(businessId: string): Promise<A2pRegistration> {
  if (!isA2pAvailable()) {
    throw new Error(
      "A2P registration isn't available yet — FollowUp's own Twilio ISV approval is still pending. This unlocks automatically once that lands; no need to retry manually."
    );
  }
  const reg = await prisma.a2pRegistration.findUnique({ where: { businessId } });
  if (!reg) throw new Error("Save the business details first.");
  const missing = missingA2pFields(reg);
  if (missing.length > 0) throw new Error(`Still missing: ${missing.join(", ")}.`);

  try {
    const profile = await ensureCustomerProfile(reg);
    if (!reg.customerProfileSid) {
      await attachAndSubmitCustomerProfile(profile.sid, reg);
    }

    let brandSid = reg.brandSid;
    let brandStatus = reg.brandStatus;
    if (!brandSid) {
      const brand = await createBrandRegistration(profile.sid, reg.tier);
      brandSid = brand.sid;
      brandStatus = brand.status;
    }

    return prisma.a2pRegistration.update({
      where: { businessId },
      data: {
        customerProfileSid: profile.sid,
        customerProfileStatus: "pending-review",
        brandSid,
        brandStatus,
        status: rollupStatus("pending-review", brandStatus, reg.campaignStatus),
        submittedAt: new Date(),
        rejectionReason: null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Twilio rejected the submission.";
    await prisma.a2pRegistration.update({ where: { businessId }, data: { rejectionReason: message } });
    throw new Error(message);
  }
}

/**
 * Polls Twilio for this business's current Brand/Campaign status and
 * updates the stored rollup. Creates the Campaign the first time it sees
 * an APPROVED Brand with no Campaign yet. Safe to call repeatedly (e.g. a
 * cron tick, or a user clicking "Refresh" in Settings) — a business with
 * no customerProfileSid yet (never submitted) is a no-op.
 */
export async function refreshA2pStatus(businessId: string): Promise<A2pRegistration | null> {
  if (!isA2pAvailable()) return prisma.a2pRegistration.findUnique({ where: { businessId } });
  const reg = await prisma.a2pRegistration.findUnique({ where: { businessId } });
  if (!reg?.customerProfileSid || !reg.brandSid) return reg;

  const brand = await getBrandStatus(reg.brandSid);
  let campaignSid = reg.campaignSid;
  let campaignStatus = reg.campaignStatus;
  let messagingServiceSid = reg.messagingServiceSid;
  let rejectionReason = brand.failureReason;

  if (brand.status === "APPROVED" && !campaignSid) {
    try {
      const campaign = await createCampaign(reg);
      messagingServiceSid = campaign.messagingServiceSid;
      campaignSid = campaign.sid;
      campaignStatus = campaign.status;
    } catch (err) {
      rejectionReason = err instanceof Error ? err.message : "Campaign submission failed.";
    }
  } else if (campaignSid && messagingServiceSid) {
    const campaign = await getCampaignStatus(messagingServiceSid, campaignSid);
    campaignStatus = campaign.status;
    rejectionReason = rejectionReason ?? campaign.failureReason;
  }

  const status = rollupStatus(reg.customerProfileStatus, brand.status, campaignStatus);
  return prisma.a2pRegistration.update({
    where: { businessId },
    data: {
      brandStatus: brand.status,
      messagingServiceSid,
      campaignSid,
      campaignStatus,
      status,
      rejectionReason: status === "rejected" ? rejectionReason : null,
      approvedAt: status === "approved" ? new Date() : reg.approvedAt,
    },
  });
}
