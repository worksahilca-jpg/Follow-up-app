/** Every call to a CRM gives up after this long, so a CRM that hangs never holds up a send or the cron. */
export const CRM_TIMEOUT_MS = 15_000;

/** One person, normalized from whichever CRM sent it. */
export interface CrmPerson {
  externalId: string;
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: Date;
}

export interface CrmClient {
  /** True/false only — never throws; used to validate a key before saving it. */
  testConnection(apiKey: string): Promise<{ ok: boolean; accountLabel?: string; message?: string }>;
  /**
   * One page of people, oldest-first-unknown-friendly: callers page until
   * `hasMore` is false or a per-run budget is spent. `cursor` is opaque —
   * whatever the provider's own pagination token is (offset, `after`, …).
   */
  fetchPage(apiKey: string, cursor: string | null, since: Date | null): Promise<{ people: CrmPerson[]; nextCursor: string | null; hasMore: boolean }>;
  /** Best-effort: write a note on the CRM's own record after FollowUp sends. Never throws. */
  pushNote(apiKey: string, externalId: string, text: string): Promise<{ ok: boolean; message?: string }>;
  /**
   * When the CRM last contacted this person, for the one-boss rule
   * (src/lib/crm/oneBoss.ts, A-237). `known: false` when the CRM couldn't
   * be asked or didn't say; `at: null` when it said "never". Never throws.
   * `person` is their phone and email in FollowUp, for a CRM that looks for the same person saved twice.
   */
  lastContactedAt(apiKey: string, externalId: string, person?: { phone: string | null; email: string | null }): Promise<{ known: boolean; at: Date | null }>;
  /**
   * Where the owner left this person in their CRM (founder, 2026-10-17): "never" is a bad ending, marked do not
   * contact or thrown out, so FollowUp never messages them; "done" is a good ending, closed or a past client, so
   * FollowUp stops chasing them. null when neither, or the CRM couldn't say. Never throws.
   */
  standing(apiKey: string, externalId: string): Promise<CrmStanding>;
}

export type CrmStanding = "never" | "done" | null;
