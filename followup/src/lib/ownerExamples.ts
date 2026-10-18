import { prisma } from "@/lib/db";
import { MAX_EXAMPLE_TEXT, PROMPT_EXAMPLES, type OwnerExampleLine } from "@/lib/ownerExampleLines";

/**
 * "Write it better" (A-290, founder 2026-10-18: "lets make a model and lets train it … i will make owners to train
 * this model"). In "Try it yourself" the owner taps "Write it better" under a FollowUp reply and writes what they
 * would really say. That pair (what the customer said, what the owner would answer) is kept here, and every later
 * draft for this business reads the newest few as examples (examplesPromptBlock), so FollowUp handles the same
 * moment the owner's way, on every channel, from the first example on.
 *
 * Not a trained model: examples in the instructions work from one example and cost nothing to change. The rows are
 * also exactly what a trained model would need later, if the business ever asks for one. This business only, never
 * shared.
 */

/** At most this many per business; the oldest go first. */
export const MAX_KEPT = 50;

export type PracticeChannel = "email" | "instagram" | "messenger";

/** The newest examples for a draft. Never throws: a draft never stops over its examples. */
export async function getOwnerExamples(businessId: string): Promise<OwnerExampleLine[]> {
  try {
    const rows = await prisma.ownerExample.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: PROMPT_EXAMPLES,
      select: { customerSaid: true, reply: true },
    });
    return rows ?? [];
  } catch {
    return [];
  }
}

export async function saveOwnerExample(
  businessId: string,
  userId: string,
  input: { channel: PracticeChannel; customerSaid: string; reply: string }
): Promise<{ id: string }> {
  const row = await prisma.ownerExample.create({
    data: {
      businessId,
      userId,
      channel: input.channel,
      customerSaid: input.customerSaid.trim().slice(0, MAX_EXAMPLE_TEXT),
      reply: input.reply.trim().slice(0, MAX_EXAMPLE_TEXT),
    },
    select: { id: true },
  });
  // Keep the newest MAX_KEPT.
  const old = await prisma.ownerExample.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    skip: MAX_KEPT,
    select: { id: true },
  });
  if (old.length) await prisma.ownerExample.deleteMany({ where: { businessId, id: { in: old.map((o) => o.id) } } });
  return row;
}

/** Undo. Scoped to the business, so an id from another business deletes nothing. */
export async function deleteOwnerExample(businessId: string, id: string): Promise<boolean> {
  const { count } = await prisma.ownerExample.deleteMany({ where: { businessId, id } });
  return count > 0;
}
