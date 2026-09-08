import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { CRM_PROVIDERS, isCrmProvider } from "@/lib/crm";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";

const crmConfigSchema = z.object({
  provider: z.string(),
  apiKey: z.string().trim().min(1, "Paste a real API key."),
});

// One CRM connection per business — see CrmConnection in schema.prisma.
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  const conn = await prisma.crmConnection.findUnique({ where: { businessId: ctx.businessId } });
  return NextResponse.json({
    success: true,
    connected: !!conn?.apiKey,
    provider: conn?.provider ?? null,
    accountLabel: conn?.accountLabel ?? null,
    lastSyncedAt: conn?.lastSyncedAt ?? null,
    lastSyncError: conn?.lastSyncError ?? null,
  });
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
    update: { provider, apiKey, accountLabel: test.accountLabel ?? null, lastSyncError: null },
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
