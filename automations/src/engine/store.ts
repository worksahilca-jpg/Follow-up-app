import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { OptOutRecord, ReplyRecord, Run } from '../types.js';

export interface Store {
  saveRun(run: Run): Promise<void>;
  getRun(id: string): Promise<Run | undefined>;
  listRuns(clientId: string): Promise<Run[]>;
  /** Runs whose wait has elapsed, oldest first. */
  dueRuns(now: number): Promise<Run[]>;

  recordReply(record: ReplyRecord): Promise<void>;
  repliedSince(clientId: string, contactKey: string, since: number): Promise<boolean>;

  recordOptOut(record: OptOutRecord): Promise<void>;
  isOptedOut(clientId: string, contactKey: string): Promise<boolean>;

  /** True the first time this key is seen, false afterwards. Source systems
   *  retry webhooks; without this an owner's customer gets texted twice. */
  claimOnce(key: string): Promise<boolean>;
}

interface Snapshot {
  runs: Record<string, Run>;
  replies: ReplyRecord[];
  optOuts: OptOutRecord[];
  claimed: string[];
}

const EMPTY: Snapshot = { runs: {}, replies: [], optOuts: [], claimed: [] };

/** In-memory store. Used by tests and by `npm run simulate`. */
export class MemoryStore implements Store {
  protected snapshot: Snapshot = structuredClone(EMPTY);

  async saveRun(run: Run): Promise<void> {
    this.snapshot.runs[run.id] = structuredClone(run);
    await this.flush();
  }

  async getRun(id: string): Promise<Run | undefined> {
    const run = this.snapshot.runs[id];
    return run ? structuredClone(run) : undefined;
  }

  async listRuns(clientId: string): Promise<Run[]> {
    return Object.values(this.snapshot.runs)
      .filter((r) => r.clientId === clientId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => structuredClone(r));
  }

  async dueRuns(now: number): Promise<Run[]> {
    return Object.values(this.snapshot.runs)
      .filter((r) => r.status === 'waiting' && (r.resumeAt ?? Infinity) <= now)
      .sort((a, b) => (a.resumeAt ?? 0) - (b.resumeAt ?? 0))
      .map((r) => structuredClone(r));
  }

  async recordReply(record: ReplyRecord): Promise<void> {
    this.snapshot.replies.push(record);
    await this.flush();
  }

  async repliedSince(clientId: string, contactKey: string, since: number): Promise<boolean> {
    return this.snapshot.replies.some(
      (r) => r.clientId === clientId && r.contactKey === contactKey && r.at >= since,
    );
  }

  async recordOptOut(record: OptOutRecord): Promise<void> {
    this.snapshot.optOuts.push(record);
    await this.flush();
  }

  async isOptedOut(clientId: string, contactKey: string): Promise<boolean> {
    return this.snapshot.optOuts.some((r) => r.clientId === clientId && r.contactKey === contactKey);
  }

  async claimOnce(key: string): Promise<boolean> {
    if (this.snapshot.claimed.includes(key)) return false;
    this.snapshot.claimed.push(key);
    await this.flush();
    return true;
  }

  protected async flush(): Promise<void> {
    /* memory store keeps nothing */
  }
}

/**
 * File-backed store. Enough for a single client's automation running on one
 * box, which is what a custom project is on day one. Swap in Postgres by
 * implementing `Store` — nothing else in the engine knows the difference.
 */
export class JsonStore extends MemoryStore {
  private loaded = false;

  constructor(private readonly path: string) {
    super();
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.path, 'utf8');
      this.snapshot = { ...structuredClone(EMPTY), ...(JSON.parse(raw) as Partial<Snapshot>) };
    } catch {
      this.snapshot = structuredClone(EMPTY);
    }
    this.loaded = true;
  }

  protected override async flush(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    // Write-then-rename so a crash mid-write cannot truncate the log of what
    // we already sent on the client's behalf.
    const tmp = `${this.path}.tmp`;
    await writeFile(tmp, JSON.stringify(this.snapshot, null, 2), 'utf8');
    const { rename } = await import('node:fs/promises');
    await rename(tmp, this.path);
  }
}

export function defaultStorePath(clientId: string): string {
  return join(process.cwd(), 'data', `${clientId}.json`);
}
