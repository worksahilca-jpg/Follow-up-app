import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { appUrl } from "@/lib/stripe";

// GET /api/embed/config — the signed-in business's own embed URL, for the
// "Website widget" section in Settings to build a copy-pasteable snippet
// from. Session-gated (unlike the embed page/lead routes, which are
// public on purpose) since this is the business owner looking up their
// own id, not a website visitor.
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  return NextResponse.json({
    success: true,
    businessId: ctx.businessId,
    embedUrl: `${appUrl()}/embed/${ctx.businessId}`,
  });
}
