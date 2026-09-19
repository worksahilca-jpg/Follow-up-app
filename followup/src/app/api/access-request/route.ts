import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseJsonBody } from "@/lib/validation";
import { notifySlack } from "@/lib/slack";

// POST /api/access-request — the beta's front door (founder, 2026-09-19:
// "let's make this a beta version where users can test"). Sign-up stays
// invite-only (PRODUCT_DIRECTION, CEO decision 2026-09-18); this is how a
// stranger asks for the invite. The founder approves from /admin, and
// src/lib/auth.ts lets an approved email sign in without a redeploy.
//
// Public and unauthenticated, so: strict schema, a honeypot field bots fill
// and people never see, one row per email (a resubmit updates the note
// rather than piling up), and a platform-wide cap of 60 requests an hour.
// RateLimitHit is keyed to a Business, and there is no business yet, so
// the cap counts this table directly.
const schema = z.object({
  name: z.string().trim().min(1, "Your name, so we know who to add.").max(120),
  email: z.string().trim().toLowerCase().email("That email doesn't look right."),
  business: z.string().trim().max(200).optional(),
  channels: z.array(z.enum(["email", "instagram", "whatsapp", "text", "website", "other"])).max(6).optional(),
  note: z.string().trim().max(1000).optional(),
  // Honeypot: rendered off-screen, must stay empty.
  website: z.string().max(0).optional(),
});

const HOURLY_CAP = 60;

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;
  const { name, email, business, channels, note } = parsed.data;

  const recent = await prisma.accessRequest.count({
    where: { createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= HOURLY_CAP) {
    return NextResponse.json({ success: false, message: "Too many requests right now — try again in an hour." }, { status: 429 });
  }

  const existing = await prisma.accessRequest.findUnique({ where: { email } });
  const row = await prisma.accessRequest.upsert({
    where: { email },
    create: { name, email, business: business || null, channels: (channels ?? []).join(","), note: note || null },
    // A second request from the same person refreshes what they told us;
    // it never resets an approval already given.
    update: { name, business: business || null, channels: (channels ?? []).join(","), note: note || null },
  });

  if (!existing) {
    void notifySlack(
      `🙋 Beta request: *${name}* <${email}>` +
        (business ? ` · ${business}` : "") +
        (channels && channels.length > 0 ? ` · ${channels.join(", ")}` : "") +
        ` — approve at /admin`
    );
  }

  return NextResponse.json({ success: true, id: row.id, alreadyApproved: row.status === "approved" });
}
