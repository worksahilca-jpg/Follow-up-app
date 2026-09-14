import type { Contact } from '../types.js';

/**
 * One contact, one key. Phone wins over email because every sequence we sell
 * leads with SMS, and a customer who replies by text must silence the email
 * follow-ups too.
 */
export function contactKey(contact: Contact): string | undefined {
  if (contact.phone) return `tel:${normalizePhone(contact.phone)}`;
  if (contact.email) return `mail:${contact.email.trim().toLowerCase()}`;
  return undefined;
}

/** Strips formatting so "(416) 555-0100" and "+14165550100" are one person. */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  // North American numbers arrive both with and without the country code.
  if (digits.length === 10) return `1${digits}`;
  return digits;
}
