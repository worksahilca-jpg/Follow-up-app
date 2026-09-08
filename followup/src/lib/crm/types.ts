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
}
