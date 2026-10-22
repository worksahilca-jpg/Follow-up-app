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
  /** The owner's own stages, in the CRM's order (A-275). [] when the CRM couldn't say. Never throws. */
  listStages(apiKey: string): Promise<CrmStage[]>;
  /** Moves this person to one of those stages (A-275). `name` is theirs, for a CRM that needs one to make a record. */
  moveToStage(apiKey: string, externalId: string, stageId: string, name: string): Promise<{ ok: boolean; message?: string }>;
  /**
   * The notes on this person, as plain text (A-303, "Read my notes"): the owner's call notes and FollowUp's own alike;
   * the caller tells them apart. [] when the CRM couldn't say. Never throws. Only where the CRM is read for notes.
   */
  listNotes?(apiKey: string, externalId: string): Promise<CrmNote[]>;
  /**
   * Adds this person to the CRM ("Missed by your CRM", A-315), or finds them there when the CRM already has them by
   * email or phone, so a tap never makes a second copy. `externalId` is their id in the CRM either way. Never throws.
   */
  createPerson(apiKey: string, person: NewCrmPerson): Promise<{ ok: boolean; externalId?: string; message?: string }>;
}

/**
 * Someone FollowUp adds to the owner's CRM: what they told FollowUp, nothing more. At least an email or a phone; the
 * names are "" when FollowUp only has a placeholder, so the CRM shows the email or phone instead of a made-up name.
 */
export interface NewCrmPerson {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
}

/** A note on a person in the owner's CRM. `at` is null when the CRM didn't say when. */
export interface CrmNote {
  id: string;
  body: string;
  at: Date | null;
}

/** A stage in the owner's CRM: its id there, and its name as the owner sees it. */
export interface CrmStage {
  id: string;
  name: string;
}

export type CrmStanding = "never" | "done" | null;
