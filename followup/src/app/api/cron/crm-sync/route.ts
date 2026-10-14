import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cronAuth";
import { reportCronFailure } from "@/lib/monitoring";
import { syncCrmForAllBusinesses } from "@/lib/crmSync";
import { pruneCrmWrites, retryCrmWrites } from "@/lib/crm/writes";

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request, "crm-sync");
  if (unauthorized) return unauthorized;
  try {
    const result = await syncCrmForAllBusinesses();
    // Writes the CRM didn't take (src/lib/crm/writes.ts, A-252). Its own try, so a failure here never hides the sync's result.
    const writes = await retryCrmWrites().catch((err) => {
      reportCronFailure("crm-sync", err, "retrying CRM writes");
      return null;
    });
    await pruneCrmWrites().catch((err) => reportCronFailure("crm-sync", err, "pruning CRM writes"));
    return NextResponse.json({ success: true, ...result, writes });
  } catch (err) {
    reportCronFailure("crm-sync", err);
    const message = err instanceof Error ? err.message : "CRM sync run failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
