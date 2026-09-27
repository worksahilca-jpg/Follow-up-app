import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import type { SessionContext } from "@/lib/session";

/**
 * Append-only audit trail (see AuditEvent in schema.prisma). Call it from
 * every sensitive action; it never throws and never blocks the action —
 * a failure to write the audit row is logged, not surfaced. Pass only
 * identifiers and counts in `meta`: no credentials, no message bodies.
 *
 * Resolves `false` when the row was not written. Most callers ignore it:
 * the row is a record OF the action. A few rows ARE the action — an
 * "ai.hold" is what puts a draft in front of the owner (pendingApprovals.ts)
 * — and those callers check it.
 */
export async function recordAudit(
  ctx: SessionContext | { businessId: string; userId?: string | null },
  action: string,
  details: { targetType?: string; targetId?: string; meta?: Record<string, unknown> } = {}
): Promise<boolean> {
  try {
    let ip: string | null = null;
    try {
      const h = await headers();
      ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
    } catch {
      // Not in a request context (cron/webhook) — no IP to record.
    }
    await prisma.auditEvent.create({
      data: {
        businessId: ctx.businessId,
        userId: "userId" in ctx ? (ctx.userId ?? null) : null,
        action,
        targetType: details.targetType ?? null,
        targetId: details.targetId ?? null,
        meta: details.meta ?? undefined,
        ip,
      },
    });
    return true;
  } catch (err) {
    console.error(`Audit write failed for ${action}:`, err);
    return false;
  }
}
