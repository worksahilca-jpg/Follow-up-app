import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import { getGmailStatus } from "@/lib/integrations/gmail";
import { getPastRepliesState, setPastRepliesAllowed } from "@/lib/pastReplies";

/**
 * GET/POST /api/business/past-replies — the "Write like me" switch
 * (src/lib/pastReplies.ts). GET is the card's state: on or off, how far
 * the reading got, and whether Gmail is connected at all. POST turns it
 * on (reading starts on the next cron tick) or off (every kept reply is
 * deleted at once). Admin-only and audited, like the other account-wide
 * consent switch next to it (/api/business/privacy).
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  const [state, gmail] = await Promise.all([getPastRepliesState(ctx.businessId), getGmailStatus(ctx.businessId)]);
  return NextResponse.json({ success: true, ...state, gmailConnected: gmail.connected });
}

const schema = z.object({ on: z.boolean() });

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can change this." }, { status: 403 });

  const parsed = await parseJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;

  if (parsed.data.on && !(await getGmailStatus(ctx.businessId)).connected) {
    return NextResponse.json({ success: false, message: "Connect Gmail first." }, { status: 409 });
  }

  await setPastRepliesAllowed(ctx.businessId, parsed.data.on);
  void recordAudit(ctx, parsed.data.on ? "business.past_replies.on" : "business.past_replies.off");
  return NextResponse.json({ success: true, ...(await getPastRepliesState(ctx.businessId)) });
}
