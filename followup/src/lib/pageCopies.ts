/**
 * A page that brings its parts' first answers with it (Settings, 2026-10-27).
 *
 * Every Settings part asked its own API route when it opened. Those routes
 * are rarely called, so on Vercel each one started cold: 1.3–3.6 s apiece
 * (gmail/status 3.6 s, whatsapp/config 3.2 s, automation/settings 2.9 s,
 * measured Oct 27), while the page itself answered in about 0.1 s because
 * it is opened all day. The founder: "it responds after about 10 seconds".
 *
 * So the page's server render runs those same GET handlers itself
 * (collectCopies, with the list in src/lib/settingsCopies.ts) and hands the
 * answers down; a part that opens takes the page's copy (fetchOnOpen)
 * instead of waking a route. Same handlers, same session check, same JSON.
 *
 * Rules that keep a copy from ever showing something already changed:
 *  - fetchOnOpen is for a part's first load only, never a reload after a
 *    change: the copy is from when the page opened.
 *  - A copy serves as many opens as there are parts that show it (`reads`),
 *    and only parts that are themselves the only place its data changes.
 *    After that, or after COPY_MS, or when there is no copy, it is a plain
 *    fetch, exactly as before.
 */

/** What a page brings: one answer per API path, and how many opening parts read each. */
export type PageCopies = { id: string; copies: Record<string, { json: unknown; reads: number }> };

export type CopySource = { get: () => Promise<Response>; reads?: number };

/** Opening a second part a few minutes later still finds the copy; past that it asks fresh. */
export const COPY_MS = 5 * 60 * 1000;

/** Longer than a warm handler ever takes (30–110 ms); a slower one is skipped and its part fetches. */
export const COPY_WAIT_MS = 1500;

type Kept = { body: string; reads: number; until: number };
const kept = new Map<string, Kept>();
// The router can render the same page payload again (back and forward): its copies are not fresh then.
const seen = new Set<string>();

/** Server side: run each source's GET at once; keep the answers that came back ok in time. */
export async function collectCopies(sources: Record<string, CopySource>, waitMs = COPY_WAIT_MS): Promise<PageCopies> {
  const answers = await Promise.all(
    Object.entries(sources).map(async ([path, { get, reads = 1 }]) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const late = new Promise<undefined>((resolve) => {
        timer = setTimeout(() => resolve(undefined), waitMs);
      });
      const answer = (async () => {
        const res = await get();
        return res.ok ? ((await res.json()) as unknown) : undefined;
      })().catch(() => undefined);
      const json = await Promise.race([answer, late]);
      clearTimeout(timer);
      return json === undefined ? null : ([path, { json, reads }] as const);
    })
  );
  return { id: crypto.randomUUID(), copies: Object.fromEntries(answers.filter((a) => a !== null)) };
}

/** Browser side: keep a page's copies for its parts to open with. */
export function keepPageCopies(page: PageCopies): void {
  // Rendered on the server too (the HTML), where this module is shared by every request: keep nothing there.
  if (typeof window === "undefined" || seen.has(page.id)) return;
  seen.add(page.id);
  const until = Date.now() + COPY_MS;
  for (const [path, { json, reads }] of Object.entries(page.copies)) {
    kept.set(path, { body: JSON.stringify(json), reads, until });
  }
}

/** A part's first load: the page's copy when there is one left, otherwise the server. */
export function fetchOnOpen(path: string): Promise<Response> {
  const copy = kept.get(path);
  if (copy && Date.now() < copy.until) {
    copy.reads -= 1;
    if (copy.reads <= 0) kept.delete(path);
    return Promise.resolve(new Response(copy.body, { status: 200, headers: { "Content-Type": "application/json" } }));
  }
  kept.delete(path);
  return fetch(path);
}
