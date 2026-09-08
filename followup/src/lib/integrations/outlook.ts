/**
 * Outlook / Microsoft 365 integration — the second email channel, alongside
 * Gmail. Mirrors src/lib/integrations/gmail.ts's shape deliberately (same
 * function names/roles, same multi-tenant discipline: every function takes
 * an explicit businessId, never "find the one connected account") so the
 * rest of the app — sending, acknowledgement, scoring — barely has to know
 * which mailbox a lead's thread actually lives in.
 *
 * Two real differences from Gmail, both from Microsoft's own API shape,
 * not a design choice here:
 *   1. No client library does token refresh for us the way `googleapis`
 *      does — Graph access tokens last ~1 hour and get refreshed by hand
 *      (refreshAccessTokenIfNeeded below) using the stored refresh token
 *      and tokenExpiresAt.
 *   2. Incremental sync uses Graph's delta query
 *      (/me/mailFolders/inbox/messages/delta), whose cursor
 *      (@odata.deltaLink) is opaque and persisted on Integration.deltaLink
 *      — there's no Gmail-style "after:<timestamp>" query to build by hand.
 *
 * OAuth flow (tenant "common" — works for both personal Microsoft accounts
 * and work/school Microsoft 365 accounts, which is what "any small
 * business" actually needs):
 *   1. buildOutlookAuthUrl() sends the owner to Microsoft's consent screen.
 *   2. Microsoft redirects to the callback route with a `code`, exchanged
 *      for tokens by exchangeOutlookAuthCode() below.
 *   3. fetchOutlookConversations() and sendOutlookEmail() use the stored
 *      (and kept-fresh) access token to call Graph.
 */

import { prisma } from "@/lib/db";
import { Lead, Message } from "@/lib/types";
import { classifyAsProspect } from "@/lib/integrations/openai";
import { mapWithConcurrency } from "@/lib/concurrency";
import { pickAssignee } from "@/lib/assignment";
import { notifyLeadEvent } from "@/lib/outboundWebhook";
import { checkRapidEngagement } from "@/lib/engagement";
import { applySourceRouting } from "@/lib/sourceRouting";
import { acknowledgeNewLead } from "@/lib/acknowledge";

const AUTHORITY = "https://login.microsoftonline.com/common/oauth2/v2.0";
const GRAPH = "https://graph.microsoft.com/v1.0";

// offline_access is what gets us a refresh token at all; the rest are the
// minimum Mail scopes for reading the inbox and sending/replying.
const SCOPES = ["offline_access", "openid", "email", "Mail.Read", "Mail.Send", "User.Read"];

const AUTOMATED_SENDER_PATTERNS = [
  /no-?reply/i,
  /do-?not-?reply/i,
  /notifications?@/i,
  /mailer-daemon/i,
  /postmaster@/i,
];

function isAutomatedSender(email: string): boolean {
  return AUTOMATED_SENDER_PATTERNS.some((p) => p.test(email));
}

