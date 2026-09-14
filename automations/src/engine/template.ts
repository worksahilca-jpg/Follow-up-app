import type { AutomationEvent, ClientConfig } from '../types.js';

/**
 * Deliberately tiny template language: {{ path.to.value }} and nothing else.
 *
 * No loops, no conditionals, no arbitrary expressions. Client configs are
 * written by us but read by the owner during onboarding, and a template that
 * can only substitute values is one an owner can proofread and we can
 * promise the behaviour of.
 */
export interface TemplateScope {
  client: ClientConfig;
  event: AutomationEvent;
  contact: Record<string, unknown>;
  data: Record<string, unknown>;
  drafts: Record<string, string>;
  settings: Record<string, unknown>;
}

const TOKEN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function resolvePath(scope: unknown, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = scope;
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/**
 * Renders a template. An unresolved token renders as an empty string rather
 * than leaving "{{contact.name}}" in a text message to a customer — a visible
 * broken token is the fastest way to lose a client.
 */
export function render(template: string, scope: TemplateScope): string {
  const flat = buildScope(scope);
  return template
    .replace(TOKEN, (_match, path: string) => {
      const value = resolvePath(flat, path);
      if (value === undefined || value === null) return '';
      return String(value);
    })
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** Derived conveniences the templates lean on constantly. */
export function buildScope(scope: TemplateScope): Record<string, unknown> {
  const name = typeof scope.contact.name === 'string' ? scope.contact.name : '';
  const firstName = name.trim().split(/\s+/)[0] ?? '';
  return {
    ...scope,
    contact: { ...scope.contact, firstName },
    business: {
      name: scope.client.businessName,
      owner: scope.client.ownerName,
    },
  };
}

/** Lists every token a template references. Used by the config validator to
 *  catch a typo before it reaches a customer's phone. */
export function tokensIn(template: string): string[] {
  const out: string[] = [];
  for (const m of template.matchAll(TOKEN)) {
    const token = m[1];
    if (token) out.push(token);
  }
  return out;
}
