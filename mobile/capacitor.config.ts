import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Wraps the live FollowUp web app (server.url) in a native shell rather
 * than bundling a static export — FollowUp is a full server-rendered
 * Next.js app (API routes, NextAuth sessions, Prisma/Postgres) that can't
 * be statically exported, so the standard Capacitor pattern for a
 * full-stack web app applies here: the native project is a thin wrapper,
 * webDir is never actually used to serve local files. Same URL that's
 * live in the browser today, so any Vercel deploy of the web app updates
 * this "app" for every installed user automatically, with zero app-store
 * re-review needed for a normal product change — only capacitor.config.ts
 * itself (or a native plugin/permission) ever needs a new store release.
 */
const config: CapacitorConfig = {
  appId: "io.followupbase.app",
  appName: "FollowUp",
  webDir: "www", // required by the CLI, unused — see server.url below
  server: {
    url: "https://www.followupbase.io",
    androidScheme: "https",
  },
  backgroundColor: "#fafafa", // matches manifest.ts's background_color
};

export default config;
