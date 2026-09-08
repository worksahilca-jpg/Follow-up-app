import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cronAuth";
import { syncCrmForAllBusinesses } from "@/lib/crmSync";

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request, "crm-sync");
  if (unauthorized) return unauthorized;
  try {
    const result = await syncCrmForAllBusinesses();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "CRM sync run failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