function credentials(): { clientId: string; clientSecret: string; redirectUri: string } | null {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

/** Whether Settings should show the real "Connect Outlook" flow at all. */
export function outlookOAuthAvailable(): boolean {
  return credentials() !== null;
}

export interface OutlookConnectionStatus {
  connected: boolean;
  email?: string;
}

// The business's Outlook connection — scoped by business, never a global
// findFirst, so one tenant's inbox can never leak into another's.
async function getOutlookIntegration(businessId: string) {
  return prisma.integration.findFirst({
    where: { provider: "outlook", status: "connected", user: { businessId } },
    include: { user: true },
  });
}

export async function getOutlookStatus(businessId: string): Promise<OutlookConnectionStatus> {
  const integration = await getOutlookIntegration(businessId);
  if (!integration) return { connected: false };
  return { connected: true, email: integration.accountEmail ?? integration.user.email };
}

// `next` rides through Microsoft's consent screen as the OAuth `state`
// param and comes back verbatim on the callback — same pattern as Gmail's
// startGmailOAuth, needed for the same reason: the redirect to Microsoft
// is a real page navigation that loses any client-side page state.
export function buildOutlookAuthUrl(next?: string): string {
  const creds = credentials();
  if (!creds) throw new Error("Outlook isn't configured: set MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REDIRECT_URI in .env");
  const url = new URL(`${AUTHORITY}/authorize`);
  url.searchParams.set("client_id", creds.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", creds.redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("prompt", "consent"); // force consent every time so we reliably get a refresh token
  if (next) url.searchParams.set("state", next);
  return url.toString();
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

/**
 * Called by the OAuth callback route once Microsoft redirects back with a
 * `code`. Exchanges it for tokens and stores them against the ALREADY
 * signed-in user (userId comes from the session, not guessed) — mirrors
 * exchangeCodeForTokens() in gmail.ts exactly.
 */
export async function exchangeOutlookAuthCode(code: string, userId: string): Promise<{ email: string }> {
  const creds = credentials();
  if (!creds) throw new Error("Outlook isn't configured.");

  const res = await fetch(`${AUTHORITY}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: creds.redirectUri,
      scope: SCOPES.join(" "),
    }),
  });
  const tokens: TokenResponse = await res.json();
  if (!res.ok || !tokens.access_token) {
    throw new Error(tokens.error_description ?? tokens.error ?? "Microsoft didn't return any tokens for this code.");
  }

  const profile = await fetch(`${GRAPH}/me?$select=mail,userPrincipalName`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  }).then((r) => r.json());
  // A work/school account's sign-in name (userPrincipalName) isn't always
  // a real mailbox address (e.g. an on-prem-synced UPN) — `mail` is the
  // actual SMTP address Graph will send from, so it's preferred whenever
  // present.
  const email: string | undefined = profile.mail ?? profile.userPrincipalName;
  if (!email) throw new Error("Couldn't determine the connected Outlook address.");

  const existing = await prisma.integration.findUnique({
    where: { userId_provider: { userId, provider: "outlook" } },
  });
  const refreshToken = tokens.refresh_token ?? existing?.refreshToken ?? null;
  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);

  await prisma.integration.upsert({
    where: { userId_provider: { userId, provider: "outlook" } },
    update: {
      status: "connected",
      accessToken: tokens.access_token,
      refreshToken,
      tokenExpiresAt: expiresAt,
      connectedAt: new Date(),
      accountEmail: email,
      lastSyncError: null,
    },
    create: {
      userId,
      provider: "outlook",
      status: "connected",
      accessToken: tokens.access_token,
      refreshToken,
      tokenExpiresAt: expiresAt,
      connectedAt: new Date(),
      accountEmail: email,
    },
  });

  return { email };
}

// Refresh this far ahead of actual expiry so a slow request (or clock
// skew between us and Microsoft) never fires one with an already-dead token.
const TOKEN_REFRESH_BUFFER_MS = 5 * 60_000;

/**
 * Returns a definitely-valid access token for this business's Outlook
 * connection, refreshing it first if it's expired or close to it — the
 * hand-rolled equivalent of what `googleapis`' OAuth2 client does for
 * Gmail automatically. Returns null if there's no connection, or if the
 * refresh itself fails (refresh token revoked — the connection then needs
 * a real reconnect, which the caller surfaces via lastSyncError).
 */
async function getValidAccessToken(businessId: string): Promise<{ accessToken: string; integration: NonNullable<Awaited<ReturnType<typeof getOutlookIntegration>>> } | null> {
  const integration = await getOutlookIntegration(businessId);
  if (!integration || !integration.refreshToken) return null;

  const expiresAt = integration.tokenExpiresAt?.getTime() ?? 0;
  if (integration.accessToken && expiresAt - Date.now() > TOKEN_REFRESH_BUFFER_MS) {
    return { accessToken: integration.accessToken, integration };
  }

  const creds = credentials();
  if (!creds) return null;

  const res = await fetch(`${AUTHORITY}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      grant_type: "refresh_token",
      refresh_token: integration.refreshToken,
      scope: SCOPES.join(" "),
    }),
  });
  const tokens: TokenResponse = await res.json();
  if (!res.ok || !tokens.access_token) {
    console.error(`Outlook token refresh failed for business ${businessId}:`, tokens.error_description ?? tokens.error);
    return null;
  }

  const newExpiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);
  // Microsoft may or may not rotate the refresh token on each use —
  // fall back to the existing one when it doesn't.
  const refreshToken = tokens.refresh_token ?? integration.refreshToken;
  await prisma.integration.update({
    where: { id: integration.id },
    data: { accessToken: tokens.access_token, refreshToken, tokenExpiresAt: newExpiresAt },
  });

  return { accessToken: tokens.access_token, integration: { ...integration, accessToken: tokens.access_token, refreshToken, tokenExpiresAt: newExpiresAt } };
}

