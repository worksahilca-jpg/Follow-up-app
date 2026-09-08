import { NextRequest, NextResponse } from "next/server";
import { syncCrmForAllBusinesses } from "@/lib/crmSync";

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const result = await syncCrmForAllBusinesses();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "CRM sync run failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
