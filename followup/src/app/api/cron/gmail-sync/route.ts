import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cronAuth";
import { syncGmailForAllBusinesses } from "@/lib/gmailSync";
import { encryptPlaintextSecrets } from "@/lib/secretsSweep";

// Every business with a connected Gmail, each pulling only what's new since
// its last tick — small per business, but the count of businesses is the
// real variable. Needs a Vercel plan that honors maxDuration above the
// Hobby tier's cap; past a few hundred tenants this becomes a fan-out.
export const maxDuration = 300;

// GET /api/cron/gmail-sync — invoked every few minutes by Vercel Cron (see
// vercel.json). Until this existed, a new email only became a lead when
// the owner pressed "Sync now" in Settings — which is the exact opposite of
// "no lead goes cold": the lead was cold from the moment it arrived. Same
// CRON_SECRET protection as /api/cron/automation.
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request, "gmail-sync");
  if (unauthorized) return unauthorized;

  try {
    // Piggybacks on this tick: re-saves any credentials still stored in
    // plaintext so they get encrypted (no-op once done; see secretsSweep.ts).
    const encrypted = await encryptPlaintextSecrets().catch((err) => {
      console.error("Credential encryption sweep failed:", err);
      return { integrations: 0, businesses: 0 };
    });
    const result = await syncGmailForAllBusinesses();
    return NextResponse.json({ success: true, ...result, encrypted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gmail sync run failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