async function graphFetch(businessId: string, path: string, init: RequestInit = {}): Promise<Response | null> {
  const authed = await getValidAccessToken(businessId);
  if (!authed) return null;
  return fetch(`${GRAPH}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${authed.accessToken}` },
  });
}

/**
 * Disconnect: best-effort revoke isn't possible for Graph the way Gmail
 * lets us hit a /revoke endpoint (Microsoft's app-level token revocation
 * needs admin consent APIs a small business's own login can't call) — so
 * this simply clears the stored tokens, which is what actually matters:
 * FollowUp can no longer use them.
 */
export async function disconnectOutlook(businessId: string): Promise<void> {
  await prisma.integration.updateMany({
    where: { provider: "outlook", status: "connected", user: { businessId } },
    data: {
      status: "disconnected",
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      deltaLink: null,
      lastSyncError: null,
    },
  });
}

function isAutomatedOrSelf(email: string, selfEmail: string): boolean {
  return email === selfEmail || isAutomatedSender(email);
}

type GraphMessage = {
  id: string;
  conversationId: string;
  subject?: string;
  bodyPreview?: string;
  body?: { contentType?: string; content?: string };
  from?: { emailAddress?: { name?: string; address?: string } };
  toRecipients?: { emailAddress?: { address?: string } }[];
  receivedDateTime?: string;
  sentDateTime?: string;
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function messageText(m: GraphMessage): string {
  const content = m.body?.content ?? m.bodyPreview ?? "";
  const text = m.body?.contentType === "html" ? stripHtml(content) : content;
  return text.slice(0, 5000);
}

export type OutlookSyncOptions = {
  skipClassification?: boolean;
  maxClassifications?: number;
  onResult?: (info: { truncated: boolean }) => void;
};

export type SyncedLead = Lead & { touched: boolean };

/**
 * Same role as processThreadRefs() in gmail.ts, one Graph "conversation"
 * (Microsoft's own grouping of related messages, the equivalent of a
 * Gmail thread) at a time. Graph has no single "get this whole thread"
 * call the way Gmail's threads.get does, so each conversationId is
 * fetched via a $filter query instead.
 */
async function processConversations(
  businessId: string,
  selfEmail: string,
  conversationIds: string[],
  sourceLabel: string,
  options: OutlookSyncOptions = {}
): Promise<SyncedLead[]> {
  let classifications = 0;
  let truncated = false;

  const businessContext = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true, industry: true },
  });

  const results = await mapWithConcurrency(conversationIds, 5, async (conversationId): Promise<SyncedLead | null> => {
    try {
      return await processOneConversation(conversationId);
    } catch (err) {
      console.error(`Failed to process Outlook conversation ${conversationId}:`, err);
      return null;
    }
  });

  options.onResult?.({ truncated });
  return results.filter((lead): lead is SyncedLead => lead !== null);

  async function processOneConversation(conversationId: string): Promise<SyncedLead | null> {
    const res = await graphFetch(
      businessId,
      `/me/messages?$filter=conversationId eq '${conversationId}'&$select=id,conversationId,subject,bodyPreview,body,from,toRecipients,receivedDateTime,sentDateTime&$orderby=receivedDateTime asc&$top=50`
    );
    if (!res || !res.ok) return null;
    const data: { value?: GraphMessage[] } = await res.json();
    const graphMessages = data.value ?? [];
    if (graphMessages.length === 0) return null;

    const parsedMessages = graphMessages.map((m) => {
      const fromEmail = (m.from?.emailAddress?.address ?? "").toLowerCase();
      const fromName = m.from?.emailAddress?.name || fromEmail.split("@")[0] || fromEmail;
      const sentAt = new Date(m.receivedDateTime ?? m.sentDateTime ?? Date.now());
      return {
        id: m.id,
        from: { name: fromName, email: fromEmail },
        direction: (fromEmail === selfEmail ? "outbound" : "inbound") as "outbound" | "inbound",
        body: messageText(m),
        sentAt,
        subject: m.subject,
      };
    });

    const counterpart = parsedMessages.find((m) => m.from.email && !isAutomatedOrSelf(m.from.email, selfEmail))?.from;
    if (!counterpart) return null;

    const alreadyKnown = !!(await prisma.conversation.findUnique({
      where: { externalId: conversationId },
      select: { id: true },
    }));

    const newestMessageAt = parsedMessages[parsedMessages.length - 1].sentAt;

    if (process.env.OPENAI_API_KEY && !alreadyKnown && !options.skipClassification) {
      const priorVerdict = await prisma.filteredEmail.findUnique({
        where: { businessId_threadId: { businessId, threadId: conversationId } },
        select: { lastMessageAt: true },
      });
      if (priorVerdict && priorVerdict.lastMessageAt >= newestMessageAt) return null;

      if (options.maxClassifications !== undefined && classifications >= options.maxClassifications) {
        truncated = true;
        return null;
      }
      classifications += 1;

      try {
        const transcript: Message[] = parsedMessages.map((m) => ({
          id: m.id,
          direction: m.direction,
          channel: "email",
          body: m.body,
          date: m.sentAt.toISOString(),
          opened: false,
        }));
        const { isProspect, reason } = await classifyAsProspect(transcript, counterpart, businessContext ?? undefined);
        if (!isProspect) {
          await prisma.filteredEmail.upsert({
            where: { businessId_threadId: { businessId, threadId: conversationId } },
            update: { reason, lastMessageAt: newestMessageAt },
            create: {
              businessId,
              threadId: conversationId,
              provider: "outlook",
              senderName: counterpart.name,
              senderEmail: counterpart.email,
              subject: parsedMessages[0]?.subject ?? null,
              reason,
              lastMessageAt: newestMessageAt,
            },
          });
          return null;
        }
      } catch (err) {
        console.error(`Failed to classify Outlook conversation ${conversationId}:`, err);
      }
    }

    await prisma.filteredEmail.deleteMany({ where: { businessId, threadId: conversationId } });

    const lastContacted = parsedMessages[parsedMessages.length - 1].sentAt;

    const existingLead = await prisma.lead.findUnique({
      where: { businessId_email: { businessId, email: counterpart.email } },
      select: { id: true, lastContacted: true },
    });
    const isNewLead = !existingLead;
    const touched = isNewLead || !existingLead.lastContacted || newestMessageAt > existingLead.lastContacted;

    const lead = await prisma.lead.upsert({
      where: { businessId_email: { businessId, email: counterpart.email } },
      update: { lastContacted },
      create: {
        businessId,
        name: counterpart.name,
        email: counterpart.email,
        source: sourceLabel,
        stage: "NEW",
        lastContacted,
        assignedToId: isNewLead ? await pickAssignee(businessId) : undefined,
      },
    });
    if (isNewLead) {
      void notifyLeadEvent(businessId, "lead.created", lead);
      await applySourceRouting(businessId, lead.id, sourceLabel);
    }

    let conversation = await prisma.conversation.findUnique({ where: { externalId: conversationId } });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { leadId: lead.id, channel: "email", externalId: conversationId, emailProvider: "outlook" },
      });
    }

    for (const m of parsedMessages) {
      await prisma.message.upsert({
        where: { externalId: m.id },
        update: {},
        create: { conversationId: conversation.id, direction: m.direction, body: m.body, sentAt: m.sentAt, externalId: m.id },
      });
    }
    await checkRapidEngagement(lead.id);

    if (isNewLead) {
      const newestInbound = [...parsedMessages].reverse().find((m) => m.direction === "inbound");
      if (newestInbound) {
        await acknowledgeNewLead(lead.id, {
          channel: "email",
          inboundText: newestInbound.body,
          inboundAt: newestInbound.sentAt,
          hasHumanReply: parsedMessages.some((m) => m.direction === "outbound"),
          // Graph's own message id — sendOutlookEmail() below hits
          // POST /me/messages/{id}/reply with it directly, unlike Gmail's
          // acknowledgement which needs the RFC822 Message-ID header to
          // build a raw MIME In-Reply-To. No such header round-trip is
          // needed here since Graph's /reply endpoint handles threading
          // itself from the message id alone.
          emailMessageId: newestInbound.id,
          emailSubject: newestInbound.subject,
        });
      }
    }

    return {
      id: lead.id,
      name: lead.name,
      company: lead.company ?? "",
      email: lead.email ?? "",
      source: lead.source ?? sourceLabel,
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
      automationTier: lead.automationTier.toLowerCase() as Lead["automationTier"],
      touched,
    };
  }
}

