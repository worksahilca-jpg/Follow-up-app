/**
 * Gmail integration — service abstraction.
 *
 * This file defines the interface the rest of the app calls. Right now every
 * function returns mock/demo data so the product is fully clickable without
 * real credentials. To go live:
 *
 *   1. Create a Google Cloud project → enable the Gmail API.
 *   2. Create OAuth 2.0 credentials (Web application type).
 *   3. Set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI in .env
 *   4. Replace the bodies below with real calls via googleapis' gmail('v1').
 *
 * Nothing elsewhere in the app needs to change — every page imports from
 * this file, not from Google's SDK directly.
 */

import { leads } from "@/lib/demo-data";
import { Lead } from "@/lib/types";

export interface GmailConnectionStatus {
  connected: boolean;
  email?: string;
}

// TODO(real API): check the Integration table for a valid stored token.
export async function getGmailStatus(): Promise<GmailConnectionStatus> {
  return { connected: false };
}

// TODO(real API): kick off the OAuth consent screen redirect.
export async function startGmailOAuth(): Promise<{ redirectUrl: string }> {
  return { redirectUrl: "/settings?demo=gmail-oauth-not-configured" };
}

// TODO(real API): call gmail.users.threads.list + .get, filtered to likely
// sales conversations (heuristics + AI classification), then map to Lead[].
export async function fetchSalesConversations(): Promise<Lead[]> {
  return leads;
}

// TODO(real API): call gmail.users.messages.send with a MIME-encoded message.
export async function sendEmail(params: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ success: boolean; messageId?: string }> {
  console.log("[demo] would send email", params);
  return { success: true, messageId: "demo-message-id" };
}
