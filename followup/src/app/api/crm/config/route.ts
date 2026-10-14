import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { CRM_PROVIDERS, isCrmProvider } from "@/lib/crm";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import { loadCrmRecord } from "@/lib/crm/record";

const pauseSchema = z.object({ writesPaused: z.boolean() });

const crmConfigSchema = z.object({
  provider: z.string().max(40),
  apiKey: z.string().trim().min(1, "Paste a real API key.").max(2048),
});

// One CRM connection per business — see CrmConnection in schema.prisma.
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  // apiKey is never selected, only counted: src/lib/db.ts decrypts it on
  // every read, and this GET (any team member) needs a boolean, not the
  // credential (audit 2026-09-27). POST stores a non-empty key; DELETE
  // removes the row.
  const [conn, keyCount] = await Promise.all([
    prisma.crmConnection.findUnique({
      where: { businessId: ctx.businessId },
      select: { provider: true, accountLabel: true, lastSyncedAt: true, lastSyncError: true, writesPausedAt: true },
    }),
    prisma.crmConnection.count({ where: { businessId: ctx.businessId, AND: [{ apiKey: { not: null } }, { apiKey: { not: "" } }] } }),
  ]);
  const connected = keyCount > 0;
  // "What FollowUp wrote there" (A-252) carries customers' names and the words
  // sent to them, so it goes to admins only, like the rest of this section's controls.
  const isAdmin = await requireAdmin(ctx);
  const record = isAdmin && connected && conn ? await loadCrmRecord(ctx.businessId, conn.provider) : null;
  return NextResponse.json({
    success: true,
    connected,
    provider: conn?.provider ?? null,
    accountLabel: conn?.accountLabel ?? null,
    lastSyncedAt: conn?.lastSyncedAt ?? null,
    lastSyncError: conn?.lastSyncError ?? null,
    writesPaused: !!conn?.writesPausedAt,
    isAdmin,
    record,
  });
}

/**
 * PATCH { writesPaused } — "Pause writing there" (A-252). While paused,
 * FollowUp still brings customers in but writes nothing in the CRM; writes
 * already waiting land once it's back on (src/lib/crm/writes.ts).
 */
export async function PATCH(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  const parsed = await parseJsonBody(request, pauseSchema);
  if (!parsed.ok) return parsed.response;
  const r = await prisma.crmConnection.updateMany({
    where: { businessId: ctx.businessId },
    data: { writesPausedAt: parsed.data.writesPaused ? new Date() : null },
  });
  if (r.count === 0) return NextResponse.json({ success: false, message: "No CRM is connected." }, { status: 400 });
  void recordAudit(ctx, parsed.data.writesPaused ? "integration.crm.writes_paused" : "integration.crm.writes_resumed");
  return NextResponse.json({ success: true, writesPaused: parsed.data.writesPaused });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });

  const parsed = await parseJsonBody(request, crmConfigSchema);
  if (!parsed.ok) return parsed.response;
  const { provider, apiKey } = parsed.data;
  if (!isCrmProvider(provider)) return NextResponse.json({ success: false, message: "Pick a CRM." }, { status: 400 });

  const test = await CRM_PROVIDERS[provider].client.testConnection(apiKey);
  if (!test.ok) return NextResponse.json({ success: false, message: test.message ?? "That key didn't work." }, { status: 400 });

  await prisma.crmConnection.upsert({
    where: { businessId: ctx.businessId },
    update: { provider, apiKey, accountLabel: test.accountLabel ?? null, lastSyncError: null, writesPausedAt: null },
    create: { businessId: ctx.businessId, provider, apiKey, accountLabel: test.accountLabel ?? null },
  });
  void recordAudit(ctx, "integration.crm.update", { meta: { provider } });
  return NextResponse.json({ success: true, provider, accountLabel: test.accountLabel ?? null });
}

export async function DELETE() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  await prisma.crmConnection.deleteMany({ where: { businessId: ctx.businessId } });
  void recordAudit(ctx, "integration.crm.disconnect");
  return NextResponse.json({ success: true });
}
