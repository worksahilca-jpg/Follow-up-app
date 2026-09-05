import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { pickAssignee } from "@/lib/assignment";
import { applySourceRouting } from "@/lib/sourceRouting";
import { instagramLeadId } from "@/lib/instagramId";
import type { Lead } from "@prisma/client";

const GRAPH_API = "https://graph.instagram.com";

/**
 * Instagram DM capture via the Instagram Graph API (Meta Developer App
 * "FollowUp", App ID 2713853435677364). Unlike Twilio/the generic
 * webhook, this is a SINGLE app-wide integration — one Meta app, one
 * webhook callback URL configured once in the Meta console — not a
 * per-business URL/secret. Each business's own connected Instagram
 * account is identified by instagramUserId once its access token is
 * saved (see src/app/api/instagram/config/route.ts), and inbound webhook
 * events get routed to the right business by matching that ID against
 * the event's recipient ID.
 *
 * Leads have no dedicated "Instagram-scoped ID" column — phone has no
 * format validation (it's just a unique-per-business text column, not
 * checked against a phone number shape), so it's reused here the same way
 * Twilio reuses it for a real phone number, prefixed `ig:` so the two can
 * never collide and so it's obvious at a glance in the UI where a given
 * lead's "phone" field actually came from. The prefix logic itself lives
 * in src/lib/instagramId.ts, a zero-dependency leaf module — see that file
 * for why (a client component needs isInstagramLeadId without pulling in
 * everything else this file imports).
 */

/**
 * This app-wide handshake secret is intentionally a literal constant, not
 * an env var: it only gates Meta's initial webhook verification GET
 * request (proving the URL is really meant to be a webhook endpoint,
 * nothing sensitive), and it has to be typed into the Meta console by
 * hand as plain text anyway when the Webhooks product is configured —
 * there's no secret-sharing problem an env var would solve here that
 * isn't already solved by just picking a value once and using it in both
 * places. Real request authenticity for the POST payloads is INSTAGRAM_
 * APP_SECRET below, checked via HMAC signature, the same way Twilio's
 * Auth Token gates its webhooks.
 */
export const WEBHOOK_VERIFY_TOKEN = "followup_ig_a8f3c1e0d92b47";

/**
 * Validates Meta's X-Hub-Signature-256 header (HMAC-SHA256 of the raw
 * request body, keyed by the Meta app's App Secret — Settings → Basic in
 * the developer console, separate from any per-user access token).
 * Optional the same way Twilio's Auth Token is optional: skipped (not
 * hard-blocked) when INSTAGRAM_APP_SECRET isn't set yet, so the webhook
 * works the moment it's registered and tightens up whenever the secret
 * is added to Vercel's env vars.
 */
export function validateMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appSecret) return true; // not configured yet — see doc comment above
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const provided = signatureHeader.slice("sha256=".length);
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Resolves the Instagram-scoped user ID for an access token, via the Graph API's own /me. Called once, when a token is saved in Settings. */
export async function resolveInstagramUserId(accessToken: string): Promise<{ id: string; username?: string } | null> {
  const res = await fetch(`${GRAPH_API}/me?fields=id,username&access_token=${encodeURIComponent(accessToken)}`);
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.id ? { id: data.id, username: data.username } : null;
}

/** Sends a real Instagram DM reply via the Graph API's Messenger-style /me/messages endpoint. */
export async function sendInstagramMessage(
  businessId: string,
  recipientId: string,
  text: string
): Promise<{ success: boolean; message?: string }> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { instagramAccessToken: true },
  });
  if (!business?.instagramAccessToken) {
    return { success: false, message: "Instagram isn't connected yet — check Settings → Instagram." };
  }

  const res = await fetch(`${GRAPH_API}/me/messages?access_token=${encodeURIComponent(business.instagramAccessToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = data?.error?.message;
    return { success: false, message: typeof message === "string" ? message : "Instagram rejected this message." };
  }
  return { success: true };
}

/**
 * Optimistic find-or-create, same shape as Twilio's phone lookup — a later
 * DM from the same sender should update one lead, not create a new one
 * each time. Backed by Lead's `(businessId, phone)` unique constraint
 * (the Instagram-prefixed id is stored in the `phone` column — see the
 * file doc comment above), so two concurrent DMs from a brand-new sender
 * can't both create a Lead: the loser's `create` gets a P2002, caught
 * below and turned into the same "just update lastContacted" outcome as
 * the non-race path. Not a plain Prisma `upsert` because
 * `applySourceRouting` must run exactly once, only on genuine creation.
 */
export async function findOrCreateLeadByInstagram(
  businessId: string,
  senderId: string,
  senderUsername?: string
): Promise<Lead> {
  const phone = instagramLeadId(senderId);
  const existing = await prisma.lead.findFirst({ where: { businessId, phone } });
  if (existing) {
    return prisma.lead.update({ where: { id: existing.id }, data: { lastContacted: new Date() } });
  }
  try {
    const lead = await prisma.lead.create({
      data: {
        businessId,
        name: senderUsername ? `@${senderUsername}` : "Instagram DM",
        phone,
        source: "Instagram",
        stage: "NEW",
        lastContacted: new Date(),
        assignedToId: await pickAssignee(businessId),
      },
    });
    await applySourceRouting(businessId, lead.id, "Instagram");
    return lead;
  } catch (err) {
    // Lost the race to a concurrent request that created this lead first —
    // it's guaranteed to exist now. Don't re-run applySourceRouting; it
    // already ran once, for whichever request actually created the row.
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      const winner = await prisma.lead.findFirst({ where: { businessId, phone } });
      return prisma.lead.update({ where: { id: winner!.id }, data: { lastContacted: new Date() } });
    }
    throw err;
  }
}
