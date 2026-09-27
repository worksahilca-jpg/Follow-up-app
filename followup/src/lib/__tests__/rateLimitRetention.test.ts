/**
 * RateLimitHit retention (src/lib/rateLimit.ts, pruneRateLimitHits).
 *
 * Two guarantees:
 *   1. Old rows go. Every attempt at a limited endpoint writes one, the
 *      public embed and booking endpoints included, and nothing else ever
 *      deletes them — a stranger could otherwise grow the table forever.
 *   2. No row still inside ANY caller's window is ever pruned. The weekly
 *      digest uses a 7-day hit as its "already sent" claim; pruning inside
 *      that window would send the digest twice. The second test reads every
 *      `windowMinutes:` in the source, so a new, longer window added later
 *      fails here instead of silently shortening someone's limit.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const { deleteMany } = vi.hoisted(() => ({ deleteMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { rateLimitHit: { deleteMany } } }));

import { pruneRateLimitHits, RATE_LIMIT_RETENTION_DAYS } from "@/lib/rateLimit";

beforeEach(() => {
  vi.clearAllMocks();
  deleteMany.mockResolvedValue({ count: 3 });
});

describe("pruneRateLimitHits", () => {
  it("deletes only rows older than the retention period", async () => {
    const now = new Date("2026-09-26T12:00:00.000Z");
    const result = await pruneRateLimitHits(now);
    expect(result).toEqual({ deleted: 3 });
    expect(deleteMany).toHaveBeenCalledTimes(1);
    const cutoff: Date = deleteMany.mock.calls[0][0].where.createdAt.lt;
    expect(now.getTime() - cutoff.getTime()).toBe(RATE_LIMIT_RETENTION_DAYS * 24 * 60 * 60_000);
    // Nothing else in the filter: not per business, not per action.
    expect(Object.keys(deleteMany.mock.calls[0][0].where)).toEqual(["createdAt"]);
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Evaluates `7 * 24 * 60`-style constant arithmetic, and nothing else. */
function arithmetic(expr: string): number | null {
  const clean = expr.replace(/_/g, "").trim();
  if (!/^[\d\s*+]+$/.test(clean)) return null;
  return clean
    .split("+")
    .map((term) => term.split("*").reduce((acc, n) => acc * Number(n.trim()), 1))
    .reduce((a, b) => a + b, 0);
}

describe("retention outlasts every rate-limit window in the codebase", () => {
  it("is longer than the longest windowMinutes any caller passes", () => {
    const srcRoot = join(__dirname, "..", "..");
    const windows: { file: string; minutes: number }[] = [];
    for (const file of sourceFiles(srcRoot)) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/windowMinutes:\s*([A-Za-z_][A-Za-z0-9_]*|[\d_]+)/g)) {
        const token = m[1];
        // `windowMinutes: number` is a type annotation (the helpers' own
        // signatures in rateLimit.ts), not a caller.
        if (token === "number") continue;
        let minutes = arithmetic(token);
        if (minutes === null) {
          const def = text.match(new RegExp(`const\\s+${token}\\s*=\\s*([^;\\n]+)`));
          minutes = def ? arithmetic(def[1]) : null;
        }
        if (minutes === null) {
          throw new Error(`Can't read windowMinutes "${token}" in ${file} — teach this test to, don't skip it.`);
        }
        windows.push({ file, minutes });
      }
    }
    expect(windows.length).toBeGreaterThan(10);
    const longest = Math.max(...windows.map((w) => w.minutes));
    expect(longest).toBeGreaterThanOrEqual(7 * 24 * 60); // the weekly digest claim
    expect(RATE_LIMIT_RETENTION_DAYS * 24 * 60).toBeGreaterThan(longest);
  });
});
