/**
 * Shared shape of a Meta Graph send failure. Leaf module (no imports) so
 * src/lib/instagram.ts and src/lib/facebook.ts can both use it without
 * one depending on the other — tests mock each of those files wholesale.
 */

/**
 * What a Meta error looks like once it is worth keeping: Graph's own
 * `code` and `error_subcode` are what tell a closed 24-hour window
 * (10/2018278) from a dead token from a message tag the app isn't allowed
 * to use, and until now both senders threw them away and kept only the
 * prose (api-facts §D3). Logged verbatim on every non-2xx so the first
 * live run pins each one.
 */
export type MetaSendResult = {
  success: boolean;
  message?: string;
  status?: number;
  code?: number;
  subcode?: number;
};

export async function readMetaError(res: Response, fallback: string, where: string): Promise<MetaSendResult> {
  const data = await res.json().catch(() => ({}));
  const error = data?.error ?? {};
  const message = typeof error.message === "string" ? error.message : fallback;
  const code = typeof error.code === "number" ? error.code : undefined;
  const subcode = typeof error.error_subcode === "number" ? error.error_subcode : undefined;
  // Identifiers and codes only — never the message body, never the token.
  console.error(`${where} rejected a send: HTTP ${res.status}, code ${code ?? "?"}, subcode ${subcode ?? "?"}: ${message}`);
  return { success: false, message, status: res.status, code, subcode };
}
