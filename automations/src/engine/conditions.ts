import type { Condition } from '../types.js';
import { resolvePath } from './template.js';

export interface ConditionContext {
  /** True when the contact has replied since the run started. */
  contactReplied: boolean;
  /** Scope for path-based conditions, same shape templates see. */
  scope: Record<string, unknown>;
}

export function evaluate(condition: Condition, ctx: ConditionContext): boolean {
  switch (condition.op) {
    case 'always':
      return true;
    case 'never':
      return false;
    case 'contact_replied':
      return ctx.contactReplied;
    case 'exists': {
      const value = resolvePath(ctx.scope, condition.path);
      return value !== undefined && value !== null && value !== '';
    }
    case 'equals':
      return resolvePath(ctx.scope, condition.path) === condition.value;
    case 'not':
      return !evaluate(condition.of, ctx);
    case 'all':
      return condition.of.every((c) => evaluate(c, ctx));
    case 'any':
      return condition.of.some((c) => evaluate(c, ctx));
  }
}
