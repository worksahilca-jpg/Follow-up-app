import { NextResponse } from "next/server";
import { z } from "zod";
import { isSocialLeadId } from "@/lib/instagramId";

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
/**
 * The largest JSON body any route here accepts: 1 MB. The biggest real
 * body in the app is a few kilobytes (a workflow's steps, a message); the
 * public ones (embed form, booking) are far smaller. Next.js route handlers
 * have no body limit of their own (bodySizeLimit is for Server Actions),
 * so without this the only ceiling is the platform's (4.5 MB on Vercel
 * Functions), and every byte of it would be parsed before zod could
 * refuse it.
 *
 * Checked on the declared Content-Length, before reading anything. A
 * chunked body with no length still falls back to the platform ceiling
 * and to each schema's own per-field caps.
 */
export const MAX_JSON_BODY_BYTES = 1024 * 1024;

export async function parseJsonBody<S extends z.ZodTypeAny>(
  request: Request,
  schema: S
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: NextResponse }> {
  const declared = Number(request.headers?.get("content-length") ?? NaN);
  if (Number.isFinite(declared) && declared > MAX_JSON_BODY_BYTES) {
    return { ok: false, response: NextResponse.json({ success: false, message: "Request body is too large." }, { status: 413 }) };
  }
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
/*
 * `.optional()` before the transform is load-bearing, and only since zod 4.
 *
 * In zod 3 a bare `z.unknown()` treated a MISSING key as present-and-
 * undefined, so `{}` parsed fine and the transform turned it into "". In
 * zod 4 the same schema rejects it — "expected nonoptional, received
 * undefined" — which on these routes means a stranger's contact form that
 * omits `phone` gets a 400 instead of becoming a lead.
 *
 * That is the exact failure this whole product exists to prevent, and no
 * typecheck or build can see it: the schema still compiles, and only the
 * behaviour changed. Found on 2026-09-21 while testing the zod 4 upgrade,
 * by five tests — lead capture during a billing lockout, embed-form
 * durability, and this one.
 */
export const cleanedText = (max: number) =>
  z
    .unknown()
    .optional()
    .transform((v) => (typeof v === "string" ? v.trim().slice(0, max) : ""));

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A phone number a person or an integration typed in — never a DM address.
 *
 * Lead.phone doubles as the Instagram/Messenger address: "ig:<igsid>" and
 * "fb:<psid>" decide the channel and the recipient of every send
 * (src/lib/instagramId.ts). Those two prefixes may only ever be written by
 * the Meta inbound path. Taken from a public form, a webhook or a CSV,
 * "ig:1784…" minted a lead FollowUp treated as an Instagram contact, and
 * one matching a real DM lead merged a stranger's words into that
 * customer's thread through the duplicate-phone path (audits 2026-09-16
 * Meta #7, 2026-09-26 A-6). Same forgiving shape as cleanedText: such a
 * value becomes "" rather than failing the request.
 */
export function sanitizeUserPhone(value: string): string {
  return isSocialLeadId(value.trim()) ? "" : value;
}

export const cleanedPhone = (max: number) => cleanedText(max).transform(sanitizeUserPhone);

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
  // Hours is the unit since 2026-09-16; days is still accepted from any
  // client that has not reloaded. validateSteps() in sequences.ts rejects a
  // step with neither, and bounds the result — this only pins the shapes.
  delayHours: z.coerce.number().optional(),
  delayDays: z.coerce.number().optional(),
  action: z.enum(["EMAIL", "CHANGE_STAGE"]),
  stageTo: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"]).nullable().optional(),
  // Goes into the drafting prompt on every run of the step, on the shared
  // OpenAI key — so it is bounded. A hint is a sentence or a paragraph;
  // 4000 characters is far past any real one.
  messageHint: z.string().max(4000).nullable().optional(),
});
