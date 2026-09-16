import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { requireActiveBilling, billingLockedMessage } from "@/lib/billing";
import { importGmailThread } from "@/lib/integrations/gmail";
import { importOutlookConversation } from "@/lib/integrations/outlook";
import { scoreAndDraftForLead } from "@/lib/scoring";
import { recordAudit } from "@/lib/audit";

// POST /api/integrations/gmail/filtered/[id]/restore — "this was a lead":
// the owner overrules the classifier, the thread is imported as a real
// Lead/Conversation/Message and scored like any other, and the
// FilteredEmail record goes away. Business-scoped: the row has to belong
// to the signed-in business. The URL still says "gmail" (this list
// predates Outlook and covers both mailboxes now — renaming the route
// isn't worth breaking any bookmarked/cached client for); which importer
// actually runs is decided by the row's own provider.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: await billingLockedMessage(ctx.businessId) }, { status: 402 });
  }

  const { id } = await params;
  const row = await prisma.filteredEmail.findFirst({ where: { id, businessId: ctx.businessId } });
  if (!row) return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });

  try {
    const lead =
      row.provider === "outlook"
        ? await importOutlookConversation(ctx.businessId, row.threadId)
        : await importGmailThread(ctx.businessId, row.threadId);
    if (!lead) {
      const mailbox = row.provider === "outlook" ? "Outlook" : "Gmail";
      return NextResponse.json({ success: false, message: `That email couldn't be found in ${mailbox} anymore.` });
    }

    // Record that a HUMAN decided this is a lead, on the lead itself.
    // Without this the override leaves no trace anywhere: the importer
    // tags the restored lead source "Gmail" like any other and deletes the
    // FilteredEmail row that held the verdict, so the retroactive clean-up
    // pass would put the same thread back in front of the same classifier
    // and could delete it again — reversing the owner in silence. Written
    // before the scoring below because scoring is best-effort and may
    // throw; the override must not depend on it.
    //
    // updateMany + businessId, not update by id: importGmailThread keys
    // the lead on (businessId, email) and this route is the tenant
    // boundary for it, so the write states the tenant it belongs to rather
    // than trusting an id to be in scope.
    await prisma.lead.updateMany({
      where: { id: lead.id, businessId: ctx.businessId },
      data: { classificationOverriddenAt: new Date() },
    });
    void recordAudit(ctx, "lead.classification_overridden", {
      targetType: "lead",
      targetId: lead.id,
      meta: { threadId: row.threadId, provider: row.provider, classifierReason: row.reason },
    });

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
