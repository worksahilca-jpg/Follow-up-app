import type { AutomationEvent, ClientConfig, TriggerKey } from '../types.js';
import type { BlueprintRegistry } from '../engine/registry.js';

export interface ValidationIssue {
  level: 'error' | 'warning';
  where: string;
  message: string;
}

/**
 * Run this before every hand-off. Every issue it reports is one we have
 * actually shipped to a client at least once: a blueprint id typo, a missing
 * review link, a config with no sending number.
 */
export function validateClient(client: ClientConfig, registry: BlueprintRegistry): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (where: string, message: string) => issues.push({ level: 'error', where, message });
  const warn = (where: string, message: string) => issues.push({ level: 'warning', where, message });

  if (!client.id.trim()) err('id', 'client id is empty');
  if (!client.businessName.trim()) err('businessName', 'business name is empty — it appears in every message');
  if (!client.ownerName.trim()) warn('ownerName', 'no owner name; messages will read less personal');

  const hours = client.businessHours;
  if (hours.days.length === 0) err('businessHours.days', 'no open days — every customer message would be held forever');
  if (hours.startMinute >= hours.endMinute) err('businessHours', 'startMinute must be before endMinute');
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: hours.timezone });
  } catch {
    err('businessHours.timezone', `"${hours.timezone}" is not a valid IANA timezone`);
  }

  if (!client.ownerPhone && !client.ownerEmail) {
    warn('ownerPhone/ownerEmail', 'owner alerts have nowhere to go');
  }

  const seen = new Set<string>();
  for (const installed of client.automations) {
    const where = `automations.${installed.id}`;
    if (seen.has(installed.id)) err(where, 'duplicate automation id');
    seen.add(installed.id);

    const blueprint = registry.get(installed.blueprintId);
    if (!blueprint) {
      err(where, `unknown blueprint "${installed.blueprintId}"`);
      continue;
    }

    for (const spec of blueprint.settings) {
      const value = installed.settings[spec.key];
      const missing = value === undefined || value === null || value === '';
      if (spec.required && missing) {
        err(`${where}.${spec.key}`, `${spec.label} is required — ask the owner: "${spec.ask}"`);
      }
    }

    // A blueprint that texts is useless without a number to text from.
    const sendsSms = blueprint
      .build({ client, settings: installed.settings, event: probeEvent(client.id, blueprint.trigger) })
      .some((s) => s.type === 'send_sms');
    if (sendsSms && !client.fromPhone) {
      err(where, 'this automation sends SMS but the client has no fromPhone');
    }

    const pushesCrm = blueprint
      .build({ client, settings: installed.settings, event: probeEvent(client.id, blueprint.trigger) })
      .some((s) => s.type === 'http_post' && !client.refs[s.urlRef]);
    if (pushesCrm) {
      warn(where, 'a CRM push step has no matching entry in refs — it will be skipped at run time');
    }
  }

  if (client.automations.some((a) => a.enabled) && !client.branding.smsOptOutNotice.trim()) {
    warn('branding.smsOptOutNotice', 'no opt-out wording on the first SMS of a sequence');
  }

  return issues;
}

/** A minimal event used only to inspect the shape of a blueprint's steps. */
function probeEvent(clientId: string, trigger: TriggerKey): AutomationEvent {
  return {
    clientId,
    trigger,
    contact: { name: 'Probe', phone: '+15550000000' },
    data: { startsAt: Date.now() + 86_400_000 },
    occurredAt: Date.now(),
  };
}

export function hasErrors(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.level === 'error');
}

export function formatIssues(issues: ValidationIssue[]): string {
  if (issues.length === 0) return 'No issues — safe to hand over.';
  return issues
    .map((i) => `${i.level === 'error' ? 'ERROR  ' : 'warning'} ${i.where}: ${i.message}`)
    .join('\n');
}
