/** A CRM's date field: a date, "never" (null or empty), or unknown (anything else). */
export function readWhen(value: unknown): { known: boolean; at: Date | null } {
  if (value === null || value === "") return { known: true, at: null };
  if (typeof value !== "string" && typeof value !== "number") return { known: false, at: null };
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? { known: false, at: null } : { known: true, at };
}

/** What the owner reads when their CRM won't take a customer FollowUp adds (A-315): what to do, never a status code. */
export function addRefused(crm: string, status: number): string {
  return status === 401 || status === 403
    ? `${crm} didn't accept FollowUp's key. Connect it again in Settings, under Connected apps.`
    : `${crm} didn't take them. Try again in a minute.`;
}
