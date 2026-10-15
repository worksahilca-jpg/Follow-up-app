import { NextResponse } from "next/server";
import { getSessionContext, requireAdmin, type SessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { deleteLeadCascade } from "@/lib/leads-admin";
import { recordAudit } from "@/lib/audit";
import { OWNER_SAID_NOT_CUSTOMER, notCustomerCounts, recordContactVerdict, recordSenderVerdict } from "@/lib/senderVerdicts";
import { isNotCustomerReason, shouldAskAlways, type NotCustomerReason } from "@/lib/notCustomerReasons";
import { publicErrorMessage } from "@/lib/publicError";
import { moveDmLeadAside } from "@/lib/inbound/dmContactGate";
import { instagramRecipientId, isInstagramLeadId, isMessengerLeadId, messengerRecipientId } from "@/lib/instagramId";

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
//     asking the model — unless the address is shared (a website form's
//     notifier, a lead site's relay), where it would set aside every
//     future lead from that source (backlog b002). Step 2 still applies;
//     recordSenderVerdict simply keeps no rule;
//  2. each of their email threads is set aside where the owner can see it
//     (Settings → filtered emails), one tap from coming back — which also
//     keeps the sync from re-judging those threads;
//  3. the lead goes, as with delete.
//
// The body may carry the owner's answer to "Who is this?" (A-259):
// { reason: "friend" | "work" | "selling" | "spam" }. Anything else, or no
// body, is "no answer", and everything works as before.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const raw = body && typeof body === "object" ? (body as { reason?: unknown }).reason : undefined;
  const reason: NotCustomerReason | null = isNotCustomerReason(raw) ? raw : null;

  const { id } = await params;
  const lead = await prisma.lead.findFirst({
    where: { id, businessId: ctx.businessId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      stage: true,
      conversations: {
        select: {
          channel: true,
          externalId: true,
          emailProvider: true,
          messages: { orderBy: { sentAt: "desc" }, take: 1, select: { sentAt: true } },
        },
      },
      _count: { select: { deals: true, bookings: true, followUps: { where: { status: "sent" } } } },
    },
  });
  if (!lead) return NextResponse.json({ success: false, message: "Customer not found." }, { status: 404 });

  // An Instagram or Messenger customer (A-239): their whole chat moves to
  // Filtered out, where one tap brings it back. If they write again, the
  // "is this a customer?" check reads them again. Same line as below: not
  // for someone with a booking, a stage or deal, or messages elsewhere.
  const dmChannel = isInstagramLeadId(lead.phone) ? "instagram" : isMessengerLeadId(lead.phone) ? "messenger" : null;
  if (!lead.email && dmChannel && lead.phone) {
    const blockers: string[] = [];
    if (lead._count.bookings > 0) blockers.push("a booking");
    if (lead._count.deals > 0 || lead.stage !== "NEW") blockers.push("a stage or deal");
    if (lead.conversations.some((c) => c.channel !== dmChannel)) blockers.push("messages outside this chat");
    if (blockers.length > 0) {
      return NextResponse.json({ success: false, message: `${lead.name} has ${blockers.join(", ")}, which couldn't be brought back. Use Delete if you're sure.` }, { status: 409 });
    }
    try {
      const contactId = dmChannel === "instagram" ? instagramRecipientId(lead.phone) : messengerRecipientId(lead.phone);
      await moveDmLeadAside(ctx.businessId, dmChannel, contactId, lead.id, OWNER_SAID_NOT_CUSTOMER);
      // With an answer, this contact is remembered: their next message is set
      // aside instead of judged afresh (A-259). Without one, as before.
      if (reason) {
        await recordContactVerdict(ctx.businessId, lead.phone, reason).catch((err) =>
          console.error(`Could not remember a not-customer contact for business ${ctx.businessId}:`, err)
        );
      }
    } catch (err) {
      return NextResponse.json({ success: false, message: publicErrorMessage(err, "Couldn't do that. Try again.", "leads/[id]/not-customer") }, { status: 500 });
    }
    void recordAudit(ctx, "lead.not_customer", { targetType: "lead", targetId: lead.id, meta: { channel: dmChannel, reason } });
    return NextResponse.json({ success: true, ...(await askAlways(ctx, reason)) });
  }

  if (!lead.email) {
    return NextResponse.json(
      { success: false, message: "There's no email address on this customer to remember. Use Delete instead." },
      { status: 400 }
    );
  }

  // The confirm box promises the owner can bring this person back from
  // Filtered out. That's only true of email threads: a booking, a deal, a
  // stage, replies already sent and any DM conversation would be deleted
  // for good (audit 2026-09-29). So this is for someone who only ever
  // emailed and never did business here — the same line the clean-up pass
  // (POST /api/leads/cleanup) refuses to cross.
  const emailThreads = lead.conversations.filter((c) => c.channel === "email" && c.externalId);
  const kept: string[] = [];
  if (lead._count.bookings > 0) kept.push("a booking");
  if (lead._count.deals > 0 || lead.stage !== "NEW") kept.push("a stage or deal");
  if (lead._count.followUps > 0) kept.push("replies you sent");
  if (lead.conversations.some((c) => c.channel !== "email")) kept.push("messages outside email");
  if (kept.length > 0 || emailThreads.length === 0) {
    const why =
      kept.length > 0
        ? `${lead.name} has ${kept.join(", ")}, which couldn't be brought back.`
        : `There's no email from ${lead.name} to set aside, so nothing could be brought back.`;
    return NextResponse.json({ success: false, message: `${why} Use Delete if you're sure.` }, { status: 409 });
  }

  try {
    await recordSenderVerdict(ctx.businessId, lead.email, "not_customer", null, reason);
    for (const c of emailThreads) {
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
    meta: { threads: emailThreads.length, channel: "email", reason },
  });
  return NextResponse.json({ success: true, ...(await askAlways(ctx, reason)) });
}

/**
 * After the third answer of one kind (selling, spam), the screen asks once:
 * "Set these aside from now on?" (A-259, A-073). Returns that kind and how
 * many there are now, or nothing.
 * Best-effort: the owner's correction already stands, and a failed count
 * only means the question waits for the next one.
 */
async function askAlways(ctx: SessionContext, reason: NotCustomerReason | null): Promise<{ ask?: NotCustomerReason; askCount?: number }> {
  if (reason !== "selling" && reason !== "spam") return {};
  const businessId = ctx.businessId;
  try {
    // A standing rule is an account setting: only an admin is asked.
    if (!(await requireAdmin(ctx))) return {};
    const [counts, business] = await Promise.all([
      notCustomerCounts(businessId),
      prisma.business.findUnique({ where: { id: businessId }, select: { notCustomerAsked: true } }),
    ]);
    const count = counts[reason]?.count ?? 0;
    return shouldAskAlways(reason, count, business?.notCustomerAsked ?? []) ? { ask: reason, askCount: count } : {};
  } catch (err) {
    console.error(`Could not count the owner's answers for business ${businessId}:`, err);
    return {};
  }
}
