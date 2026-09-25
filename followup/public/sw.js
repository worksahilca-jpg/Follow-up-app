/*
 * FollowUp's service worker. It does exactly two things: show a
 * notification when the server pushes one (src/lib/webPush.ts), and open
 * the right page when it is tapped.
 *
 * Deliberately no `fetch` handler and no caching. A service worker that
 * intercepts requests can serve a stale app after a deploy, and a stale
 * approval screen is the one thing this product cannot afford. Nothing
 * here touches the app's pages at all.
 *
 * Plain JavaScript in public/ because it must be served from the site root
 * to control the whole origin, and it is registered as-is by the Alerts
 * block in Settings (src/components/AlertsSection.tsx).
 */

self.addEventListener("install", () => {
  // Take over at once, so a device that just turned notifications on
  // doesn't wait for every FollowUp tab to close before it can receive one.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/** Only ever a page on this site. A payload naming anywhere else opens the dashboard. */
function safePath(url) {
  try {
    const target = new URL(url || "/dashboard", self.location.origin);
    if (target.origin !== self.location.origin) return "/dashboard";
    return target.pathname + target.search + target.hash;
  } catch {
    return "/dashboard";
  }
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Not JSON: nothing FollowUp sent. Still show something — a push that
    // shows no notification gets the site's permission revoked by Safari.
  }
  const title = typeof data.title === "string" && data.title ? data.title : "FollowUp";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      tag: typeof data.tag === "string" ? data.tag : undefined,
      // A newer alert about the same customer replaces the old one on the
      // lock screen instead of stacking beside it — and still buzzes. The
      // server only sends one per wait, so a second one for the same person
      // means they wrote again after the owner acted: that is news, and a
      // silent swap would hide it behind a notification already read.
      renotify: true,
      // The app icon at a size a phone can show crisply; /icon is the 32px favicon.
      icon: "/brand/png/followup-app-icon-256.png",
      data: { url: safePath(data.url) },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = safePath(event.notification.data && event.notification.data.url);
  const target = new URL(path, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Already open on exactly that page: bring it forward.
      for (const client of windows) {
        if (client.url === target && "focus" in client) return client.focus();
      }
      // FollowUp open somewhere else: take that window to the page, so the
      // owner doesn't collect a new tab per alert.
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && "navigate" in client) {
          await client.focus();
          return client.navigate(target);
        }
      }
      return self.clients.openWindow(target);
    })()
  );
});
