/**
 * Prisma's "unique constraint failed" (error code P2002), recognised the
 * same way everywhere (backlog b040, 2026-10-02): the race-loser's signal
 * in every claim-by-insert in this codebase, from a booking slot to a
 * synced email to an owner alert.
 *
 * Duck-typed on the code rather than `instanceof
 * Prisma.PrismaClientKnownRequestError`: an extension-wrapped client or a
 * second copy of the Prisma package can hand back an error that carries
 * the code but fails the class check, and the code is what Prisma
 * documents. A leaf module with no imports, so it can be used from any
 * layer.
 */
export function isUniqueViolation(err: unknown): boolean {
  return !!err && typeof err === "object" && "code" in err && (err as { code?: unknown }).code === "P2002";
}
