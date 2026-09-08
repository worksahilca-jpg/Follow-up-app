import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Parses and validates a request's JSON body against a zod schema in one
 * step. Every route in this app used to do its own ad-hoc
 * `typeof body.x === "string"` checks — safe, since every field was
 * already gated one way or another, but each route reinvented the shape
 * slightly differently with no single place stating exactly what it
 * accepts. This replaces that with one schema per route and one shared
 * failure path.
 *
 * A malformed body — not JSON at all, wrong types, a missing required
 * field, an out-of-range number, an unrecognized key when the schema is
 * strict — comes back as a ready-to-return 400 response, so a route stays
 * this one line:
 *
 *   const parsed = await parseJsonBody(request, mySchema);
 *   if (!parsed.ok) return parsed.response;
 *   const { field } = parsed.data;
 *
 * The error message names the first failing field (or its message alone,
 * for a body-level error like "expected object, received string") —
 * enough for a legitimate client to fix its request, never a raw zod
 * issue dump or a stack trace.
 */
export async function parseJsonBody<S extends z.ZodTypeAny>(
  request: Request,
  schema: S
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: NextResponse }> {
  const raw = await request.json().catch(() => undefined);
  const result = schema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };

  const first = result.error.issues[0];
  const path = first?.path?.length ? first.path.join(".") : "";
  const message = first ? (path ? `${path}: ${first.message}` : first.message) : "Invalid request body.";
  return { ok: false, response: NextResponse.json({ success: false, message }, { status: 400 }) };
}

/**
 * Same idea for a route that accepts either JSON or a form-encoded body
 * (Zapier/Make and some no-code tools send form-encoded POSTs) — see
 * src/app/api/webhooks/lead/[secret]/route.ts. `raw` is already the
 * plain object either branch produced; this only adds the schema check.
 */
export function parseObject<S extends z.ZodTypeAny>(raw: unknown, schema: S): { ok: true; data: z.infer<S> } | { ok: false; response: NextResponse } {
  const result = schema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };

  const first = result.error.issues[0];
  const path = first?.path?.length ? first.path.join(".") : "";
  const message = first ? (path ? `${path}: ${first.message}` : first.message) : "Invalid request body.";
  return { ok: false, response: NextResponse.json({ success: false, message }, { status: 400 }) };
}

// --- Reused across more than one route ---

/** Trims and caps length; a common enough shape (a name, a note, a message body) to share. */
export const trimmedString = (max: number) => z.string().trim().max(max);

/**
 * For a public, unauthenticated field (the embed widget, the generic
 * lead webhook) where the whole point is to be forgiving of whatever a
 * stranger's browser or script sends: any input becomes a trimmed,
 * length-capped string, and anything that isn't a string at all (a
 * number, an object, missing entirely) quietly becomes "" rather than
 * failing the request. Never throws — this is a `.transform()`, not a
 * type check, so it can't reject a field the way `trimmedString` would;
 * pair it with a `.min(1)` check on the parsed value afterward for a
 * field that's actually required.
 */
export const cleanedText = (max: number) => z.unknown().transform((v) => (typeof v === "string" ? v.trim().slice(0, max) : ""));

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A workflow builder step (src/lib/sequences.ts's SequenceStepInput) —
 * shared between /api/sequences and /api/sequences/[id], the two routes
 * that ever accept a step array from the client. Bounds/cross-field rules
 * (delayDays 0-90, a CHANGE_STAGE step needs a stageTo) stay in
 * validateSteps() there; this only pins down each field's basic shape so
 * a malformed step can't reach a raw Prisma enum error instead of a clean
 * 400.
 */
export const sequenceStepSchema = z.object({
  delayDays: z.coerce.number(),
  action: z.enum(["EMAIL", "CHANGE_STAGE"]),
  stageTo: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"]).nullable().optional(),
  messageHint: z.string().nullable().optional(),
});
