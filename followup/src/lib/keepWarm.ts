/**
 * Keeps the pages an owner opens awake (founder, 2026-10-27: "our app is
 * very slow").
 *
 * Vercel runs each page as its own small server and puts it to sleep after
 * a few quiet minutes. With a handful of owners, most taps landed on a
 * sleeping page: on Oct 27 the first open of Today took 2.4 s, Activity
 * 2.1 s, Customers 1.7 s and the sign-in check 1.2–1.5 s, while the same
 * pages answered in 0.04–0.08 s once awake. The scheduled jobs that run
 * every minute or two were never cold.
 *
 * So a scheduled job (/api/cron/keep-warm, every 3 minutes in vercel.json)
 * opens each of these pages with no sign-in. Every one of them checks the
 * sign-in first and sends a signed-out visitor away at once, so a visit
 * reads nothing and changes nothing; it only wakes the page.
 */
export const WARM_PATHS = [
  "/dashboard",
  "/leads",
  // Any id: a signed-out visit wakes the customer page and stops before the lookup.
  "/leads/keep-warm",
  "/activity",
  "/analytics",
  "/calls",
  "/settings",
  "/signin",
  // The sign-in check the browser makes on every page load.
  "/api/auth/session",
] as const;

export type WarmResult = { path: string; status: number | null; ms: number };

/** Visits every page once, all at the same time. Never throws: a page that doesn't answer is reported, not fatal. */
export async function keepWarm(base: string, timeoutMs = 10_000): Promise<WarmResult[]> {
  return Promise.all(
    WARM_PATHS.map(async (path) => {
      const started = Date.now();
      try {
        const res = await fetch(`${base}${path}`, {
          // A signed-out page answers with a redirect to /signin; following it would only wake /signin again.
          redirect: "manual",
          cache: "no-store",
          signal: AbortSignal.timeout(timeoutMs),
          headers: { "user-agent": "FollowUp keep-warm" },
        });
        await res.body?.cancel();
        return { path, status: res.status, ms: Date.now() - started };
      } catch {
        return { path, status: null, ms: Date.now() - started };
      }
    })
  );
}
