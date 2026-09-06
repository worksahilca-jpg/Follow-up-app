import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { importGmailThread } from "@/lib/integrations/gmail";
import { scoreAndDraftForLead } from "@/lib/scoring";

// POST /api/integrations/gmail/filtered/[id]/restore — "this was a lead":
// the owner overrules the classifier, the thread is imported as a real
// Lead/Conversation/Message and scored like any other, and the
// FilteredEmail record goes away. Business-scoped: the row has to belong
// to the signed-in business.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: BILLING_LOCKED_MESSAGE }, { status: 402 });
  }

  const { id } = await params;
  const row = await prisma.filteredEmail.findFirst({ where: { id, businessId: ctx.businessId } });
  if (!row) return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });

  try {
    const lead = await importGmailThread(ctx.businessId, row.threadId);
    if (!lead) {
      return NextResponse.json({ success: false, message: "That email couldn't be found in Gmail anymore." });
    }
    try {
      await scoreAndDraftForLead(lead.id);
    } catch (err) {
      console.error(`Failed to score restored lead ${lead.id}:`, err);
    }
    return NextResponse.json({ success: true, leadId: lead.id });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Couldn't import that email." },
      { status: 500 }
    );
  }
}
