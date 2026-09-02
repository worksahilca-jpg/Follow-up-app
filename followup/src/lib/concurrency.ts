/**
 * Runs `fn` over `items` with at most `limit` in flight at once.
 *
 * The sync/cleanup/automation loops each call an external API (Gmail,
 * OpenAI) or write to the DB per item. A plain sequential `for` loop is
 * safe but slow — one business with 50 leads means 50 round trips back to
 * back, which adds up fast against a serverless function's time limit.
 * Firing everything at once (`Promise.all` with no cap) is faster but
 * risks tripping OpenAI/Gmail per-account rate limits and exhausting the
 * DB connection pool under concurrent load from many businesses at once.
 * A small fixed worker pool is the middle ground: `limit` workers each
 * pull the next item off a shared cursor until the list is empty.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}
