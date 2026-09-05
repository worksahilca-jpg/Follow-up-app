import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { makeBatchAssigner } from "@/lib/assignment";
import { applySourceRouting } from "@/lib/sourceRouting";

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB — plenty for a few thousand rows of lead data
const MAX_ROWS = 1000;
const MAX_TEXT = 200;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Header aliases we recognize, case/space-insensitive, checked in this order.
const COLUMN_ALIASES: Record<string, string[]> = {
  name: ["name", "full name", "lead name", "contact name", "contact"],
  company: ["company", "business", "organization", "company name"],
  email: ["email", "email address", "e-mail"],
  phone: ["phone", "phone number", "mobile", "contact number"],
  source: ["source", "lead source"],
  dealValue: ["deal value", "value", "deal", "amount", "deal size"],
  notes: ["notes", "note", "comments", "comment"],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildColumnMap(headers: string[]): Record<string, string> {
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  const map: Record<string, string> = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    const match = normalized.find((h) => aliases.includes(h.norm));
    if (match) map[field] = match.raw;
  }
  return map;
}

function cleanText(value: unknown, max = MAX_TEXT): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

// POST /api/leads/import — bulk lead import from a CSV export (Google
// Sheets, Excel, most CRMs). Header names are matched loosely (case- and
// spacing-insensitive, a handful of common aliases per field) since we
// can't control how someone's spreadsheet is titled. Only "name" is
// required; everything else is optional, same rules as manual entry.
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: BILLING_LOCKED_MESSAGE }, { status: 402 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, message: "No file uploaded." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ success: false, message: "That file is empty." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ success: false, message: "File is too large (max 2MB)." }, { status: 400 });
  }

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    return NextResponse.json(
      { success: false, message: "Couldn't read that as a CSV file." },
      { status: 400 }
    );
  }

  const headers = parsed.meta.fields ?? [];
  const columnMap = buildColumnMap(headers);
  if (!columnMap.name) {
    return NextResponse.json(
      {
        success: false,
        message: "Couldn't find a name column. Add a \"Name\" column and try again.",
      },
      { status: 400 }
    );
  }

  const rows = parsed.data.slice(0, MAX_ROWS);
  if (parsed.data.length > MAX_ROWS) {
    return NextResponse.json(
      { success: false, message: `That's ${parsed.data.length} rows — please split it into batches of ${MAX_ROWS} or fewer.` },
      { status: 400 }
    );
  }

  const existingEmails = new Set(
    (
      await prisma.lead.findMany({
        where: { businessId: ctx.businessId, email: { not: null } },
        select: { email: true },
      })
    ).map((l) => (l.email as string).toLowerCase())
  );

  const toInsert: Prisma.LeadCreateManyInput[] = [];
  const skipped: string[] = [];
  const seenEmailsInBatch = new Set<string>();
  // Distributes the whole batch across the team in-memory (see
  // src/lib/assignment.ts) rather than one auto-assign query per row.
  const nextAssignee = await makeBatchAssigner(ctx.businessId);

  rows.forEach((row, i) => {
    const rowNum = i + 2; // +1 for header row, +1 for 1-indexing
    const name = cleanText(row[columnMap.name]);
    if (!name) {
      skipped.push(`Row ${rowNum}: missing name`);
      return;
    }

    const rawEmail = columnMap.email ? cleanText(row[columnMap.email]).toLowerCase() : "";
    if (rawEmail && !EMAIL_RE.test(rawEmail)) {
      skipped.push(`Row ${rowNum} (${name}): invalid email, skipped that field`);
    }
    const email = rawEmail && EMAIL_RE.test(rawEmail) ? rawEmail : "";
    if (email && (existingEmails.has(email) || seenEmailsInBatch.has(email))) {
      skipped.push(`Row ${rowNum} (${name}): duplicate email, skipped`);
      return;
    }
    if (email) seenEmailsInBatch.add(email);

    const dealValueRaw = columnMap.dealValue ? row[columnMap.dealValue] : "";
    const dealValueNum = Number(String(dealValueRaw ?? "").replace(/[^0-9.-]/g, ""));

    toInsert.push({
      businessId: ctx.businessId,
      name,
      company: columnMap.company ? cleanText(row[columnMap.company]) || null : null,
      email: email || null,
      phone: columnMap.phone ? cleanText(row[columnMap.phone], 40) || null : null,
      source: (columnMap.source ? cleanText(row[columnMap.source]) : "") || "CSV import",
      notes: columnMap.notes ? cleanText(row[columnMap.notes], 2000) || null : null,
      dealValue: Number.isFinite(dealValueNum) && dealValueNum > 0 ? dealValueNum : 0,
      assignedToId: nextAssignee(),
    });
  });

  // createManyAndReturn (not createMany) so each row actually inserted —
  // skipDuplicates means some rows in toInsert may not be — can still get
  // applySourceRouting called on it, same as every other lead-creation path.
  const created = toInsert.length
    ? await prisma.lead.createManyAndReturn({
        data: toInsert,
        skipDuplicates: true,
        select: { id: true, source: true },
      })
    : [];

  for (const lead of created) {
    await applySourceRouting(ctx.businessId, lead.id, lead.source);
  }

  return NextResponse.json({
    success: true,
    created: created.length,
    skipped: skipped.length,
    skippedSamples: skipped.slice(0, 10),
  });
}
