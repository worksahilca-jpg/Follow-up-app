/**
 * Gmail integration — real implementation.
 *
 * Single-tenant for now: there's one connected Gmail account, stored as the
 * `Integration` row with provider "gmail". Step 5 (real login) will scope
 * this per signed-in user instead of assuming "the one connected account".
 *
 * OAuth flow:
 *   1. startGmailOAuth() builds the Google consent URL.
 *   2. The user approves; Google redirects to GOOGLE_REDIRECT_URI with a
 *      `code` (handled by src/app/api/integrations/gmail/callback/route.ts),
 *      which exchanges it for tokens via exchangeCodeForTokens() below and
 *      stores them.
 *   3. fetchSalesConversations() and sendEmail() use the stored refresh
 *      token to call the Gmail API.
 */

import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";
import { prisma } from "@/lib/db";
import { Lead } from "@/lib/types";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
];

// Senders that are never sales conversations, even if they land in the inbox.
const AUTOMATED_SENDER_PATTERNS = [
  /no-?reply/i,
  /do-?not-?reply/i,
  /notifications?@/i,
  /mailer-daemon/i,
  /postmaster@/i,
];

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Gmail isn't configured: set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI in .env"
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export interface GmailConnectionStatus {
  connected: boolean;
  email?: string;
}

async function getGmailIntegration() {
  return prisma.integration.findFirst({
    where: { provider: "gmail", status: "connected" },
    include: { user: true },
  });
}

export async function getGmailStatus(): Promise<GmailConnectionStatus> {
  const integration = await getGmailIntegration();
  if (!integration) return { connected: false };
  return { connected: true, email: integration.user.email };
}

export async function startGmailOAuth(): Promise<{ redirectUrl: string }> {
  const oauth2Client = getOAuthClient();
  const redirectUrl = oauth2Client.generateAuthUrl({
    access_type: "offline", // required to get a refresh token
    prompt: "consent", // force the consent screen so we get a refresh token every time
    scope: SCOPES,
  });
  return { redirectUrl };
}

/**
 * Called by the OAuth callback route once Google redirects back with a
 * `code`. Exchanges it for tokens, figures out which Gmail account it is,
 * and upserts the User/Business/Integration rows that own the connection.
 *
 * Single-tenant assumption: reuses the first Business row if one exists
 * (creating one on first connect), and finds-or-creates a User by the
 * connected Gmail address. Step 5 replaces this with real session-based
 * user resolution.
 */
export async function exchangeCodeForTokens(code: string): Promise<{ email: string }> {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.refresh_token && !tokens.access_token) {
    throw new Error("Google didn't return any tokens for this code.");
  }
  oauth2Client.setCredentials(tokens);

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const profile = await gmail.users.getProfile({ userId: "me" });
  const email = profile.data.emailAddress;
  if (!email) throw new Error("Couldn't determine the connected Gmail address.");

  let business = await prisma.business.findFirst();
  if (!business) {
    business = await prisma.business.create({ data: { name: "My Business" } });
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: { businessId: business.id },
    create: { email, businessId: business.id, role: "ADMIN" },
  });

  const existing = await prisma.integration.findUnique({
    where: { userId_provider: { userId: user.id, provider: "gmail" } },
  });

  // A re-connect may omit refresh_token (Google only issues it the first
  // time, or when prompt=consent forces re-approval — which we always do —
  // but keep the old one as a fallback just in case).
  const refreshToken = tokens.refresh_token ?? existing?.refreshToken ?? null;

  await prisma.integration.upsert({
    where: { userId_provider: { userId: user.id, provider: "gmail" } },
    update: {
      status: "connected",
      accessToken: tokens.access_token ?? null,
      refreshToken,
      connectedAt: new Date(),
    },
    create: {
      userId: user.id,
      provider: "gmail",
      status: "connected",
      accessToken: tokens.access_token ?? null,
      refreshToken,
      connectedAt: new Date(),
    },
  });

  return { email };
}

async function getAuthedGmailClient() {
  const integration = await getGmailIntegration();
  if (!integration || !integration.refreshToken) return null;

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ refresh_token: integration.refreshToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  return { gmail, integration };
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64").toString("utf-8");
}

function extractPlainTextBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractPlainTextBody(part);
      if (text) return text;
    }
  }
  // Fall back to HTML, stripped, if no plain-text part exists.
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return decodeBase64Url(payload.body.data)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

/** Parses `"Sarah Johnson <sarah@abcmarketing.com>"` into name + email. */
function parseFromHeader(raw: string): { name: string; email: string } {
  const match = raw.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (match) {
    const name = match[1].trim();
    const email = match[2].trim().toLowerCase();
    return { name: name || email.split("@")[0], email };
  }
  const email = raw.trim().toLowerCase();
  return { name: email.split("@")[0] || email, email };
}

