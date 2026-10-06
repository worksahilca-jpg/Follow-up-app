import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { factInputSchema, labelKey, MAX_FACTS } from "@/lib/factLines";

/**
 * GET/POST /api/business/facts — "What FollowUp knows" in Settings → Your
 * business (A-096, src/lib/businessFacts.ts). Everyone on the team can read
 * the list; only an admin adds to it, because a fact goes into replies sent
 * in the business's name. Audited without the words themselves.
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  const facts = await prisma.businessFact.findMany({
    where: { businessId: ctx.businessId },
    orderBy: { createdAt: "asc" },
    select: { id: true, label: true, value: true, source: true, sourceLeadId: true, updatedAt: true },
  });
  // "Learned from your reply to Ivy": names looked up inside this business only.
  const leadIds = [...new Set(facts.map((f) => f.sourceLeadId).filter((id): id is string => !!id))];
  const leads = leadIds.length
    ? await prisma.lead.findMany({ where: { id: { in: leadIds }, businessId: ctx.businessId }, select: { id: true, name: true } })
    : [];
  const names = new Map(leads.map((l) => [l.id, l.name]));
  return NextResponse.json({
    success: true,
    isAdmin: await requireAdmin(ctx),
    facts: facts.map(({ sourceLeadId, ...f }) => ({ ...f, learnedFrom: sourceLeadId ? names.get(sourceLeadId) ?? null : null })),
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can change this." }, { status: 403 });
  if (await tooManyRecentActions(ctx.businessId, "business.facts", { windowMinutes: 60, max: 120 })) {
    return NextResponse.json({ success: false, message: "Too many changes. Wait a few minutes and try again." }, { status: 429 });
  }
  const parsed = await parseJsonBody(request, factInputSchema);
  if (!parsed.ok) return parsed.response;
  const label = parsed.data.label.replace(/\s+/g, " ");
  const value = parsed.data.value.replace(/\s+/g, " ");

  const existing = await prisma.businessFact.findMany({ where: { businessId: ctx.businessId }, select: { id: true, label: true } });
  const same = existing.find((f) => labelKey(f.label) === labelKey(label));
  if (!same && existing.length >= MAX_FACTS) {
    return NextResponse.json({ success: false, message: `FollowUp keeps up to ${MAX_FACTS}. Remove one first.` }, { status: 409 });
  }
  // The owner's word on a name that already exists replaces it, rather than a twin.
  const fact = same
    ? await prisma.businessFact.update({ where: { id: same.id }, data: { label, value, source: "owner", sourceLeadId: null } })
    : await prisma.businessFact.create({ data: { businessId: ctx.businessId, label, value, source: "owner" } });
  void recordAudit(ctx, "business.fact.save", { targetType: "business_fact", targetId: fact.id });
  return NextResponse.json({ success: true, id: fact.id });
}
