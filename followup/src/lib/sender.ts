/**
 * Real greeting + signature, assembled here rather than trusted to the AI
 * (which would otherwise have to guess a name, or get told to omit one
 * entirely — the previous behavior, which read as an unsigned, abrupt
 * message). Whatever this returns is exactly what lands in the composer,
 * so it's still fully editable before anything sends.
 */

import { prisma } from "@/lib/db";

export async function getSenderFirstName(businessId: string): Promise<string> {
  const user = await prisma.user.findFirst({
    where: { businessId },
    orderBy: { createdAt: "asc" },
  });
  if (user?.name) return user.name.trim().split(" ")[0];
  if (user?.email) return user.email.split("@")[0];

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  return business?.name ?? "the team";
}

export async function composeFollowUpEmail(
  leadFirstName: string,
  businessId: string,
  body: string
): Promise<string> {
  const senderName = await getSenderFirstName(businessId);
  return `Hi ${leadFirstName},\n\n${body}\n\nBest,\n${senderName}`;
}
