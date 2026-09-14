import type { ClientConfig } from '../types.js';
import { demoPlumbing } from './demo-plumbing.js';

/**
 * Every delivered client, by id. Adding a sale is one import and one entry —
 * that is the whole point of the model.
 */
export const CLIENTS: ClientConfig[] = [demoPlumbing];

export function clientMap(): Map<string, ClientConfig> {
  return new Map(CLIENTS.map((c) => [c.id, c]));
}

export function getClient(id: string): ClientConfig | undefined {
  return CLIENTS.find((c) => c.id === id);
}

export { demoPlumbing };
