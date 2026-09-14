import type { Blueprint } from '../types.js';

export class BlueprintRegistry {
  private readonly byId = new Map<string, Blueprint>();

  constructor(blueprints: Blueprint[] = []) {
    for (const b of blueprints) this.register(b);
  }

  register(blueprint: Blueprint): void {
    if (this.byId.has(blueprint.id)) {
      throw new Error(`Duplicate blueprint id: ${blueprint.id}`);
    }
    this.byId.set(blueprint.id, blueprint);
  }

  get(id: string): Blueprint | undefined {
    return this.byId.get(id);
  }

  all(): Blueprint[] {
    return [...this.byId.values()];
  }
}
