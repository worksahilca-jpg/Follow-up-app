import { prisma } from "@/lib/db";
import { isNotCustomerReason, type NotCustomerReason } from "@/lib/notCustomerReasons";

/**
 * The founder's view of "Not a customer" across every business (A-259):
 * how often owners corrected FollowUp, which answer they gave, on which
 * channel. Read from the audit log, numbers only: no name, address or
 * message is read or shown, the same line as the rest of /admin (H1).
 * Where FollowUp lets the wrong people through, this says where to look.
 */

export type NotCustomerAnswer = NotCustomerReason | "none";
export type NotCustomerChannel = "email" | "instagram" | "messenger";
export const NOT_CUSTOMER_CHANNELS: readonly NotCustomerChannel[] = ["email", "instagram", "messenger"];

export type NotCustomerStats = {
  days: number;
  total: number;
  /** answer → channel → count */
  table: Record<NotCustomerAnswer, Record<NotCustomerChannel, number>>;
};

function emptyRow(): Record<NotCustomerChannel, number> {
  return { email: 0, instagram: 0, messenger: 0 };
}

/** One audit row's meta, read defensively: rows from before A-259 carry no answer, and email ones no channel. */
export function readNotCustomerMeta(meta: unknown): { answer: NotCustomerAnswer; channel: NotCustomerChannel } {
  const m = meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {};
  const answer = isNotCustomerReason(m.reason) ? m.reason : "none";
  const channel = m.channel === "instagram" || m.channel === "messenger" ? m.channel : "email";
  return { answer, channel };
}

export async function getNotCustomerStats(days = 30): Promise<NotCustomerStats> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.auditEvent.findMany({
    where: { action: "lead.not_customer", createdAt: { gte: since } },
    select: { meta: true },
    take: 5000,
  });
  const table: NotCustomerStats["table"] = {
    friend: emptyRow(),
    work: emptyRow(),
    selling: emptyRow(),
    spam: emptyRow(),
    none: emptyRow(),
  };
  for (const r of rows) {
    const { answer, channel } = readNotCustomerMeta(r.meta);
    table[answer][channel] += 1;
  }
  return { days, total: rows.length, table };
}
