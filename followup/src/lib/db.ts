/**
 * Prisma client singleton.
 *
 * Next.js dev mode hot-reloads modules on every save, which would otherwise
 * spin up a new PrismaClient (and a new DB connection pool) on every edit.
 * Stashing it on `globalThis` in development avoids that.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
