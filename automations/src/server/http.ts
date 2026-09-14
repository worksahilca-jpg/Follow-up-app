import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import type { AutomationEvent, ClientConfig, TriggerKey } from '../types.js';
import type { Engine } from '../engine/engine.js';
import type { Store } from '../engine/store.js';
import { renderDashboard } from './dashboard.js';

const TRIGGERS: TriggerKey[] = [
  'call.missed',
  'call.completed',
  'lead.created',
  'job.completed',
  'quote.sent',
  'quote.accepted',
  'appointment.booked',
  'appointment.no_show',
  'message.inbound',
  'manual',
];

export interface ServerOptions {
  engine: Engine;
  store: Store;
  clients: Map<string, ClientConfig>;
  /** Shared secret every webhook must present as `x-automation-key`. */
  webhookSecret: string;
  /** Separate secret for the dashboard link we give the owner. */
  dashboardSecret: string;
}

export function createApp(opts: ServerOptions): Server {
  return createServer((req, res) => {
    handle(req, res, opts).catch((error: unknown) => {
      // Never leak an internal message to a caller we do not control.
      console.error('[automations] unhandled', error);
      if (!res.headersSent) json(res, 500, { error: 'internal error' });
    });
  });
}

async function handle(req: IncomingMessage, res: ServerResponse, opts: ServerOptions): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean);

  if (url.pathname === '/health') {
    return json(res, 200, { ok: true, clients: opts.clients.size });
  }

  // POST /hooks/:clientId/:trigger
  if (req.method === 'POST' && parts[0] === 'hooks' && parts.length === 3) {
    if (!authorized(req, opts.webhookSecret)) return json(res, 401, { error: 'unauthorized' });

    const client = opts.clients.get(parts[1] ?? '');
    if (!client) return json(res, 404, { error: 'unknown client' });

    const trigger = parts[2] as TriggerKey;
    if (!TRIGGERS.includes(trigger)) return json(res, 400, { error: 'unknown trigger' });

    const body = await readJson(req);
    if (!body) return json(res, 400, { error: 'body must be a JSON object' });

    const event = toEvent(client.id, trigger, body);
    if (!event) return json(res, 400, { error: 'contact needs a phone or an email' });

    const runs = await opts.engine.handleEvent(client, event);
    return json(res, 202, { accepted: true, runs: runs.map((r) => ({ id: r.id, status: r.status })) });
  }

  // POST /cron/tick — resumes every follow-up whose wait has elapsed.
  if (req.method === 'POST' && url.pathname === '/cron/tick') {
    if (!authorized(req, opts.webhookSecret)) return json(res, 401, { error: 'unauthorized' });
    const resumed = await opts.engine.tick(opts.clients);
    return json(res, 200, { resumed: resumed.length });
  }

  // GET /dash/:clientId?key=...
  if (req.method === 'GET' && parts[0] === 'dash' && parts.length === 2) {
    const client = opts.clients.get(parts[1] ?? '');
    if (!client) return text(res, 404, 'Not found');
    if (!secretEquals(url.searchParams.get('key') ?? '', opts.dashboardSecret)) {
      return text(res, 401, 'Not authorised');
    }
    const runs = await opts.store.listRuns(client.id);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderDashboard(client, runs));
    return;
  }

  return json(res, 404, { error: 'not found' });
}

/**
 * Normalises whatever the source system posts into our event shape. Sources
 * disagree on field names more than they disagree on anything else, so this
 * accepts the common spellings rather than making every client's Zap unique.
 */
export function toEvent(
  clientId: string,
  trigger: TriggerKey,
  body: Record<string, unknown>,
): AutomationEvent | undefined {
  const contactRaw = (body.contact ?? body) as Record<string, unknown>;
  const phone = firstString(contactRaw, ['phone', 'from', 'From', 'caller', 'phoneNumber']);
  const email = firstString(contactRaw, ['email', 'Email', 'emailAddress']);
  if (!phone && !email) return undefined;

  const data = (body.data as Record<string, unknown>) ?? stripContactKeys(body);

  return {
    clientId,
    trigger,
    externalId: firstString(body, ['id', 'externalId', 'eventId', 'MessageSid', 'CallSid']),
    contact: {
      name: firstString(contactRaw, ['name', 'fullName', 'customerName']),
      phone,
      email,
    },
    data,
    occurredAt: Date.now(),
  };
}

function stripContactKeys(body: Record<string, unknown>): Record<string, unknown> {
  const out = { ...body };
  for (const key of ['contact', 'phone', 'email', 'name', 'id', 'externalId']) delete out[key];
  return out;
}

function firstString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function authorized(req: IncomingMessage, secret: string): boolean {
  const header = req.headers['x-automation-key'];
  const provided = Array.isArray(header) ? header[0] : header;
  return secretEquals(provided ?? '', secret);
}

/** Constant-time compare so a webhook key cannot be guessed a byte at a time. */
export function secretEquals(provided: string, expected: string): boolean {
  if (!expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown> | undefined> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    // A webhook body is small; anything larger is a mistake or an attack.
    if (size > 256 * 1024) return undefined;
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return {};
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function text(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(body);
}
