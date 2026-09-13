/**
 * What a lane is allowed to know when it wakes up.
 *
 * A shift gets a context pack, not a database connection. Two reasons, and
 * both matter more than the convenience of handing an agent everything:
 *
 * 1. Cost. Context is the bill. A pack that grows with the table is a
 *    bill that grows with the table.
 * 2. Trust. FollowUp's whole pitch to its own customers is that their data
 *    is handled carefully (PRODUCT_DIRECTION.md's rule 3); an internal tool
 *    that shipped customer names to a model because it was easier would be
 *    a strange way to honour that. Packs carry the *content* people wrote
 *    and nothing that identifies who wrote it.
 *
 * A pack can also come back as `skip` — nothing has happened since the
 * last shift. That is a result, not a failure, and it costs nothing.
 */

import { prisma } from "@/lib/db";

export type ContextPack =
  | { kind: "work"; instruction: string; context: string }
  | { kind: "skip"; reason: string };

/** The cutoff for incremental lanes: when this desk last finished a shift. */
async function lastSuccessAt(roleId: string): Promise<Date | null> {
  const last = await prisma.agentRun.findFirst({
    where: { roleId, status: "SUCCEEDED" },
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  });
  return last?.startedAt ?? null;
}

/**
 * Product & UX: the themes in what people using FollowUp actually said
 * about it. Reads ProductFeedback — the quiet form in Settings, the one
 * nothing ever prompts for — across every business, because the founder
 * owns that feedback and nobody is reading it today.
 */
async function productUxPack(roleId: string): Promise<ContextPack> {
  const since = await lastSuccessAt(roleId);
  const feedback = await prisma.productFeedback.findMany({
    where: since ? { createdAt: { gt: since } } : {},
    orderBy: { createdAt: "desc" },
    take: 80,
    select: {
      message: true,
      createdAt: true,
      business: { select: { industry: true, teamSize: true } },
    },
  });

  if (feedback.length === 0) {
    return {
      kind: "skip",
      reason: since
        ? `No new feedback since the last shift on ${since.toISOString().slice(0, 10)}.`
        : "No product feedback has been submitted yet.",
    };
  }

  // Names, user ids and business ids deliberately absent — see the note at
  // the top of this file. Industry and team size stay because they change
  // what a complaint means, and neither identifies anyone.
  const context = feedback
    .map((f) => {
      const who = [
        f.business?.industry ?? "industry not given",
        f.business?.teamSize ? `team of ${f.business.teamSize}` : null,
      ]
        .filter(Boolean)
        .join(", ");
      return `[${f.createdAt.toISOString().slice(0, 10)} · ${who}]\n${f.message.trim()}`;
    })
    .join("\n\n");

  return {
    kind: "work",
    instruction: [
      `Below are ${feedback.length} pieces of feedback left by people using FollowUp${
        since ? ` since ${since.toISOString().slice(0, 10)}` : ""
      }.`,
      "Find the themes. Quote people rather than paraphrasing them — a direct quote with its date is worth more than a summary.",
      "Say which themes are new and which have been said before in different words.",
      "If something here contradicts the product direction (rescuing dead and unreached leads, rising autonomy, every language, flat tiers), say so plainly instead of smoothing it over.",
      "If the evidence is thin, say it is thin. Do not pad this out.",
    ].join(" "),
    context,
  };
}

export async function buildContextPack(roleKey: string, roleId: string): Promise<ContextPack> {
  switch (roleKey) {
    case "product-ux-agent":
      return productUxPack(roleId);
    default:
      // Every other desk is seeded but not staffed yet — runner.ts refuses
      // these before it gets here, so this is a backstop, not a path.
      return { kind: "skip", reason: `No runner is implemented for ${roleKey} yet.` };
  }
}