function isAutomatedSender(email: string): boolean {
  return AUTOMATED_SENDER_PATTERNS.some((p) => p.test(email));
}

/**
 * Pulls recent inbox threads (excluding Gmail's promo/social/updates/forums
 * tabs and obviously-automated senders), and upserts them as Lead +
 * Conversation + Message rows. Returns the leads that were created or
 * touched by this sync.
 *
 * This is a heuristic first pass, not a classifier — it treats "a real
 * back-and-forth thread with a human who isn't me" as a candidate sales
 * conversation. Real scoring/prioritization comes from the AI layer
 * (src/lib/integrations/openai.ts), not from this sync step.
 */
export async function fetchSalesConversations(): Promise<Lead[]> {
  const authed = await getAuthedGmailClient();
  if (!authed) return [];
  const { gmail, integration } = authed;
  const selfEmail = integration.user.email.toLowerCase();
  const businessId = integration.user.businessId;
  if (!businessId) return [];

  const { data: listData } = await gmail.users.threads.list({
    userId: "me",
    q: "-category:promotions -category:social -category:updates -category:forums -in:chats newer_than:90d",
    maxResults: 30,
  });

  const threadRefs = listData.threads ?? [];
  const touchedLeads: Lead[] = [];

  for (const ref of threadRefs) {
    if (!ref.id) continue;

    const { data: thread } = await gmail.users.threads.get({
      userId: "me",
      id: ref.id,
      format: "full",
    });
    const gmailMessages = thread.messages ?? [];
    if (gmailMessages.length === 0) continue;

    // Find the external counterpart: the first From/To address in the
    // thread that isn't the connected account and isn't automated.
    let counterpart: { name: string; email: string } | null = null;
    for (const m of gmailMessages) {
      const from = parseFromHeader(getHeader(m.payload?.headers, "From"));
      if (from.email !== selfEmail && !isAutomatedSender(from.email)) {
        counterpart = from;
        break;
      }
    }
    if (!counterpart) continue;

    const lastMessage = gmailMessages[gmailMessages.length - 1];
    const lastDateHeader = getHeader(lastMessage.payload?.headers, "Date");
    const lastContacted = lastDateHeader ? new Date(lastDateHeader) : new Date();

    const lead = await prisma.lead.upsert({
      where: { businessId_email: { businessId, email: counterpart.email } },
      update: { lastContacted },
      create: {
        businessId,
        name: counterpart.name,
        email: counterpart.email,
        source: "Gmail",
        stage: "NEW",
        lastContacted,
      },
    });

    let conversation = await prisma.conversation.findUnique({
      where: { externalId: thread.id! },
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { leadId: lead.id, channel: "email", externalId: thread.id! },
      });
    }

    for (const m of gmailMessages) {
      if (!m.id) continue;
      const from = parseFromHeader(getHeader(m.payload?.headers, "From"));
      const direction = from.email === selfEmail ? "outbound" : "inbound";
      const body = extractPlainTextBody(m.payload).slice(0, 5000);
      const dateHeader = getHeader(m.payload?.headers, "Date");
      const sentAt = dateHeader ? new Date(dateHeader) : new Date();

      await prisma.message.upsert({
        where: { externalId: m.id },
        update: {},
        create: {
          conversationId: conversation.id,
          direction,
          body,
          sentAt,
          externalId: m.id,
        },
      });
    }

    touchedLeads.push({
      id: lead.id,
      name: lead.name,
      company: lead.company ?? "",
      email: lead.email ?? "",
      source: lead.source ?? "Gmail",
      stage: "new",
      dealValue: lead.dealValue,
      score: lead.score,
      scoreReason: lead.scoreReason ?? "",
      scoreFactors: [],
      priority: "none",
      lastContacted: lead.lastContacted?.toISOString() ?? new Date().toISOString(),
      nextFollowUp: lead.nextFollowUp?.toISOString() ?? null,
      assignedTo: "",
      notes: lead.notes ?? "",
      conversation: [],
      suggestedMessage: "",
      automationEnabled: lead.automationOn,
    });
  }

  return touchedLeads;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ success: boolean; messageId?: string }> {
  const authed = await getAuthedGmailClient();
  if (!authed) return { success: false };
  const { gmail, integration } = authed;

  const raw = [
    `From: ${integration.user.email}`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    params.body,
  ].join("\r\n");

  const encoded = Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encoded },
  });

  return { success: true, messageId: res.data.id ?? undefined };
}
