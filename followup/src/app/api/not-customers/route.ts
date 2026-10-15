import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { parseJsonBody } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";
import { forgetReason, notCustomerCounts } from "@/lib/senderVerdicts";
import { NOT_CUSTOMER_REASONS, SET_ASIDE_KINDS, cleanKinds } from "@/lib/notCustomerReasons";

/**
 * What FollowUp learned from "Not a customer" (A-259): Settings › Your
 * business › Who isn't a customer, and the answer to "Set these aside from
 * now on?". GET is for anyone on the account; changing it is an admin's,
 * like every other account setting.
 */

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  const [counts, business] = await Promise.all([
    notCustomerCounts(ctx.businessId),
    prisma.business.findUnique({ where: { id: ctx.businessId }, select: { notCustomerAlways: true } }),
  ]);
  const always = cleanKinds(business?.notCustomerAlways);
  const rows = NOT_CUSTOMER_REASONS.flatMap((reason) => {
    const c = counts[reason];
    const isAlways = (always as string[]).includes(reason);
    if (!c && !isAlways) return [];
    return [{ reason, count: c?.count ?? 0, latest: c?.latest.toISOString() ?? null, always: isAlways }];
  });
  return NextResponse.json({ success: true, rows, isAdmin: await requireAdmin(ctx) });
}

const answerSchema = z.object({ kind: z.enum(SET_ASIDE_KINDS), always: z.boolean() });

/** The answer to "Set these aside from now on?": asked once per kind, whichever way it goes. */
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can change this." }, { status: 403 });
  const parsed = await parseJsonBody(request, answerSchema);
  if (!parsed.ok) return parsed.response;
  const { kind, always } = parsed.data;

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { notCustomerAlways: true, notCustomerAsked: true },
  });
  const asked = new Set([...cleanKinds(business?.notCustomerAsked), kind]);
  const rules = new Set(cleanKinds(business?.notCustomerAlways));
  if (always) rules.add(kind);
  await prisma.business.update({
    where: { id: ctx.businessId },
    data: { notCustomerAsked: [...asked], notCustomerAlways: [...rules] },
  });
  void recordAudit(ctx, "not_customer.rule", { meta: { kind, always } });
  return NextResponse.json({ success: true });
}

const undoSchema = z.object({ reason: z.enum(NOT_CUSTOMER_REASONS) });

/**
 * "Undo" on one row: FollowUp forgets everyone the owner gave that answer
 * for, and drops the standing rule if there was one. Their set-aside chats
 * and emails stay in Filtered out; the next message from them is judged
 * again, as before the owner said anything.
 */
export async function DELETE(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can change this." }, { status: 403 });
  const parsed = await parseJsonBody(request, undoSchema);
  if (!parsed.ok) return parsed.response;
  const { reason } = parsed.data;

  const forgotten = await forgetReason(ctx.businessId, reason);
  const business = await prisma.business.findUnique({ where: { id: ctx.businessId }, select: { notCustomerAlways: true } });
  const rules = cleanKinds(business?.notCustomerAlways).filter((k) => k !== reason);
  await prisma.business.update({ where: { id: ctx.businessId }, data: { notCustomerAlways: rules } });
  void recordAudit(ctx, "not_customer.undo", { meta: { reason, forgotten } });
  return NextResponse.json({ success: true });
}
