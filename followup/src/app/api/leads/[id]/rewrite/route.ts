import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { parseJsonBody } from "@/lib/validation";
import { getLeadById } from "@/lib/leads-data";
import { rewriteReply } from "@/lib/integrations/openai";
import type { LeadLanguage } from "@/lib/leadLanguage";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { requireActiveBilling, billingLockedMessage } from "@/lib/billing";

const schema = z.object({
  text: z.string().trim().min(1, "There's nothing to rewrite.").max(2000),
  style: z.enum(["shorter", "warmer", "formal", "language"]),
});

// POST /api/leads/[id]/rewrite — Shorter · Warmer · More formal · In
// their language, on the reply the owner is looking at (design brain
// A-043). Returns the new text; nothing is saved or sent. The reply still
// waits for the owner.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (await tooManyRecentActions(ctx.businessId, "leads.rewrite", { windowMinutes: 10, max: 40 })) {
    return NextResponse.json({ success: false, message: "Too many rewrites — try again in a few minutes." }, { status: 429 });
  }
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: await billingLockedMessage(ctx.businessId) }, { status: 402 });
  }
  const { id } = await params;
  const lead = await getLeadById(id);
  if (!lead) return NextResponse.json({ success: false, message: "Lead not found." }, { status: 404 });
  const parsed = await parseJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;
  try {
    const text = await rewriteReply(parsed.data.text, parsed.data.style, lead.conversation, lead.languageRead as Partial<LeadLanguage> | null);
    return NextResponse.json({ success: true, text });
  } catch {
    return NextResponse.json({ success: false, message: "Couldn't rewrite it just now. Your reply is unchanged." }, { status: 502 });
  }
}
