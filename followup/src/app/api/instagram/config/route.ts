import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { activateInstagramWebhooks, instagramOAuthAvailable, resolveInstagramUserId, unsubscribeInstagramWebhooks, WEBHOOK_VERIFY_TOKEN } from "@/lib/instagram";
import { appUrl } from "@/lib/stripe";
import { requireAdmin } from "@/lib/session";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";

const accessTokenSchema = z.object({ accessToken: z.string().trim().min(1, "Paste a real access token.") });

/**
 * GET/POST/DELETE /api/instagram/config — this business's Instagram
 * connection. Unlike Twilio, there's no per-business URL to generate:
 * the webhook is app-wide (see src/app/api/instagram/webhook), so
 * Settings only ever needs a paste-the-token flow — the account ID gets
 * resolved automatically from the token via the Graph API rather than
 * asked for by hand.
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    // The token is deliberately not selected — see the matching comment in
    // the Facebook config route. instagramUserId is written and cleared
    // alongside it and answers the same question without decrypting a
    // credential on every Settings load.
    select: { instagramUserId: true, instagramUsername: true, instagramWebhookSubscribedAt: true },
  });

  return NextResponse.json({
    success: true,
    connected: !!business?.instagramUserId,
    // Connected is not the same question as receiving. An account whose
    // subscription call never succeeded is saved, readable and completely
    // silent, so Settings asks both and says so.
    receiving: !!business?.instagramWebhookSubscribedAt,
    instagramUserId: business?.instagramUserId ?? null,
    instagramUsername: business?.instagramUsername ?? null,
    webhookUrl: `${appUrl()}/api/instagram/webhook`,
    verifyToken: WEBHOOK_VERIFY_TOKEN,
    oauthAvailable: instagramOAuthAvailable(),
  });
}

/**
 * POST { accessToken } — validates the token by calling the Graph API's
 * own /me (also how the account's Instagram user ID gets resolved), then
 * saves both. Rejects up front with a clear message if the token doesn't
 * actually work, rather than saving something broken and failing silently
 * later when a real DM comes in.
 */
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  void recordAudit(ctx, "integration.instagram.update");

  const parsed = await parseJsonBody(request, accessTokenSchema);
  if (!parsed.ok) return parsed.response;
  const { accessToken } = parsed.data;

  const resolved = await resolveInstagramUserId(accessToken);
  if ("error" in resolved) {
    // Meta's own words, not a guess about the clipboard. This path is the
    // fallback someone reaches for after OAuth has already failed them —
    // telling them to re-copy a token that is in fact valid, but rejected
    // for an entirely different reason, is the worst thing this screen can
    // say. The paste box is still the right place for the detail: it is the
    // connect surface, not the send surface (same distinction
    // `readMetaError` draws in metaGraph.ts).
    return NextResponse.json(
      { success: false, message: `Meta refused that token — ${resolved.error}` },
      { status: 400 }
    );
  }

  /**
   * The same refusal the OAuth callback has always made, and this path
   * never did.
   *
   * `instagramUserId` is unique across businesses: one Instagram account
   * feeds one FollowUp account. The OAuth callback catches the collision
   * and says so. This route did not, so pasting a token for an account
   * already bound elsewhere threw out of the handler as a bare 500 —
   * which the Settings card, reading only JSON, turned into nothing at all.
   *
   * On 2026-09-24 that is exactly what happened: four presses of Connect
   * in six seconds, each audited as arriving, none saved, and the button
   * simply returned to "Connect" with no word on screen. Worse than a
   * wrong message, because it reads as the click not registering.
   */
  try {
    await prisma.business.update({
      where: { id: ctx.businessId },
      data: {
        instagramAccessToken: accessToken,
        instagramUserId: resolved.id,
        // Written with the id, never on its own: a handle from one account
        // next to the id of another would be worse than no handle at all.
        instagramUsername: resolved.username ?? null,
        // Cleared, then set below only if Meta confirms — a new token is a
        // new subscription question, and the old answer does not carry over.
        instagramWebhookSubscribedAt: null,
      },
    });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      const who = resolved.username ? `@${resolved.username}` : "That Instagram account";
      return NextResponse.json(
        {
          success: false,
          message: `${who} is already connected to a different FollowUp account. One Instagram account can feed only one FollowUp account — disconnect it there first, or use another account.`,
        },
        { status: 409 }
      );
    }
    // Anything else still answers in JSON. The error's name and Prisma code
    // only — never its message, which for a validation error can reprint
    // the arguments, and the arguments include the token.
    const code = err && typeof err === "object" && "code" in err ? String(err.code) : undefined;
    const name = err instanceof Error ? err.name : "UnknownError";
    console.error(`Instagram token save failed for business ${ctx.businessId}: ${name}${code ? ` ${code}` : ""}`);
    return NextResponse.json(
      { success: false, message: `FollowUp couldn't save that connection (${name}${code ? ` ${code}` : ""}). Nothing was changed.` },
      { status: 500 }
    );
  }
  // Same per-account webhook subscription as the OAuth callback; a
  // pasted token has the same permissions so the same call applies.
  const subscribed = await activateInstagramWebhooks(ctx.businessId, resolved.id, accessToken);

  return NextResponse.json({
    success: true,
    instagramUserId: resolved.id,
    username: resolved.username ?? null,
    webhookSubscribed: subscribed.ok,
    receiving: subscribed.ok,
  });
}

/** DELETE — disconnect: clears the token and account ID. */
export async function DELETE() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  void recordAudit(ctx, "integration.instagram.disconnect");

  // Tell Meta to stop FIRST — see the same comment in the Facebook
  // disconnect. After the update there is no token left to unsubscribe
  // with, and Meta would keep delivering this account's DMs.
  const b = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { instagramUserId: true, instagramAccessToken: true },
  });
  if (b?.instagramUserId && b.instagramAccessToken) {
    // Never lets Meta being unreachable strand someone in a connection
    // they asked to leave: the disconnect is the thing they requested,
    // and it must happen whatever Instagram does.
    try {
      await unsubscribeInstagramWebhooks(b.instagramUserId, b.instagramAccessToken);
    } catch (err) {
      console.error(`Instagram unsubscribe failed on disconnect for business ${ctx.businessId}:`, err);
    }
  }

  await prisma.business.update({
    where: { id: ctx.businessId },
    data: { instagramAccessToken: null, instagramUserId: null, instagramUsername: null, instagramWebhookSubscribedAt: null },
  });
  return NextResponse.json({ success: true });
}
