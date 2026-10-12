/** A CRM's date field: a date, "never" (null or empty), or unknown (anything else). */
export function readWhen(value: unknown): { known: boolean; at: Date | null } {
  if (value === null || value === "") return { known: true, at: null };
  if (typeof value !== "string" && typeof value !== "number") return { known: false, at: null };
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? { known: false, at: null } : { known: true, at };
}