const INITIAL_SELECT = "id,conversationId,subject,bodyPreview,from,receivedDateTime,sentDateTime";

/**
 * Pulls inbox activity via Graph's delta query and upserts whatever passes
 * classification, exactly like Gmail's fetchSalesConversations(). The
 * first call for a connection (no stored deltaLink) does a full pass over
 * the last 90 days' worth of pages; every call after that only sees what
 * changed since the last run's deltaLink — Graph's own incremental
 * mechanism, no `since` timestamp math needed on our side.
 *
 * A stale/expired deltaLink (Graph returns 410 Gone after roughly a
 * month of no sync) is handled by simply dropping it and starting a fresh
 * full pass — same "re-seeing a thread is cheap" property Gmail's design
 * comment relies on, since known conversations skip the classifier.
 */
export async function fetchOutlookConversations(
  businessId: string,
  options: Pick<OutlookSyncOptions, "maxClassifications" | "onResult"> = {}
): Promise<SyncedLead[]> {
  const authed = await getValidAccessToken(businessId);
  if (!authed) return [];
  const selfEmail = (authed.integration.accountEmail ?? authed.integration.user.email).toLowerCase();

  let nextUrl: string;
  if (authed.integration.deltaLink) {
    nextUrl = authed.integration.deltaLink;
  } else {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60_000).toISOString();
    nextUrl = `${GRAPH}/me/mailFolders/inbox/messages/delta?$select=${INITIAL_SELECT}&$filter=receivedDateTime ge ${since}`;
  }

  const conversationIds = new Set<string>();
  let deltaLink: string | undefined;
  let pages = 0;
  const MAX_PAGES = 10; // budget: a page is 999 messages by default — plenty for a per-tick pull

  while (nextUrl && pages < MAX_PAGES) {
    const res = await graphFetch(businessId, nextUrl.replace(GRAPH, ""));
    if (!res) return [];
    if (res.status === 410) {
      // Delta token expired/invalidated — drop it and let the next tick
      // start a fresh full pass instead of erroring forever.
      await prisma.integration.updateMany({
        where: { provider: "outlook", status: "connected", user: { businessId } },
        data: { deltaLink: null },
      });
      return [];
    }
    if (!res.ok) {
      throw new Error(`Graph delta query failed: ${res.status} ${await res.text().catch(() => "")}`);
    }
    const data: { value?: GraphMessage[]; "@odata.nextLink"?: string; "@odata.deltaLink"?: string } = await res.json();
    for (const m of data.value ?? []) {
      if (m.conversationId) conversationIds.add(m.conversationId);
    }
    nextUrl = data["@odata.nextLink"] ?? "";
    deltaLink = data["@odata.deltaLink"] ?? deltaLink;
    pages += 1;
  }

  if (deltaLink) {
    await prisma.integration.updateMany({
      where: { provider: "outlook", status: "connected", user: { businessId } },
      data: { deltaLink },
    });
  }

  return processConversations(businessId, selfEmail, [...conversationIds], "Outlook", options);
}

