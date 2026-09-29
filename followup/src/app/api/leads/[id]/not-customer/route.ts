import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { deleteLeadCascade } from "@/lib/leads-admin";
import { recordAudit } from "@/lib/audit";
import { OWNER_SAID_NOT_CUSTOMER, recordSenderVerdict } from "@/lib/senderVerdicts";
import { publicErrorMessage } from "@/lib/publicError";

// POST /api/leads/[id]/not-customer — "Not a customer": the owner's
// correction in the other direction from "this was a customer"
// (src/app/api/integrations/gmail/filtered/[id]/restore).
//
// A plain delete was not enough. The thread stayed in the mailbox with no
// record that anyone had judged it, so the next daily deep sync put it in
// front of the classifier again and could bring the same person back — and
// the next email from them was judged from scratch too. Now:
//  1. the sender is remembered as not a customer, for this business only
//     (src/lib/senderVerdicts.ts), so their new mail is set aside without
//     asking the model;
//  2. each of their email threads is set aside where the owner can see it
//     (Settings → filtered emails), one tap from coming back — which also
//     keeps the sync from re-judging those threads;
//  3. the lead goes, as with delete.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const lead = await prisma.lead.findFirst({
    where: { id, businessId: ctx.businessId },
    select: {
      id: true,
      name: true,
      email: true,
      conversations: {
        where: { channel: "email", externalId: { not: null } },
        select: { externalId: true, emailProvider: true, messages: { orderBy: { sentAt: "desc" }, take: 1, select: { sentAt: true } } },
      },
    },
  });
  if (!lead) return NextResponse.json({ success: false, message: "Customer not found." }, { status: 404 });
  if (!lead.email) {
    return NextResponse.json(
      { success: false, message: "There's no email address on this customer to remember. Use Delete instead." },
      { status: 400 }
    );
  }

  try {
    await recordSenderVerdict(ctx.businessId, lead.email, "not_customer", null);
    for (const c of lead.conversations) {
      const threadId = c.externalId!;
      const lastMessageAt = c.messages[0]?.sentAt ?? new Date();
      await prisma.filteredEmail.upsert({
        where: { businessId_threadId: { businessId: ctx.businessId, threadId } },
        update: { reason: OWNER_SAID_NOT_CUSTOMER, lastMessageAt },
        create: {
          businessId: ctx.businessId,
          threadId,
          provider: c.emailProvider === "outlook" ? "outlook" : "gmail",
          senderName: lead.name,
          senderEmail: lead.email,
          subject: null,
          reason: OWNER_SAID_NOT_CUSTOMER,
          lastMessageAt,
        },
      });
    }
    await deleteLeadCascade(lead.id, ctx.businessId);
  } catch (err) {
    return NextResponse.json(
      { success: false, message: publicErrorMessage(err, "Couldn't do that. Try again.", "leads/[id]/not-customer") },
      { status: 500 }
    );
  }

  void recordAudit(ctx, "lead.not_customer", {
    targetType: "lead",
    targetId: lead.id,
    meta: { threads: lead.conversations.length },
  });
  return NextResponse.json({ success: true });
}
