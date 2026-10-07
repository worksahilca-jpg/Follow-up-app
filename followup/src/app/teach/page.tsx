import { redirect } from "next/navigation";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { teachQuestions } from "@/lib/teachQuestions";
import TeachFlow from "@/components/TeachFlow";

export const dynamic = "force-dynamic";

/**
 * "Teach FollowUp your business" (A-100): a few questions customers in this
 * trade ask most, one per screen. Shown once after setup, and from Settings →
 * What FollowUp knows any time. Admins only, because an answer goes into
 * replies sent in the business's name.
 */
export default async function TeachPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/signin");
  if (!(await requireAdmin(ctx))) redirect("/dashboard");

  const [business, facts] = await Promise.all([
    prisma.business.findUnique({ where: { id: ctx.businessId }, select: { industry: true } }),
    prisma.businessFact.findMany({ where: { businessId: ctx.businessId }, orderBy: { createdAt: "asc" }, select: { label: true, value: true } }),
  ]);
  const questions = teachQuestions(business?.industry, facts.map((f) => f.label));
  return <TeachFlow questions={questions} known={facts} />;
}