/** The owner's override for a filtered-out conversation, mirroring importGmailThread(). */
export async function importOutlookConversation(businessId: string, conversationId: string): Promise<Lead | null> {
  const authed = await getValidAccessToken(businessId);
  if (!authed) return null;
  const selfEmail = (authed.integration.accountEmail ?? authed.integration.user.email).toLowerCase();
  const [lead] = await processConversations(businessId, selfEmail, [conversationId], "Outlook", { skipClassification: true });
  return lead ?? null;
}

/**
 * Sends (or replies to) an email via Graph. When replyToMessageId is
 * given — the Graph id of the specific message being answered, stored as
 * Message.externalId for Outlook-captured messages — this hits
 * POST /me/messages/{id}/reply, which sends immediately (unlike
 * createReply, which only drafts) and handles subject/threading/
 * recipient itself from the original message. Otherwise falls back to
 * POST /me/sendMail for a brand-new thread (e.g. a manually-entered lead
 * with no captured inbound message yet).
 */
export async function sendOutlookEmail(
  businessId: string,
  params: { to: string; subject: string; body: string; replyToMessageId?: string }
): Promise<{ success: boolean; messageId?: string }> {
  if (params.replyToMessageId) {
    const res = await graphFetch(businessId, `/me/messages/${encodeURIComponent(params.replyToMessageId)}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: params.body }),
    });
    if (!res || !res.ok) return { success: false };
    // Graph's /reply returns 202 Accepted with no body and no new
    // message id — there's nothing else to key off here, so the sent
    // copy is picked up on the next sync like any other outbound mail.
    return { success: true };
  }

  const res = await graphFetch(businessId, "/me/sendMail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject: params.subject,
        body: { contentType: "Text", content: params.body },
        toRecipients: [{ emailAddress: { address: params.to } }],
      },
    }),
  });
  if (!res || !res.ok) return { success: false };
  return { success: true };
}
