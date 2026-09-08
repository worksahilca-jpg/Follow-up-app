/**
 * Prisma client singleton, with credential encryption at rest.
 *
 * Next.js dev mode hot-reloads modules on every save, which would otherwise
 * spin up a new PrismaClient (and a new DB connection pool) on every edit.
 * Stashing it on `globalThis` in development avoids that.
 *
 * The `$extends` block below is the only place the app touches ciphertext:
 * the fields in ENCRYPTED_FIELDS are encrypted on every write and decrypted
 * on every read for their model (see src/lib/crypto.ts), so the rest of the
 * code keeps reading `business.twilioAuthToken` as a plain string. Nested
 * writes through a relation are not intercepted — none of these fields is
 * ever written that way; keep it so.
 */
import { PrismaClient } from "@prisma/client";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

const ENCRYPTED_FIELDS: Record<string, string[]> = {
  Integration: ["accessToken", "refreshToken"],
  Business: ["twilioAuthToken", "instagramAccessToken", "facebookPageAccessToken"],
  CrmConnection: ["apiKey"],
};

type Rec = Record<string, unknown>;

function mapFields(obj: unknown, fields: string[], fn: (v: string) => string): void {
  if (!obj || typeof obj !== "object") return;
  const rec = obj as Rec;
  for (const f of fields) {
    const v = rec[f];
    if (typeof v === "string" && v.length > 0) rec[f] = fn(v);
    // Prisma also accepts { set: "value" } in update data.
    else if (v && typeof v === "object" && typeof (v as Rec).set === "string") {
      (v as Rec).set = fn((v as Rec).set as string);
    }
  }
}

function encryptArgs(args: Rec, fields: string[]): void {
  if (args.data) {
    if (Array.isArray(args.data)) args.data.forEach((d) => mapFields(d, fields, encryptSecret));
    else mapFields(args.data, fields, encryptSecret);
  }
  if (args.create) mapFields(args.create, fields, encryptSecret);
  if (args.update) mapFields(args.update, fields, encryptSecret);
}

function decryptResult(result: unknown, fields: string[]): void {
  if (Array.isArray(result)) result.forEach((r) => mapFields(r, fields, decryptSecret));
  else mapFields(result, fields, decryptSecret);
}

function createClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  }).$extends({
    name: "credentialEncryption",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const fields = ENCRYPTED_FIELDS[model];
          if (!fields) return query(args);
          const a = args as Rec;
          if (["create", "update", "upsert", "createMany", "updateMany"].includes(operation)) {
            encryptArgs(a, fields);
          }
          const result = await query(args);
          // Count/aggregate results carry no rows; everything else may.
          if (typeof result === "object" && result !== null && !("count" in (result as Rec) && Object.keys(result as Rec).length === 1)) {
            decryptResult(result, fields);
          }
          return result;
        },
      },
    },
  });
}

type ExtendedClient = ReturnType<typeof createClient>;

const globalForPrisma = globalThis as unknown as { prisma: ExtendedClient | undefined };

export const prisma: ExtendedClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
